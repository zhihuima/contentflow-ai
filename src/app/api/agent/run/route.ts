// ============================================================
// Multi-Agent 统一 SSE 端点
// ============================================================
import { NextRequest } from 'next/server';
import { registerAllAgents, runOrchestrator } from '@/lib/multi-agent';
import type { AgentContext, AgentEvent } from '@/lib/multi-agent';
import type { CreationMode } from '@/lib/types';
import { sanitizeError } from '@/lib/sanitize-error';

// 确保 Agent 注册（模块级别只执行一次）
let agentsRegistered = false;
function ensureAgents() {
    if (!agentsRegistered) {
        registerAllAgents();
        agentsRegistered = true;
    }
}

export async function POST(req: NextRequest) {
    ensureAgents();

    try {
        const body = await req.json();
        const {
            mode = 'video' as CreationMode,
            userInput = '',
            taskId = `task-${Date.now()}`,
            selectedTopicId,
        } = body;

        if (!userInput.trim()) {
            return new Response(JSON.stringify({ error: '请输入内容' }), { status: 400 });
        }

        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                const events: AgentEvent[] = [];

                const ctx: AgentContext = {
                    taskId,
                    mode,
                    userInput,
                    memory: {},
                    revisionCount: 0,
                    emit: (event: AgentEvent) => {
                        events.push(event);
                        const line = `data: ${JSON.stringify(event)}\n\n`;
                        try {
                            controller.enqueue(encoder.encode(line));
                        } catch {
                            // Stream closed
                        }
                    },
                };

                // 如果用户已选定选题 ID，将其注入 memory
                if (selectedTopicId != null) {
                    ctx.memory.selectedTopicId = selectedTopicId;
                    ctx.memory.needsTopicSelection = false;
                } else {
                    ctx.memory.needsTopicSelection = true;
                }

                try {
                    await runOrchestrator(ctx);
                } catch (err: unknown) {
                    const msg = sanitizeError(err instanceof Error ? err.message : String(err));
                    ctx.emit({
                        type: 'task_error',
                        agentId: 'system',
                        agentName: '系统',
                        message: `出错：${msg}`,
                        timestamp: Date.now(),
                    });
                }

                try {
                    controller.close();
                } catch {
                    // Already closed
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
            },
        });
    } catch (err: unknown) {
        const msg = sanitizeError(err instanceof Error ? err.message : String(err));
        return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }
}
