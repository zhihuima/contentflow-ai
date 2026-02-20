// ============================================================
// Image Agent — AI 配图生成
// ============================================================
import type { AgentConfig, AgentContext, AgentResult } from '../types';
import type { XhsNote } from '@/lib/types';

export const imageAgent: AgentConfig = {
    id: 'image',
    name: 'AI 绘图',
    description: '使用 Gemini AI 为小红书笔记卡片生成配图',
    capabilities: ['image-generation', 'ai-illustration'],
    retryable: true,
    maxRetries: 1,
    execute: async (ctx: AgentContext): Promise<AgentResult> => {
        if (ctx.mode !== 'xhs') {
            return { status: 'skipped', data: null, feedback: '仅在小红书模式下生成配图' };
        }

        const note = ctx.memory.xhsNote as XhsNote;
        if (!note?.content_slides) {
            return { status: 'skipped', data: null, feedback: '无图文卡片可配图' };
        }

        ctx.emit({
            type: 'agent_progress',
            agentId: 'image',
            agentName: 'AI 绘图',
            message: `正在为 ${note.content_slides.length} 张卡片生成 AI 配图...`,
            reasoning: '【推理逻辑】\n1. 从卡片 image_keywords 提取语义关键词\n2. 调用 Gemini API 生成竖版插图\n3. 失败自动降级为占位图',
            timestamp: Date.now(),
        });

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/workflow/xhs-images`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slides: note.content_slides,
                    topic: (ctx.memory.parsedRequirement as { topic?: string })?.topic || '',
                }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data?.slides) {
                    // Update slides in memory
                    const updatedNote = { ...note, content_slides: data.slides };
                    ctx.memory.xhsNote = updatedNote;
                    return {
                        status: 'success',
                        data: { slidesCount: data.slides.length },
                        feedback: `AI 绘图完成 — ${data.slides.length} 张原创配图已生成`,
                    };
                }
            }
        } catch {
            // Graceful fallback
        }

        return {
            status: 'success', // Don't fail the workflow for image generation
            data: null,
            feedback: '绘图跳过（API 暂不可用，使用占位图）',
        };
    },
};
