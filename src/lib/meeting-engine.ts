// ============================================================
// 会议引擎 — 控制 AI 员工讨论的核心逻辑
// ============================================================

import { callClaude } from '@/lib/claude';
import { getAgent } from '@/lib/departments';
import type { AgentProfile } from '@/lib/departments';
import type { MeetingMessage, MessageType } from '@/lib/meeting-types';

const MAX_DISCUSSION_ROUNDS = 3;

/** 生成消息 ID */
function genMsgId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 构建 AI 员工发言的系统提示 */
function buildAgentMeetingPrompt(agent: AgentProfile, topic: string, previousMessages: MeetingMessage[]): string {
    const history = previousMessages.map(m => {
        const label = m.type === 'user_input' ? '【用户】' : `【${m.agentName} · ${getAgent(m.agentId)?.role || ''}】`;
        return `${label}: ${m.content}`;
    }).join('\n\n');

    return `${agent.systemPrompt}

## 当前会议
主题：${topic}

## 会议记录
${history || '（暂无发言，你是第一个发言者）'}

## 你的任务
请从你的专业角度（${agent.role}）对会议主题发表看法。要求：
1. 回应其他参与者的观点（如果有），可以同意、补充或提出不同看法
2. 提出你的专业建议
3. 保持简洁（150字以内），像真实会议中的发言
4. 用第一人称表达
5. 如果有具体的数据或案例支撑，可以举例

只输出你的发言内容，不要加任何前缀或角色标签。`;
}

/** 构建主持人总结提示 */
function buildSummaryPrompt(topic: string, messages: MeetingMessage[]): string {
    const history = messages.map(m => {
        const label = m.type === 'user_input' ? '【用户】' : `【${m.agentName}】`;
        return `${label}: ${m.content}`;
    }).join('\n\n');

    return `你是会议主持人，请对以下会议进行总结。

## 会议主题
${topic}

## 会议讨论记录
${history}

## 输出格式
请严格输出 JSON：
{
  "keyPoints": ["要点1", "要点2", ...],
  "decisions": ["决策1", "决策2", ...],
  "actionItems": [
    { "assignee": "员工名", "task": "具体任务" }
  ],
  "nextSteps": ["下一步1", "下一步2", ...],
  "closing": "总结发言（50字以内）"
}`;
}

export interface MeetingYieldEvent {
    type: 'message' | 'summary' | 'end';
    message?: MeetingMessage;
    summary?: {
        keyPoints: string[];
        decisions: string[];
        actionItems: { assignee: string; task: string }[];
        nextSteps: string[];
        closing: string;
    };
}

/**
 * 运行会议 — 异步生成器，逐步 yield 每条消息
 */
