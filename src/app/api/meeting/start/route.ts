// ============================================================
// 会议 API — SSE 流式输出会议讨论过程
// ============================================================

import { NextRequest } from 'next/server';
import { runMeeting } from '@/lib/meeting-engine';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { topic, participantIds, userContext } = body;

        if (!topic || !participantIds || participantIds.length === 0) {
            return new Response(JSON.stringify({ error: '缺少会议主题或参与者' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // SSE 流
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const event of runMeeting(topic, participantIds, userContext)) {
                        const data = JSON.stringify(event);
                        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                    }
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                } catch (err) {
                    console.error('[Meeting API] Error:', err);
                    const errorEvent = JSON.stringify({ type: 'error', message: String(err) });
                    controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (err) {
        console.error('[Meeting API] Parse error:', err);
        return new Response(JSON.stringify({ error: '请求解析失败' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
