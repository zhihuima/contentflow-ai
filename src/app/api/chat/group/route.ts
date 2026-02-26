// API: AI 员工群聊 — 多个 AI 参与讨论
import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/claude';
import { getAgent, DEPARTMENTS } from '@/lib/departments';

interface GroupMessage {
    role: 'user' | 'assistant';
    agentId?: string;
    agentName?: string;
    agentAvatar?: string;
    content: string;
}

export async function POST(request: NextRequest) {
    try {
        const { agentIds, messages, enableSearch } = await request.json() as {
            agentIds: string[];
            messages: GroupMessage[];
            enableSearch?: boolean;
        };

        if (!agentIds?.length || !messages?.length) {
            return NextResponse.json({ error: '缺少参数' }, { status: 400 });
        }

        // 验证所有 agent
        const agents = agentIds.map(id => getAgent(id)).filter(Boolean);
        if (agents.length === 0) {
            return NextResponse.json({ error: '未找到任何有效 AI 员工' }, { status: 404 });
        }

        const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';

        // 联网搜索
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
                        searchContext = '\n\n## 联网搜索结果\n' +
                            results.map((r: { title: string; snippet: string; link: string }, i: number) =>
                                `${i + 1}. **${r.title}**\n   ${r.snippet}\n   来源: ${r.link}`
                            ).join('\n\n');
                    }
                }
            } catch { /* ignore */ }
        }

        // 决定哪个 agent 回复（轮流 + 相关性）
        // 策略：看最后几条消息中谁没说话，或谁的专业最匹配
        const recentAgentIds = messages
            .filter(m => m.role === 'assistant' && m.agentId)
            .slice(-3)
            .map(m => m.agentId);

        // 优先让还没回复过的 agent 说话
        let respondingAgent = agents.find(a => a && !recentAgentIds.includes(a.id));
        if (!respondingAgent) {
            // 所有人都说了，轮到最早说话的那个
            respondingAgent = agents[0]!;
            for (const agent of agents) {
                if (!agent) continue;
                const lastSpoke = [...messages].reverse().findIndex(m => m.agentId === agent.id);
                const otherLast = [...messages].reverse().findIndex(m => m.agentId === respondingAgent!.id);
                if (lastSpoke > otherLast || lastSpoke === -1) {
                    respondingAgent = agent;
                }
            }
        }

        const agent = respondingAgent!;
        const dept = DEPARTMENTS.find(d => d.agents.some(a => a.id === agent.id));
        const otherAgents = agents.filter(a => a && a.id !== agent.id);

        // 构建群聊 system prompt
        const systemPrompt = `你是「${agent.name}」，${dept ? `${dept.name}的` : ''}${agent.role}。

## 完整人设
${agent.systemPrompt || agent.personality || ''}

## 你的专长
${agent.capabilities?.join('、') || agent.role}

## 你的思维方式
${agent.thinkingStyle || ''}

## 你的沟通特点
${agent.communicationTraits?.join('\n') || ''}

## 你的专业偏好
${agent.professionalBias || ''}

## 群聊环境
你正在一个群聊中，群里的其他同事有：${otherAgents.map(a => a ? `${a.name}（${a.role}）` : '').filter(Boolean).join('、')}。

## 群聊规则
1. 保持你的人设角色，用你的专业视角参与讨论
2. 你可以同意、反对、补充其他同事的观点
3. 适当@其他同事的名字来互动
4. 展示你的团队协作能力，但也保持专业独立性
5. 用自然的群聊方式说话，不要太长篇大论（控制在200字以内）
6. 如果之前有同事提过的观点，不要重复，而是补充新的角度
${searchContext ? '\n7. 如果联网搜索有相关信息，自然地引用' : ''}
${searchContext}`;

        // 构建消息历史（群聊格式转为 Claude 格式）
        const claudeMessages = messages.slice(-12).map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.role === 'assistant' && m.agentName
                ? `[${m.agentName}]: ${m.content}`
                : m.content,
        }));

        const result = await callClaude({
            system: systemPrompt,
            messages: claudeMessages,
            temperature: 0.85,
            maxTokens: 1000,
        });

        return NextResponse.json({
            reply: result,
            agentId: agent.id,
            agentName: agent.name,
            agentAvatar: agent.avatar,
            searched: !!searchContext,
        });
    } catch (err: unknown) {
        console.error('[chat/group] Error:', err);
        const message = err instanceof Error ? err.message : '群聊失败';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
