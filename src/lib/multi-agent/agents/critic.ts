// ============================================================
// Critic Agent — 流量优化 + 质量审核
// ============================================================
import type { AgentConfig, AgentContext, AgentResult } from '../types';
import { optimizeTraffic } from '@/lib/agents/traffic-optimizer';
import { reviewQuality } from '@/lib/agents/quality-reviewer';
import { optimizeXhsNote } from '@/lib/agents/xhs-optimizer';
import { reviewXhsNote } from '@/lib/agents/xhs-reviewer';
import type { ParsedRequirement, Script, XhsNote } from '@/lib/types';

const REVISION_THRESHOLD = 75;

export const criticAgent: AgentConfig = {
    id: 'critic',
    name: '质量审核',
    description: '流量规则审查 + 质量评分。评分低于 75 会要求 Writer 回写',
    capabilities: ['traffic-optimization', 'quality-review', 'scoring', 'compliance-check'],
    retryable: true,
    maxRetries: 1,
    execute: async (ctx: AgentContext): Promise<AgentResult> => {
        const requirement = ctx.memory.parsedRequirement as ParsedRequirement;

        if (ctx.mode === 'xhs') {
            const note = ctx.memory.xhsNote as XhsNote;
            if (!note || !requirement) {
                return { status: 'failed', data: null, feedback: '缺少笔记数据' };
            }

            // XHS: Optimize
            ctx.emit({
                type: 'agent_progress',
                agentId: 'critic',
                agentName: '质量审核',
                message: '正在用 AARRR 模型审查笔记流量潜力...',
                reasoning: '【推理逻辑】\n1. AARRR 模型逐维评分\n2. 封面吸引力 + 标题 SEO\n3. 互动设计 + 传播基因分析',
                timestamp: Date.now(),
            });
            const report = await optimizeXhsNote(requirement, note);
            ctx.memory.trafficReport = report;

            // XHS: Review
            ctx.emit({
                type: 'agent_progress',
                agentId: 'critic',
                agentName: '质量审核',
                message: `流量评分 ${report.overall_score}/100，正在最终质量审核...`,
                timestamp: Date.now(),
            });
            const review = await reviewXhsNote(requirement, note, report);
            ctx.memory.xhsReview = review;

            const score = review.overall_score;
            if (score < REVISION_THRESHOLD && ctx.revisionCount < 2) {
                return {
                    status: 'needs_revision',
                    data: { report, review },
                    feedback: `评分 ${score}/100，需改进：${review.summary}`,
                    score,
                };
            }

            return {
                status: 'success',
                data: { report, review },
                feedback: `审核通过 — 最终评分 ${score}/100`,
                score,
            };
        }

        // Video mode
        const script = ctx.memory.script as Script;
        if (!script || !requirement) {
            return { status: 'failed', data: null, feedback: '缺少脚本数据' };
        }

        // Optimize
        ctx.emit({
            type: 'agent_progress',
            agentId: 'critic',
            agentName: '质量审核',
            message: '正在审查脚本流量规则和完播率预测...',
            reasoning: '【推理逻辑】\n1. 完播率预测\n2. 互动因子分析\n3. SEO 标签优化\n4. 算法友好度检查',
            timestamp: Date.now(),
        });
        const report = await optimizeTraffic(requirement, script);
        ctx.memory.trafficReport = report;

        // Review
        ctx.emit({
            type: 'agent_progress',
            agentId: 'critic',
            agentName: '质量审核',
            message: `流量评分 ${report.overall_score}/100，正在做最终质量审核...`,
            timestamp: Date.now(),
        });
        const review = await reviewQuality(requirement, script, report);
        ctx.memory.qualityReview = review;

        const score = review.overall_score;
        if (score < REVISION_THRESHOLD && ctx.revisionCount < 2) {
            return {
                status: 'needs_revision',
                data: { report, review },
                feedback: `评分 ${score}/100，需改进：${review.summary}`,
                score,
            };
        }

        return {
            status: 'success',
            data: { report, review },
            feedback: `审核通过 — 最终评分 ${score}/100 · 终稿已生成`,
            score,
        };
    },
};
