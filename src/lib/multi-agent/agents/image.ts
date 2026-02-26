// ============================================================
// Image Agent — AI 配图生成
// ============================================================
import type { AgentConfig, AgentContext, AgentResult } from '../types';
import type { XhsNote, XhsSlide } from '@/lib/types';
import { generateSlideImage } from '@/lib/volcengine-image';

export const imageAgent: AgentConfig = {
    id: 'image',
    name: 'AI 绘图',
    description: '使用火山引擎 AI 为小红书笔记卡片生成配图',
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

        const topic = (ctx.memory.parsedRequirement as { topic?: string })?.topic || '';
        const slidesWithImages: XhsSlide[] = [];
        let successCount = 0;

        for (let i = 0; i < note.content_slides.length; i++) {
            const slide = note.content_slides[i];

            // 构建关键词 — 优先使用 slide 自身的关键词
            const keywords = slide.image_keywords?.length
                ? slide.image_keywords
                : slide.image_description
                    ? slide.image_description.split(/[，,、\s]+/).filter(Boolean).slice(0, 5)
                    : ['minimalist', 'design'];

            // 构建丰富的上下文 — 确保配图紧扣内容
            const noteTitle = note.titles?.[0] || '';
            const noteHashtags = note.hashtags?.slice(0, 3).join(' ') || '';
            const context = [
                topic ? `主题: ${topic}` : '',
                noteTitle ? `笔记标题: ${noteTitle}` : '',
                slide.image_description ? `画面描述: ${slide.image_description}` : '',
                slide.text_overlay ? `卡片文字: ${slide.text_overlay}` : '',
                noteHashtags ? `标签: ${noteHashtags}` : '',
                note.caption ? `正文摘要: ${note.caption.slice(0, 80)}` : '',
            ].filter(Boolean).join('\n');

            ctx.emit({
                type: 'agent_progress',
                agentId: 'image',
                agentName: 'AI 绘图',
                message: `正在生成第 ${i + 1}/${note.content_slides.length} 张配图: "${keywords.slice(0, 3).join(', ')}"`,
                timestamp: Date.now(),
            });

            try {
                const result = await generateSlideImage(keywords, context, i, note.content_slides.length);

                if (result) {
                    slidesWithImages.push({ ...slide, image_url: result.dataUrl });
                    successCount++;
                    console.log(`[AI Image] Slide ${i + 1} generated successfully`);
                } else {
                    // Fallback: 使用占位图
                    console.warn(`[AI Image] Slide ${i + 1} failed, using placeholder`);
                    slidesWithImages.push({
                        ...slide,
                        image_url: `https://picsum.photos/seed/${encodeURIComponent(keywords.join('-'))}/600/800`,
                    });
                }
            } catch (err) {
                console.error(`[AI Image] Slide ${i + 1} error:`, err);
                slidesWithImages.push({
                    ...slide,
                    image_url: `https://picsum.photos/seed/${encodeURIComponent(keywords.join('-'))}/600/800`,
                });
            }
        }

        // 更新 memory 中的笔记
        const updatedNote = { ...note, content_slides: slidesWithImages };
        ctx.memory.xhsNote = updatedNote;

        if (successCount > 0) {
            return {
                status: 'success',
                data: { slidesCount: slidesWithImages.length, aiGenerated: successCount },
                feedback: `AI 绘图完成 — ${successCount}/${slidesWithImages.length} 张原创配图已生成`,
            };
        }

        return {
            status: 'success',
            data: null,
            feedback: '绘图跳过（API 暂不可用，使用占位图）',
        };
    },
};

