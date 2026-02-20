// ============================================================
// Gemini Image Generation — AI 绘图 API
// 使用 APIYI 提供的 Gemini 3 Pro Image Preview 模型
// ============================================================

const GEMINI_API_KEY = process.env.GEMINI_IMAGE_API_KEY || 'sk-0IWPNOhefPpx4vdeD344DaD644544f419a03B8E677Cf0912';
const GEMINI_MODEL = 'gemini-3-pro-image-preview';
const GEMINI_BASE_URL = 'https://api.apiyi.com/v1beta';

export interface GeneratedImage {
    base64: string;
    mimeType: string;
    dataUrl: string;
}

/**
 * 调用 Gemini Image API 生成一张图片
 * @param prompt 生成图片的提示词
 * @param aspectRatio 宽高比，可选 1:1, 16:9, 9:16, 4:3, 3:4
 * @returns GeneratedImage 或 null（失败时）
 */
export async function generateImage(
    prompt: string,
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' = '3:4',
): Promise<GeneratedImage | null> {
    try {
        console.log(`[Gemini Image] Generating: "${prompt.slice(0, 60)}..." (${aspectRatio})`);

        const response = await fetch(`${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GEMINI_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                    ],
                }],
                generationConfig: {
                    responseModalities: ['IMAGE'],
                    imageConfig: {
                        aspectRatio,
                        imageSize: '1K',
                    },
                },
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Gemini Image] API error ${response.status}: ${errText}`);
            return null;
        }

        const data = await response.json();

        // 提取 base64 图片数据
        const candidate = data.candidates?.[0];
        const part = candidate?.content?.parts?.[0];

        if (!part?.inline_data?.data) {
            console.error('[Gemini Image] No image data in response:', JSON.stringify(data).slice(0, 300));
            return null;
        }

        const base64 = part.inline_data.data;
        const mimeType = part.inline_data.mime_type || 'image/png';

        console.log(`[Gemini Image] Generated successfully (${mimeType}, ${Math.round(base64.length / 1024)}KB)`);

        return {
            base64,
            mimeType,
            dataUrl: `data:${mimeType};base64,${base64}`,
        };
    } catch (error) {
        console.error('[Gemini Image] Request failed:', error);
        return null;
    }
}

/**
 * 根据关键词和上下文自动构建提示词，然后生成图片
 * @param keywords 关键词列表
 * @param slideContext 卡片内容（标题、正文等）
 * @param slideIndex 当前卡片序号
 * @param totalSlides 总卡片数
 */
export async function generateSlideImage(
    keywords: string[],
    slideContext?: string,
    slideIndex?: number,
    totalSlides?: number,
): Promise<GeneratedImage | null> {
    // 构建精细化提示词
    const keywordStr = keywords.join(', ');
    const slideInfo = slideIndex !== undefined && totalSlides !== undefined
        ? `This is slide ${slideIndex + 1} of ${totalSlides} in a series.`
        : '';

    const prompt = `Create a beautiful, modern, high-quality illustration for a Xiaohongshu (Little Red Book) social media post card.

Theme and keywords: ${keywordStr}
${slideContext ? `Content context: ${slideContext}` : ''}
${slideInfo}

Requirements:
- Clean, aesthetic, Instagram-worthy visual style
- Soft color palette with modern gradients
- Minimalist composition with clear focal point
- No text or watermarks in the image
- Professional photography or illustration quality
- Suitable for social media card format (portrait orientation)`;

    // XHS 卡片使用 3:4 竖版比例
    return generateImage(prompt, '3:4');
}