export async function* runMeeting(
    topic: string,
    participantIds: string[],
    userContext?: string,
): AsyncGenerator<MeetingYieldEvent> {
    const participants = participantIds
        .map(id => getAgent(id))
        .filter((a): a is AgentProfile => !!a);

    if (participants.length === 0) {
        return;
    }

    const messages: MeetingMessage[] = [];

    // ---- 0. 用户输入（如果有） ----
    if (userContext) {
        const userMsg: MeetingMessage = {
            id: genMsgId(),
            agentId: 'user',
            agentName: '用户',
            agentAvatar: '👤',
            agentColor: '#64748b',
            content: userContext,
            timestamp: Date.now(),
            type: 'user_input',
        };
        messages.push(userMsg);
        yield { type: 'message', message: userMsg };
    }

    // ---- 1. 主持人开场 ----
    const moderatorOpening: MeetingMessage = {
        id: genMsgId(),
        agentId: 'moderator',
        agentName: '会议主持人',
        agentAvatar: '🎙️',
        agentColor: '#6366f1',
        content: `大家好！今天的会议主题是「${topic}」。我们邀请了${participants.map(p => p.name).join('、')}参与讨论。现在请各位依次发表看法。`,
        timestamp: Date.now(),
        type: 'moderator',
    };
    messages.push(moderatorOpening);
    yield { type: 'message', message: moderatorOpening };

    // ---- 2. 第一轮：每人依次发言 ----
    for (const agent of participants) {
        const prompt = buildAgentMeetingPrompt(agent, topic, messages);
        try {
            const content = await callClaude({
                system: prompt,
                messages: [{ role: 'user', content: `请从${agent.role}的角度发表你的看法。` }],
                temperature: 0.8,
                maxTokens: 500,
            });

            const msg: MeetingMessage = {
                id: genMsgId(),
                agentId: agent.id,
                agentName: agent.name,
                agentAvatar: agent.avatar,
                agentColor: agent.color,
                content: content.trim(),
                timestamp: Date.now(),
                type: 'opinion',
            };
            messages.push(msg);
            yield { type: 'message', message: msg };
        } catch (err) {
            console.error(`[Meeting] Agent ${agent.name} failed:`, err);
        }
    }

    // ---- 3. 自由讨论轮次 ----
    for (let round = 0; round < MAX_DISCUSSION_ROUNDS; round++) {
        // 选择 1-2 个人进行回应（轮转 + 随机）
        const responders = selectResponders(participants, messages, round);

        for (const agent of responders) {
            const prompt = buildAgentMeetingPrompt(agent, topic, messages);
            try {
                const content = await callClaude({
                    system: prompt,
                    messages: [{ role: 'user', content: '请回应其他人的观点，补充你的看法或提出不同意见。' }],
                    temperature: 0.85,
                    maxTokens: 400,
                });

                const msgType: MessageType = content.includes('不同意') || content.includes('不过') || content.includes('但是')
                    ? 'reply'
                    : 'suggestion';

                const msg: MeetingMessage = {
                    id: genMsgId(),
                    agentId: agent.id,
                    agentName: agent.name,
                    agentAvatar: agent.avatar,
                    agentColor: agent.color,
                    content: content.trim(),
                    timestamp: Date.now(),
                    type: msgType,
                };
                messages.push(msg);
                yield { type: 'message', message: msg };
            } catch (err) {
                console.error(`[Meeting] Discussion round ${round}, agent ${agent.name} failed:`, err);
            }
        }
    }

    // ---- 4. 主持人总结 ----
    try {
        const summaryPrompt = buildSummaryPrompt(topic, messages);
        const summaryRaw = await callClaude({
            system: summaryPrompt,
            messages: [{ role: 'user', content: '请总结此次会议。' }],
            temperature: 0.3,
            maxTokens: 1000,
        });

        // 尝试解析 JSON
        let summaryData;
        try {
            const jsonMatch = summaryRaw.match(/\{[\s\S]*\}/);
            summaryData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch {
            summaryData = null;
        }

        if (summaryData) {
            // 总结发言
            const summaryMsg: MeetingMessage = {
                id: genMsgId(),
                agentId: 'moderator',
                agentName: '会议主持人',
                agentAvatar: '🎙️',
                agentColor: '#6366f1',
                content: summaryData.closing || '感谢大家的讨论，以上就是本次会议的总结。',
                timestamp: Date.now(),
                type: 'summary',
            };
            messages.push(summaryMsg);
            yield { type: 'message', message: summaryMsg };
            yield { type: 'summary', summary: summaryData };
        }
    } catch (err) {
        console.error('[Meeting] Summary failed:', err);
    }

    yield { type: 'end' };
}

/** 选择讨论回应者（避免同一人连续发言太多） */
function selectResponders(
    participants: AgentProfile[],
    messages: MeetingMessage[],
    round: number,
): AgentProfile[] {
    // 统计每人发言次数
    const counts = new Map<string, number>();
    for (const msg of messages) {
        if (msg.agentId !== 'moderator' && msg.agentId !== 'user') {
            counts.set(msg.agentId, (counts.get(msg.agentId) || 0) + 1);
        }
    }

    // 优先让发言少的人回应
    const sorted = [...participants].sort((a, b) =>
        (counts.get(a.id) || 0) - (counts.get(b.id) || 0)
    );

    // 每轮选 1-2 人
    const count = Math.min(2, sorted.length);
    const selected = sorted.slice(0, count);

    // 最后一轮让所有人都有机会
    if (round === MAX_DISCUSSION_ROUNDS - 1 && sorted.length > 2) {
        return [sorted[0]];
    }

    return selected;
}
