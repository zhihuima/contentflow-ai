// ============================================================
// Planner Agent — 意图解析 + 选题策划
// ============================================================
import type { AgentConfig, AgentContext, AgentResult } from '../types';
import { parseIntent } from '@/lib/agents/intent-parser';
import { planTopics } from '@/lib/agents/topic-planner';
import type { ParsedRequirement } from '@/lib/types';

export const plannerAgent: AgentConfig = {
    id: 'planner',
    name: '选题策划',
    description: '解析用户意图，生成结构化需求，策划 3 个差异化选题方案并评估流量潜力',
    capabilities: ['intent-parsing', 'topic-planning', 'audience-analysis'],
    retryable: true,
    maxRetries: 1,
    execute: async (ctx: AgentContext): Promise<AgentResult> => {
        // Step 1: Parse intent
        ctx.emit({
            type: 'agent_progress',
            agentId: 'planner',
            agentName: '选题策划',
            message: '正在解析创作意图，提取关键信息...',
            reasoning: '【推理逻辑】\n1. 解析用户输入，提取主题/受众/风格\n2. 生成结构化需求文档\n3. 策划 3 个差异化选题方案\n4. 评估每个选题的流量潜力',
            timestamp: Date.now(),
        });

        const parsed = await parseIntent(ctx.userInput);
        ctx.memory.parsedRequirement = parsed;

        // Step 2: Plan topics
        ctx.emit({
            type: 'agent_progress',
            agentId: 'planner',
            agentName: '选题策划',
            message: `意图解析完成「${parsed.topic}」，正在策划选题方案...`,
            timestamp: Date.now(),
        });

        const topics = await planTopics(parsed as ParsedRequirement);
        ctx.memory.topicPlans = topics;

        return {
            status: 'success',
            data: { parsed, topics },
            feedback: `解析完成「${parsed.topic}」· ${parsed.content_style}，生成 ${topics.length} 个选题方案`,
        };
    },
};
