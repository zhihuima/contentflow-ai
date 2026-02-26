// ============================================================
// 即梦 (Jimeng) 视频生成 API 客户端
// 使用火山引擎 VolcEngine Visual API
// ============================================================

import crypto from 'crypto';

const VOLC_AK = process.env.JIMENG_ACCESS_KEY || '';
const VOLC_SK = process.env.JIMENG_SECRET_KEY || '';
const SERVICE = 'cv';
const REGION = 'cn-north-1';
const HOST = 'visual.volcengineapi.com';

// ---- VolcEngine API V4 签名 ----

function sha256(data: string | Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSHA256(key: string | Buffer, data: string): Buffer {
    return crypto.createHmac('sha256', key).update(data).digest();
}

function getSignatureKey(secretKey: string, date: string, region: string, service: string): Buffer {
    const kDate = hmacSHA256(secretKey, date);
    const kRegion = hmacSHA256(kDate, region);
    const kService = hmacSHA256(kRegion, service);
    return hmacSHA256(kService, 'request');
}

interface VolcRequestOptions {
    action: string;
    version: string;
    body: Record<string, unknown>;
}

async function volcRequest(options: VolcRequestOptions): Promise<unknown> {
    const { action, version, body } = options;
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';

    const queryParams = new URLSearchParams({
        Action: action,
        Version: version,
    });
    const queryString = queryParams.toString();

    const payload = JSON.stringify(body);
    const payloadHash = sha256(payload);

    // Canonical Headers
    const headers: Record<string, string> = {
        'content-type': 'application/json',
        'host': HOST,
        'x-date': amzDate,
        'x-content-sha256': payloadHash,
    };

    const signedHeaderKeys = Object.keys(headers).sort();
    const signedHeaders = signedHeaderKeys.join(';');
    const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k]}\n`).join('');

    // Canonical Request
    const canonicalRequest = [
        'POST',
        '/',
        queryString,
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join('\n');

    // String to Sign
    const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/request`;
    const stringToSign = [
        'HMAC-SHA256',
        amzDate,
        credentialScope,
        sha256(canonicalRequest),
    ].join('\n');

    // Signature
    const signingKey = getSignatureKey(VOLC_SK, dateStamp, REGION, SERVICE);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const authorization = `HMAC-SHA256 Credential=${VOLC_AK}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = `https://${HOST}/?${queryString}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            ...headers,
            Authorization: authorization,
        },
        body: payload,
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`VolcEngine API error ${res.status}: ${errText}`);
    }

    return res.json();
}

// ============================================================
// 文生视频 — 提交任务
// ============================================================

export interface VideoGenRequest {
    prompt: string;
    duration?: 5 | 10;    // 视频时长，秒
    ratio?: '16:9' | '9:16' | '1:1';
}

export interface VideoGenTaskResponse {
    taskId: string;
    status: string;
}

export async function submitVideoGenTask(req: VideoGenRequest): Promise<VideoGenTaskResponse> {
    const { prompt, duration = 5, ratio = '16:9' } = req;

    const reqKey = duration <= 5 ? 'jimeng_video_generation' : 'jimeng_video_generation_10s';

    const body = {
        req_key: reqKey,
        prompt,
        video_gen_params: {
            duration,
            aspect_ratio: ratio,
        },
    };

    const result = await volcRequest({
        action: 'CVSync2AsyncSubmitTask',
        version: '2022-08-31',
        body,
    }) as { code: number; message: string; data?: { task_id: string } };

    if (result.code !== 10000 && result.code !== 0) {
        throw new Error(`即梦 API 错误: ${result.message || JSON.stringify(result)}`);
    }

    return {
        taskId: result.data?.task_id || '',
        status: 'submitted',
    };
}

// ============================================================
// 查询任务状态
// ============================================================

export interface VideoGenResult {
    status: 'processing' | 'done' | 'failed';
    videoUrl?: string;
    coverUrl?: string;
    error?: string;
}

export async function queryVideoGenTask(taskId: string): Promise<VideoGenResult> {
    const body = {
        req_key: 'jimeng_video_generation',
        task_id: taskId,
    };

    const result = await volcRequest({
        action: 'CVSync2AsyncGetResult',
        version: '2022-08-31',
        body,
    }) as {
        code: number;
        message: string;
        data?: {
            status: string;
            resp_data?: string;
        };
    };

    if (result.code !== 10000 && result.code !== 0) {
        return { status: 'failed', error: result.message };
    }

    const status = result.data?.status;
    if (status === 'done' || status === 'Success') {
        let videoUrl = '';
        let coverUrl = '';
        try {
            const respData = JSON.parse(result.data?.resp_data || '{}');
            videoUrl = respData.video_url || respData.video_urls?.[0] || '';
            coverUrl = respData.cover_url || '';
        } catch { /* ignore */ }
        return { status: 'done', videoUrl, coverUrl };
    }

    if (status === 'failed' || status === 'Failed') {
        return { status: 'failed', error: result.data?.resp_data || '生成失败' };
    }

    return { status: 'processing' };
}

// ============================================================
// 脚本→视频提示词生成（由 AI 翻译脚本为视频描述）
// ============================================================

export function scriptToVideoPrompt(
    scriptContent: string,
    scriptType: string,
): string {
    // 根据脚本类型和内容，生成适合即梦 AI 理解的视频描述
    const baseStyle = scriptType === '画外音解说' || scriptType === '画面故事'
        ? '电影质感'
        : '真实拍摄质感';

    return `${baseStyle}的短视频画面。内容：${scriptContent.slice(0, 200)}。要求：画面细腻真实，光影自然，运镜流畅，色彩温暖，适合社交媒体传播。`;
}
