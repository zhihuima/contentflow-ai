// ============================================================
// Orchestrator — Multi-Agent 动态编排大脑
// ============================================================
import { callClaude } from '@/lib/claude';
import { safeParseJSON } from '@/lib/safe-json';
import { getAgent, getAllAgents, getAgentManifest } from './agent-registry';
import type { AgentContext, AgentResult, AgentEvent } from './types';

const MAX_ORCHESTRATOR_STEPS = 20;
const REVISION_THRESHOLD = 75;
const MAX_REVISIONS = 2;

interface OrchestratorDecision {
    next_agents: {
        agent_id: string;
        reason: string;
    }[];
    parallel: boolean;
    reasoning: string;
    is_complete: boolean;
    final_summary?: string;
}

const ORCHESTRATOR_SYSTEM = `你是一个 Multi-Agent 编排器（Orchestrator）。你的职责是根据任务目标和当前进度，智能调度下属 Agent 完成工作。

## 你的团队
{AGENT_MANIFEST}

## 决策规则
1. 分析当前任务状态（memory 中已有的数据），决定下一步调度哪些 Agent
2. 如果多个 Agent 互不依赖，设置 parallel=true 并行执行
3. 如果 Critic Agent 评分 < ${REVISION_THRESHOLD}，应该让 Writer 带反馈重写（最多 ${MAX_REVISIONS} 轮）
4. Research 和 Planner 可以并行，Writer 需要等它们完成
5. 当所有必要步骤完成且质量达标，设置 is_complete=true
6. **重要**：如果某个 Agent 的 status 为 "failed"（在 memory 中可见），绝对不要再次调度该 Agent。直接跳过它，将任务标记为完成。质量审核失败不影响已生成的内容。

## 工作流模式
### video 模式
典型流程：Research(并行) + Planner → 用户选题 → Writer → Critic → (回写?) → 完成
### xhs 模式
典型流程：Research(并行) + Planner → 用户选题 → Writer → Image → Critic → (回写?) → 完成
### polish 模式
简化流程：Research → Writer(polish) → 完成

## 输出格式
严格输出 JSON：
{
  "next_agents": [
    { "agent_id": "...", "reason": "调度理由" }
  ],
  "parallel": false,
  "reasoning": "整体决策推理过程（中文，100字以内）",
  "is_complete": false,
  "final_summary": "任务总结（仅 is_complete=true 时填写）"
}`;

/** 运行完整的 Multi-Agent 编排流程 */
export async function runOrchestrator(ctx: AgentContext): Promise<void> {
    let stepCount = 0;

    while (stepCount < MAX_ORCHESTRATOR_STEPS) {
        stepCount++;

        // 让 Orchestrator 决策下一步
        const decision = await getOrchestratorDecision(ctx);

        ctx.emit({
            type: 'orchestrator_decision',
            agentId: 'orchestrator',
            agentName: '编排器',
            message: decision.reasoning,
            data: { step: stepCount, decision },
            timestamp: Date.now(),
        });

        if (decision.is_complete) {
            ctx.emit({
                type: 'task_complete',
                agentId: 'orchestrator',
                agentName: '编排器',
                message: decision.final_summary || '所有 Agent 工作完成',
                data: ctx.memory,
                timestamp: Date.now(),
            });
            return;
        }

        // 获取要调度的 Agent
        const agentsToRun = decision.next_agents
            .map(a => ({ config: getAgent(a.agent_id), reason: a.reason }))
            .filter(a => a.config != null);

        if (agentsToRun.length === 0) {
            ctx.emit({
                type: 'task_error',
                agentId: 'orchestrator',
                agentName: '编排器',
                message: '无法找到合适的 Agent 执行任务',
                timestamp: Date.now(),
            });
            return;
        }

        // 执行 Agent（并行或串行）
        if (decision.parallel && agentsToRun.length > 1) {
            await Promise.all(agentsToRun.map(a => executeAgent(a.config!, ctx)));
        } else {
            for (const a of agentsToRun) {
                const result = await executeAgent(a.config!, ctx);

                // 检查是否需要回写
                if (result.status === 'needs_revision' && ctx.revisionCount < MAX_REVISIONS) {
                    ctx.revisionCount++;
                    ctx.revisionFeedback = result.feedback;
                    ctx.emit({
                        type: 'revision_loop',
                        agentId: a.config!.id,
                        agentName: a.config!.name,
                        message: `第 ${ctx.revisionCount} 轮回写：${result.feedback}`,
                        data: { round: ctx.revisionCount, score: result.score },
                        timestamp: Date.now(),
                    });
                    // 回写逻辑：不 break，让 Orchestrator 在下一轮决策中处理
                }
            }
        }
    }

    ctx.emit({
        type: 'task_error',
        agentId: 'orchestrator',
        agentName: '编排器',
        message: `编排步数超过上限 (${MAX_ORCHESTRATOR_STEPS})`,
        timestamp: Date.now(),
    });
}

