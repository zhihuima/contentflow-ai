// ============================================================
// 即梦 (Jimeng) 视频生成 API 客户端
// 复用 volcengine-image.ts 的 V4 签名逻辑
// ============================================================

import crypto from 'crypto';

// 与 volcengine-image.ts 使用相同环境变量（Zeabur 已配置）
const VOLC_ACCESS_KEY = process.env.VOLC_ACCESS_KEY_ID || '';
const VOLC_SECRET_KEY = process.env.VOLC_SECRET_ACCESS_KEY || '';

const SERVICE = 'cv';
const REGION = 'cn-north-1';
const HOST = 'visual.volcengineapi.com';
const API_VERSION = '2022-08-31';

// ---- VolcEngine V4 签名（与 volcengine-image.ts 相同） ----

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
    return hmacSha256(kService, 'request');
}

function signRequest(action: string, body: string) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateStamp = amzDate.slice(0, 8);

    const queryString = `Action=${action}&Version=${API_VERSION}`;
    const url = `https://${HOST}?${queryString}`;

    const contentType = 'application/json';
    const payloadHash = sha256Hex(body);

    const canonicalHeaders = [
        `content-type:${contentType}`,
        `host:${HOST}`,
        `x-content-sha256:${payloadHash}`,
        `x-date:${amzDate}`,
    ].join('\n') + '\n';

    const signedHeaders = 'content-type;host;x-content-sha256;x-date';

    const canonicalRequest = [
        'POST',
        '/',
        queryString,
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/request`;
    const stringToSign = [
        'HMAC-SHA256',
        amzDate,
        credentialScope,
        sha256Hex(canonicalRequest),
    ].join('\n');

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

// ============================================================
// 文生视频 — 提交异步任务
// ============================================================

export interface VideoGenRequest {
    prompt: string;
    duration?: 5 | 10;
    ratio?: '16:9' | '9:16' | '1:1';
}

export interface VideoGenTaskResponse {
    taskId: string;
    status: string;
}

export async function submitVideoGenTask(req: VideoGenRequest): Promise<VideoGenTaskResponse> {
    const { prompt, duration = 5, ratio = '16:9' } = req;

    const reqKey = duration <= 5 ? 'jimeng_video_generation' : 'jimeng_video_generation_10s';

    const requestBody = JSON.stringify({
        req_key: reqKey,
        prompt,
        video_gen_params: {
            duration,
            aspect_ratio: ratio,
        },
    });

    console.log(`[Jimeng Video] Submitting task: "${prompt.slice(0, 80)}..." (${duration}s, ${ratio})`);

    const signed = signRequest('CVSync2AsyncSubmitTask', requestBody);

    const response = await fetch(signed.url, {
        method: 'POST',
        headers: signed.headers,
        body: signed.body,
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error(`[Jimeng Video] API error ${response.status}: ${errText.slice(0, 500)}`);
        throw new Error(`即梦 API 错误 (${response.status}): ${errText.slice(0, 200)}`);
    }

    const result = await response.json() as {
        code: number;
        message: string;
        data?: { task_id: string };
    };

    if (result.code !== 10000 && result.code !== 0) {
        throw new Error(`即梦 API 业务错误: ${result.message || JSON.stringify(result)}`);
    }

    console.log(`[Jimeng Video] Task submitted: ${result.data?.task_id}`);

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
    const requestBody = JSON.stringify({
        req_key: 'jimeng_video_generation',
        task_id: taskId,
    });

    const signed = signRequest('CVSync2AsyncGetResult', requestBody);

    const response = await fetch(signed.url, {
        method: 'POST',
        headers: signed.headers,
        body: signed.body,
    });

    if (!response.ok) {
        const errText = await response.text();
        return { status: 'failed', error: `API 错误 (${response.status}): ${errText.slice(0, 200)}` };
    }

    const result = await response.json() as {
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
