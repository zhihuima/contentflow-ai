// API: 与 AI 员工一对一对话（带联网搜索能力）
import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/claude';
import { getAgent, DEPARTMENTS } from '@/lib/departments';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export async function POST(request: NextRequest) {
    try {
        const { agentId, messages, enableSearch } = await request.json() as {
            agentId: string;
            messages: ChatMessage[];
            enableSearch?: boolean;
        };

        if (!agentId || !messages?.length) {
            return NextResponse.json({ error: '缺少参数' }, { status: 400 });
        }

        const agent = getAgent(agentId);
        if (!agent) {
            return NextResponse.json({ error: '未找到该 AI 员工' }, { status: 404 });
        }

        const dept = DEPARTMENTS.find(d => d.agents.some(a => a.id === agentId));
        const lastUserMsg = messages[messages.length - 1]?.content || '';

        // 联网搜索：如果启用，先搜索最新信息
        let searchContext = '';
        if (enableSearch && lastUserMsg.length > 3) {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
                const searchRes = await fetch(`${baseUrl}/api/workflow/search`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: lastUserMsg, maxResults: 3 }),
                });
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (searchData.data?.results?.length > 0) {
                        const results = searchData.data.results.slice(0, 3);
                        searchContext = '\n\n## 联网搜索结果（供参考）\n' +
                            results.map((r: { title: string; snippet: string; link: string }, i: number) =>
                                `${i + 1}. **${r.title}**\n   ${r.snippet}\n   来源: ${r.link}`
                            ).join('\n\n');
                    }
                }
            } catch {
                console.log('[chat] Search failed, continuing without search results');
            }
        }

        // 构建该员工的 system prompt（使用 AgentProfile 正确字段）
        const systemPrompt = `你是「${agent.name}」，${dept ? `属于${dept.name}，` : ''}${agent.role}。

## 你的人设
${agent.personality || ''}

## 你的专长
${agent.capabilities?.join('、') || agent.role}

## 你的思维方式
${agent.thinkingStyle || ''}

## 你的沟通特点
${agent.communicationTraits?.join('\n') || ''}

## 你的专业偏好
${agent.professionalBias || ''}

## 对话规则
1. 始终保持你的人设角色说话，用你的专业视角回答问题
2. 不要说"作为AI"之类的话，你就是${agent.name}
3. 用自然的口语化方式交流，保持你的性格特点
4. 如果用户的问题超出你的专业范围，诚实说明并建议他去找更合适的同事
5. 可以适当展示你的专业偏好和观点倾向
${searchContext ? '\n6. 如果下面提供了联网搜索结果，自然地融入你的回答中，引用具体数据而非空泛建议' : ''}
${searchContext}`;

        const result = await callClaude({
            system: systemPrompt,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            temperature: 0.8,
            maxTokens: 2000,
        });

        return NextResponse.json({ reply: result, searched: !!searchContext });
    } catch (err: unknown) {
        console.error('[chat] Error:', err);
        const message = err instanceof Error ? err.message : '对话失败';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