/** 执行单个 Agent（带重试） */
async function executeAgent(agent: AgentConfig, ctx: AgentContext): Promise<AgentResult> {
    ctx.emit({
        type: 'agent_start',
        agentId: agent.id,
        agentName: agent.name,
        message: `${agent.name} 正在工作...`,
        timestamp: Date.now(),
    });

    let lastError: Error | null = null;
    const maxAttempts = agent.retryable ? agent.maxRetries + 1 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const result = await agent.execute(ctx);

            // 写入共享记忆
            ctx.memory[`${agent.id}_result`] = result.data;
            ctx.memory[`${agent.id}_status`] = result.status;
            if (result.score != null) ctx.memory[`${agent.id}_score`] = result.score;

            ctx.emit({
                type: 'agent_done',
                agentId: agent.id,
                agentName: agent.name,
                message: result.feedback || `${agent.name} 完成`,
                data: result.data,
                timestamp: Date.now(),
            });

            return result;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < maxAttempts) {
                ctx.emit({
                    type: 'agent_progress',
                    agentId: agent.id,
                    agentName: agent.name,
                    message: `重试中 (${attempt}/${maxAttempts - 1})...`,
                    timestamp: Date.now(),
                });
                // 指数退避
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }

    // 所有重试失败
    const errorResult: AgentResult = {
        status: 'failed',
        data: null,
        feedback: lastError?.message || '未知错误',
    };

    ctx.memory[`${agent.id}_status`] = 'failed';
    ctx.memory[`${agent.id}_error`] = lastError?.message;

    ctx.emit({
        type: 'agent_error',
        agentId: agent.id,
        agentName: agent.name,
        message: `${agent.name} 失败：${lastError?.message}`,
        timestamp: Date.now(),
    });

    return errorResult;
}

/** 调用 Claude 获取 Orchestrator 决策 */
async function getOrchestratorDecision(ctx: AgentContext): Promise<OrchestratorDecision> {
    const manifest = getAgentManifest();
    const system = ORCHESTRATOR_SYSTEM.replace('{AGENT_MANIFEST}', manifest);

    const memorySnapshot: Record<string, string> = {};
    for (const [key, val] of Object.entries(ctx.memory)) {
        // 压缩大数据，只传 status 和 score
        if (key.endsWith('_status') || key.endsWith('_score') || key.endsWith('_error')) {
            memorySnapshot[key] = String(val);
        } else if (key.endsWith('_result')) {
            const v = val as Record<string, unknown>;
            // 传精简版
            memorySnapshot[key] = JSON.stringify(v).slice(0, 200) + '...';
        } else {
            memorySnapshot[key] = typeof val === 'string' ? val.slice(0, 100) : JSON.stringify(val).slice(0, 100);
        }
    }

    const userMsg = `当前任务状态：
- 模式: ${ctx.mode}
- 用户输入: ${ctx.userInput.slice(0, 200)}
- 已注册 Agent: ${getAllAgents().map(a => a.id).join(', ')}
- 共享记忆:
${JSON.stringify(memorySnapshot, null, 2)}
- 回写次数: ${ctx.revisionCount}/${MAX_REVISIONS}
${ctx.revisionFeedback ? `- 回写反馈: ${ctx.revisionFeedback}` : ''}

请决定下一步行动。`;

    const raw = await callClaude({
        system,
        messages: [{ role: 'user', content: userMsg }],
        temperature: 0.3,
        maxTokens: 1024,
    });

    return safeParseJSON<OrchestratorDecision>(raw, 'orchestrator');
}

// Re-export type for use in agent configs
import type { AgentConfig } from './types';
export type { AgentConfig };
