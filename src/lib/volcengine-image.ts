// ============================================================
// Volcengine Image Generation — 火山引擎文生图 API
// 使用 AK/SK 认证，调用 visual.volcengineapi.com
// ============================================================

import crypto from 'crypto';

const VOLC_ACCESS_KEY = process.env.VOLC_ACCESS_KEY_ID || '';
const VOLC_SECRET_KEY = process.env.VOLC_SECRET_ACCESS_KEY || '';

const SERVICE = 'cv';
const REGION = 'cn-north-1';
const HOST = 'visual.volcengineapi.com';
const API_VERSION = '2022-08-31';

export interface GeneratedImage {
    base64: string;
    mimeType: string;
    dataUrl: string;
}

// ---- Volcengine V4 Signing ----

function hmacSha256(key: Buffer | string, data: string): Buffer {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function sha256Hex(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function getSignatureKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
    const kDate = hmacSha256(secretKey, dateStamp);
    const kRegion = hmacSha256(kDate, region);
    const kService = hmacSha256(kRegion, service);
    const kSigning = hmacSha256(kService, 'request');
    return kSigning;
}

interface SignedRequest {
    url: string;
    headers: Record<string, string>;
    body: string;
}

function signRequest(
    action: string,
    body: string,
    method: string = 'POST',
): SignedRequest {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStamp = amzDate.slice(0, 8);

    const queryString = `Action=${action}&Version=${API_VERSION}`;
    const url = `https://${HOST}?${queryString}`;

    const contentType = 'application/json';
    const payloadHash = sha256Hex(body);

    // Canonical request
    const canonicalHeaders = [
        `content-type:${contentType}`,
        `host:${HOST}`,
        `x-content-sha256:${payloadHash}`,
        `x-date:${amzDate}`,
    ].join('\n') + '\n';

    const signedHeaders = 'content-type;host;x-content-sha256;x-date';

    const canonicalRequest = [
        method,
        '/',
        queryString,
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join('\n');

    // String to sign
    const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/request`;
    const stringToSign = [
        'HMAC-SHA256',
        amzDate,
        credentialScope,
        sha256Hex(canonicalRequest),
    ].join('\n');

    // Signing
    const signingKey = getSignatureKey(VOLC_SECRET_KEY, dateStamp, REGION, SERVICE);
    const signature = hmacSha256(signingKey, stringToSign).toString('hex');

    const authorization = `HMAC-SHA256 Credential=${VOLC_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
        url,
        headers: {
            'Content-Type': contentType,
            'Host': HOST,
            'X-Date': amzDate,
            'X-Content-Sha256': payloadHash,
            'Authorization': authorization,
        },
        body,
    };
}

// ---- Public API ----

/**
 * 调用火山引擎文生图 API
 * @param prompt 文字描述
 * @param width 图片宽度
 * @param height 图片高度
 * @returns GeneratedImage 或 null
 */
export async function generateImage(
    prompt: string,
    width: number = 512,
    height: number = 768,
): Promise<GeneratedImage | null> {
    try {
        console.log(`[Volcengine Image] Generating: "${prompt.slice(0, 60)}..." (${width}x${height})`);

        const requestBody = JSON.stringify({
            req_key: 'high_aes',
            prompt,
            seed: -1,
            scale: 3.5,
            ddim_steps: 25,
            width,
            height,
            use_sr: true,
            return_url: false,
        });

        const signed = signRequest('CVProcess', requestBody);

        const response = await fetch(signed.url, {
            method: 'POST',
            headers: signed.headers,
            body: signed.body,
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Volcengine Image] API error ${response.status}: ${errText.slice(0, 500)}`);
            return null;
        }

        const data = await response.json();

        if (data.code !== 10000 && data.code !== 0) {
            console.error(`[Volcengine Image] Business error: code=${data.code}, message=${data.message}`);
            return null;
        }

        // Extract base64 image from response
        const imageData = data.data?.binary_data_base64?.[0];
        if (!imageData) {
            console.error('[Volcengine Image] No image data in response:', JSON.stringify(data).slice(0, 300));
            return null;
        }

        console.log(`[Volcengine Image] Generated successfully (${Math.round(imageData.length / 1024)}KB)`);

        return {
            base64: imageData,
            mimeType: 'image/jpeg',
            dataUrl: `data:image/jpeg;base64,${imageData}`,
        };
    } catch (error) {
        console.error('[Volcengine Image] Request failed:', error);
        return null;
    }
}

/**
 * 根据关键词和上下文自动构建提示词，然后生成图片
 * 用于小红书卡片配图 — 确保配图紧扣内容
 */
export async function generateSlideImage(
    keywords: string[],
    slideContext?: string,
    slideIndex?: number,
    totalSlides?: number,
): Promise<GeneratedImage | null> {
    const keywordStr = keywords.join(', ');

    // 构建紧扣内容的提示词
    const prompt = `根据以下内容生成一张高品质插图配图，要求画面直接反映内容主题，不要出现文字：

关键词: ${keywordStr}
${slideContext || ''}

风格要求: 小红书风格、高级感、柔和配色、干净简约、竖版构图、无文字水印`;

    // XHS card: 3:4 portrait ratio
    return generateImage(prompt, 512, 768);
}
