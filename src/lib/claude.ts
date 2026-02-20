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

/** 非流式调用 Claude，返回完整文本 */
export async function callClaude(req: ClaudeRequest): Promise<string> {
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

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

/** 流式调用 Claude，返回 ReadableStream */
export function callClaudeStream(req: ClaudeRequest): ReadableStream {
    const encoder = new TextEncoder();

    return new ReadableStream({
        async start(controller) {
            try {
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
                        stream: true,
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorText })}\n\n`));
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
