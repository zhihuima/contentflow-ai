// ============================================================
// Writer Agent — 内容创作（脚本 / 笔记 / 润色）
// ============================================================
import type { AgentConfig, AgentContext, AgentResult } from '../types';
import { writeScript } from '@/lib/agents/script-writer';
import { writeXhsNote } from '@/lib/agents/xhs-writer';
import { polishContent } from '@/lib/agents/content-polisher';
import type { ParsedRequirement, TopicPlan } from '@/lib/types';

export const writerAgent: AgentConfig = {
    id: 'writer',
    name: '内容创作',
    description: '根据选题和素材创作视频号脚本、小红书图文笔记，或润色现有内容',
    capabilities: ['script-writing', 'xhs-note', 'content-polish', 'copywriting'],
    retryable: true,
    maxRetries: 2,
    execute: async (ctx: AgentContext): Promise<AgentResult> => {
        const mode = ctx.mode;
        const ragContext = (ctx.memory.ragContext as string) || '';
        const revisionNote = ctx.revisionFeedback
            ? `\n\n[注意] 上一轮审核反馈（请重点改进）：${ctx.revisionFeedback}`
            : '';

        if (mode === 'polish') {
            ctx.emit({
                type: 'agent_progress',
                agentId: 'writer',
                agentName: '内容创作',
                message: '正在按爆款标准润色内容...',
                reasoning: '【推理逻辑】\n1. 分析原始内容的优缺点\n2. 参考知识库中的爆款方法论\n3. 从标题/结构/表达/互动等维度全面优化\n4. 输出对比和评分',
                timestamp: Date.now(),
            });

            const result = await polishContent(ctx.userInput, ragContext);
            ctx.memory.polishResult = result;
            return {
                status: 'success',
                data: result,
                feedback: `润色完成 — 评分 ${result.score.before} → ${result.score.after}`,
                score: result.score.after,
            };
        }

        const requirement = ctx.memory.parsedRequirement as ParsedRequirement;

        // Resolve selectedTopic: check direct object first, then resolve from topicPlans + selectedTopicId
        let selectedTopic = ctx.memory.selectedTopic as TopicPlan | undefined;
        if (!selectedTopic && ctx.memory.topicPlans) {
            const plans = ctx.memory.topicPlans as TopicPlan[];
            const selectedId = ctx.memory.selectedTopicId as number | undefined;
            if (selectedId != null) {
                selectedTopic = plans.find(t => t.id === selectedId) || plans[0];
            } else if (plans.length > 0) {
                // Auto-select highest scoring topic
                selectedTopic = plans.reduce((best, t) => t.traffic_score > best.traffic_score ? t : best, plans[0]);
            }
            if (selectedTopic) {
                ctx.memory.selectedTopic = selectedTopic;
            }
        }

        if (!requirement || !selectedTopic) {
            return { status: 'failed', data: null, feedback: '缺少需求解析或选题数据' };
        }

        if (mode === 'xhs') {
            ctx.emit({
                type: 'agent_progress',
                agentId: 'writer',
                agentName: '内容创作',
                message: '正在创作小红书图文笔记...',
                reasoning: '【推理逻辑】\n1. 设计高吸引力封面\n2. 编排 6-8 张图文卡片\n3. 撰写爆款文案\n4. 打磨金句和话题标签',
                timestamp: Date.now(),
            });

            const note = await writeXhsNote(requirement, selectedTopic, ragContext + revisionNote);
            ctx.memory.xhsNote = note;
            return {
                status: 'success',
                data: note,
                feedback: `笔记创作完成 — ${note.content_slides?.length || 0} 张卡片 · ${note.hashtags?.length || 0} 个标签`,
            };
        }

        // video mode
        ctx.emit({
            type: 'agent_progress',
            agentId: 'writer',
            agentName: '内容创作',
            message: '正在创作视频脚本...',
            reasoning: '【推理逻辑】\n1. 设计 3 秒钩子\n2. 编排分镜口播\n3. 打磨金句\n4. 构思封面方案',
            timestamp: Date.now(),
        });

        const script = await writeScript(requirement, selectedTopic, ragContext + revisionNote);
        ctx.memory.script = script;
        return {
            status: 'success',
            data: script,
            feedback: `脚本创作完成 — ${script.word_count} 字 · ${script.estimated_duration} · ${script.main_body?.length || 0} 个分镜`,
        };
    },
};
