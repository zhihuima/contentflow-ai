// ============================================================
// XHS 自动配图 API Route — 使用 Gemini AI 绘图
// 支持 8 套高密度信息大图风格（来自 AJ Skills Prompts）
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { generateSlideImage } from '@/lib/gemini-image';
import { recommendStyle, getStyleById } from '@/lib/image-styles';
import { sanitizeError } from '@/lib/sanitize-error';
import type { XhsSlide } from '@/lib/types';

export const maxDuration = 120; // Gemini 生成图片需要较长时间

export async function POST(request: NextRequest) {
    try {
        const { slides, topic, styleId } = await request.json() as {
            slides: XhsSlide[];
            topic?: string;
            styleId?: string;  // 可选风格 ID
        };

        if (!slides || !Array.isArray(slides)) {
            return NextResponse.json({ error: '缺少图文卡片数据' }, { status: 400 });
        }

        // 确定使用的风格
        let activeStyleId = styleId;
        if (!activeStyleId && topic) {
            // 自动根据内容主题推荐风格
            const recommended = recommendStyle(topic, 'xhs');
            activeStyleId = recommended.id;
            console.log(`[AI Image] Auto-recommended style: ${recommended.name} (${recommended.id})`);
        }

        const activeStyle = activeStyleId ? getStyleById(activeStyleId) : null;
        if (activeStyle) {
            console.log(`[AI Image] Using style: ${activeStyle.name}`);
        }

        const slidesWithImages: XhsSlide[] = [];

        for (let i = 0; i < slides.length; i++) {
            const slide = slides[i];

            // 构建关键词
            const keywords = slide.image_keywords?.length
                ? slide.image_keywords
                : slide.image_description
                    ? slide.image_description.split(/[，,\s]+/).slice(0, 3)
                    : ['minimalist', 'design'];

            // 构建上下文
            const context = [
                topic ? `Topic: ${topic}` : '',
                slide.text_overlay ? `Text: ${slide.text_overlay}` : '',
                slide.image_description ? `Description: ${slide.image_description.slice(0, 100)}` : '',
            ].filter(Boolean).join('. ');

            console.log(`[AI Image] Generating for slide ${i + 1}/${slides.length}: "${keywords.join(', ')}"`);

            // 使用 Gemini 生成图片（传入风格 ID）
            const result = await generateSlideImage(
                keywords,
                context,
                i,
                slides.length,
                activeStyleId,
            );

            if (result) {
                slidesWithImages.push({
                    ...slide,
                    image_url: result.dataUrl,
                });
                console.log(`[AI Image] Slide ${i + 1} generated successfully`);
            } else {
                // Fallback: 如果 AI 生成失败，使用占位图
                console.warn(`[AI Image] Slide ${i + 1} failed, using placeholder`);
                slidesWithImages.push({
                    ...slide,
                    image_url: `https://picsum.photos/seed/${encodeURIComponent(keywords.join('-'))}/600/800`,
                });
            }
        }

        // 构建兼容旧格式的返回
        const images = slidesWithImages.map(s => ({
            url: s.image_url || '',
            thumb: s.image_url || '',
            alt: s.text_overlay || '',
            credit: 'Gemini AI',
            creditUrl: '',
        }));

        return NextResponse.json({
            data: {
                slides: slidesWithImages,
                images,
                styleUsed: activeStyle ? { id: activeStyle.id, name: activeStyle.name } : null,
            },
        });
    } catch (err: unknown) {
        console.error('[xhs-images] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}

