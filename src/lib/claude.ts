// ============================================================
// Claude API 封装 — 流式 + 非流式调用
// ============================================================

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const API_URL = 'https://api.anthropic.com/v1/messages';

export interface ClaudeMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ClaudeRequest {
    system: string;
    messages: ClaudeMessage[];
    maxTokens?: number;
    temperature?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // 2s, 4s, 8s exponential backoff

function isRetryableStatus(status: number): boolean {
    return status === 429 || status === 529;
}

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/** 非流式调用 Claude，返回完整文本（含自动重试） */
export async function callClaude(req: ClaudeRequest): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
            const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            console.log(`[Claude] 第 ${attempt} 次重试，等待 ${delay}ms...`);
            await sleep(delay);
        }

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: req.maxTokens || 4096,
                temperature: req.temperature ?? 0.7,
                system: req.system,
                messages: req.messages,
            }),
        });

        if (response.ok) {
            const data = await response.json();
            return data.content[0].text;
        }

        const errorText = await response.text();
        lastError = new Error(`Claude API error: ${response.status} ${errorText}`);

        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
            console.warn(`[Claude] ${response.status} 过载，准备重试...`);
            continue;
        }

        throw lastError;
    }

    throw lastError || new Error('Claude API: 未知错误');
}

/** 流式调用 Claude，返回 ReadableStream */
export function callClaudeStream(req: ClaudeRequest): ReadableStream {
    const encoder = new TextEncoder();

    return new ReadableStream({
        async start(controller) {
            try {
                let response: Response | null = null;
                let lastErrorText = '';

                for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                    if (attempt > 0) {
                        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
                        console.log(`[Claude Stream] 第 ${attempt} 次重试，等待 ${delay}ms...`);
                        await sleep(delay);
                    }

                    response = await fetch(API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': ANTHROPIC_API_KEY,
                            'anthropic-version': '2023-06-01',
                        },
                        body: JSON.stringify({
                            model: 'claude-sonnet-4-20250514',
                            max_tokens: req.maxTokens || 4096,
                            temperature: req.temperature ?? 0.7,
                            system: req.system,
                            messages: req.messages,
                            stream: true,
                        }),
                    });

                    if (response.ok) break;

                    lastErrorText = await response.text();
                    if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
                        console.warn(`[Claude Stream] ${response.status} 过载，准备重试...`);
                        continue;
                    }

                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: lastErrorText })}\n\n`));
                    controller.close();
                    return;
                }

                if (!response || !response.ok) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: lastErrorText || '未知错误' })}\n\n`));
                    controller.close();
                    return;
                }

                const reader = response.body!.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;
                            try {
                                const parsed = JSON.parse(data);
                                if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                                    controller.enqueue(
                                        encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`)
                                    );
                                }
                                if (parsed.type === 'message_stop') {
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                                }
                            } catch {
                                // skip non-JSON lines
                            }
                        }
                    }
                }

                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                controller.close();
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
                controller.close();
            }
        },
    });
}
