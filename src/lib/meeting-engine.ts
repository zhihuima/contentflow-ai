// ============================================================
// 会议引擎 — 让 AI 员工像真人一样讨论
// 核心设计：不是轮流发言，而是真正的交锋和协作
// ============================================================

import { callClaude } from '@/lib/claude';
import { getAgent, getAllAgents, getDepartment } from '@/lib/departments';
import type { AgentProfile } from '@/lib/departments';
import type { MeetingMessage, MessageType } from '@/lib/meeting-types';

const MAX_DISCUSSION_ROUNDS = 4;

function genMsgId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// 核心提示构建 — 让每个 AI 员工有真正的"灵魂"
// ============================================================

function buildAgentMeetingPrompt(
    agent: AgentProfile,
    topic: string,
    allParticipants: AgentProfile[],
    previousMessages: MeetingMessage[],
    round: 'first' | 'discussion' | 'final',
): string {
    const dept = getDepartment(agent.departmentId);

    // 构建其他参与者的关系画像
    const otherParticipants = allParticipants
        .filter(p => p.id !== agent.id)
        .map(p => `- ${p.name}（${p.role}，${getDepartment(p.departmentId)?.name}）：${p.personality}`)
        .join('\n');

    // 基于轮次构建历史上下文
    const history = previousMessages.map(m => {
        if (m.agentId === 'user') return `【用户】: ${m.content}`;
        if (m.agentId === 'moderator') return `【主持人】: ${m.content}`;
        const speaker = getAgent(m.agentId);
        return `【${m.agentName}（${speaker?.role || ''}）】: ${m.content}`;
    }).join('\n\n');

    // 不同轮次的行为指令
    let roundInstruction = '';
    if (round === 'first') {
        roundInstruction = `## 当前是第一轮发言
这是你第一次就这个议题发表看法。请：
- 从你的专业角度提出核心观点
- 如果你对这个方向有顾虑，直接说出来
- 可以引用你专业领域的经验或案例
- 不要面面俱到，聚焦你最有发言权的1-2个点`;
    } else if (round === 'discussion') {
        roundInstruction = `## 当前是自由讨论环节
你已经听了其他人的发言。请：
- 不要简单重复自己说过的话
- 如果你同意某人的观点，具体说明为什么，并在此基础上延伸
- 如果你不同意某人的观点，直接挑战它——用你的专业知识和逻辑来反驳
- 你可以对某个人的观点提出追问："小X，你说的XXX我有个疑问..."
- 可以建议具体的行动方案
- 不要为了和谐而隐藏分歧，真正的好方案来自充分的辩论

### 你可能的互动方式：
1. 直接反驳："我不太同意XX的看法，因为..."
2. 补充完善："XX说得有道理，不过我想补充一个角度..."
3. 提出质疑："XX提到的数据我有个疑问..."
4. 跨界联想："结合XX说的和我的经验，我觉得可以..."
5. 推进方案："综合大家的意见，我建议我们..."`;
    } else {
        roundInstruction = `## 当前是最终轮总结
会议即将结束。请：
- 总结你认为最重要的共识和分歧
- 提出你认为最应该落地的1-2个具体行动
- 可以承认被其他人说服而改变了看法
- 对遗留的分歧给出你的最终立场`;
    }

    return `${agent.systemPrompt}

## 你在本次会议中的角色
你是 ${dept?.name} 的 ${agent.role}「${agent.name}」。

## 你的沟通特点
${agent.communicationTraits.map(t => `- ${t}`).join('\n')}

## 你的专业偏见（你下意识会这样想）
${agent.professionalBias}

## 你的盲区（你可能会忽略）
${agent.blindSpots}

## 本次会议的其他参与者
${otherParticipants}

## 会议主题
${topic}

## 会议记录
${history || '（暂无发言）'}

${roundInstruction}

## 输出要求
- 用第一人称说话，像真人开会一样自然
- 150字以内，精炼有力
- 可以直接用名字称呼其他参与者
- 有观点有态度，不要平庸的废话
- 只输出你的发言内容，不要加角色标签或额外格式`;
}

// ============================================================
// 智能选人逻辑 — 不是轮流，而是基于讨论热点
// ============================================================

function selectNextSpeakers(
    participants: AgentProfile[],
    messages: MeetingMessage[],
    round: number,
): AgentProfile[] {
    if (participants.length <= 2) return participants;

    // 分析谁被提及了（应该回应）
    const lastMessages = messages.slice(-3);
    const mentionedAgents = new Set<string>();
    const agentNames = new Map(participants.map(p => [p.name, p.id]));

    for (const msg of lastMessages) {
        for (const [name, id] of agentNames) {
            if (msg.content.includes(name) && msg.agentId !== id) {
                mentionedAgents.add(id);
            }
        }
    }

    // 统计发言次数
    const speakCounts = new Map<string, number>();
    for (const msg of messages) {
        if (msg.agentId !== 'moderator' && msg.agentId !== 'user') {
            speakCounts.set(msg.agentId, (speakCounts.get(msg.agentId) || 0) + 1);
        }
    }

    // 优先级：被提到的 > 发言少的 > 随机
    const priority = [...participants].sort((a, b) => {
        const aMentioned = mentionedAgents.has(a.id) ? -10 : 0;
        const bMentioned = mentionedAgents.has(b.id) ? -10 : 0;
        const aCount = speakCounts.get(a.id) || 0;
        const bCount = speakCounts.get(b.id) || 0;
        return (aMentioned + aCount) - (bMentioned + bCount);
    });

    // 每轮 1-2 人
    const count = round < 2 ? 2 : 1;
    return priority.slice(0, Math.min(count, priority.length));
}

// ============================================================
// 会议主持人 — 不是走形式，而是真正引导讨论
// ============================================================

async function generateModeratorTransition(
    topic: string,
    messages: MeetingMessage[],
    nextSpeakers: AgentProfile[],
): Promise<string> {
    const history = messages.slice(-4).map(m =>
        `${m.agentName}: ${m.content.substring(0, 80)}...`
    ).join('\n');

    try {
        const response = await callClaude({
            system: `你是一位优秀的会议主持人。你的任务是根据讨论进展自然地推进话题。不要客套，直接引导。

当前讨论记录摘要：
${history}

请用30字以内做一句简短的过渡引导（例如点评一下分歧点、引出新的讨论角），接下来将由${nextSpeakers.map(s => s.name).join('和')}发言。
不要写"请XXX发言"这种机械的话，而是像真正的主持人一样引导话题方向。`,
            messages: [{ role: 'user', content: `会议主题：${topic}` }],
            temperature: 0.7,
            maxTokens: 100,
        });
        return response.trim();
    } catch {
        return `关于"${topic}"，还有一些角度值得探讨。`;
    }
}

// ============================================================
// 会议纪要生成 — 抓住真正的分歧和共识
// ============================================================

function buildSummaryPrompt(topic: string, messages: MeetingMessage[]): string {
    const history = messages
        .filter(m => m.agentId !== 'moderator')
        .map(m => {
            const agent = getAgent(m.agentId);
            const label = m.agentId === 'user' ? '【用户】' : `【${m.agentName}·${agent?.role || ''}】`;
            return `${label}: ${m.content}`;
        }).join('\n\n');

    return `你是会议纪要撰写者。请分析以下讨论记录，提炼出真正有价值的内容。

## 会议主题
${topic}

## 讨论全文
${history}

## 纪要要求
请把讨论中的关键内容提炼为结构化纪要。注意：
1. 「核心共识」— 只记录大家真正达成一致的结论（不是所有人说过的话）
2. 「关键分歧」— 记录尚未解决的意见分歧（说清楚谁持什么立场）
3. 「行动建议」— 从讨论中推导出的具体下一步（说清楚建议谁负责什么）
4. 「亮点观点」— 讨论中最有价值的1-2个洞见

## 输出格式 — 严格 JSON
{
  "keyPoints": ["共识1", "共识2"],
  "disagreements": ["分歧1：XX认为...但XX认为...", "分歧2"],
  "actionItems": [
    { "assignee": "员工名", "task": "具体任务" }
  ],
  "highlights": ["亮点观点1", "亮点观点2"],
  "nextSteps": ["下一步1", "下一步2"],
  "closing": "总结发言（50字以内，点评这次讨论的价值）"
}`;
}

// ============================================================
// 主流程 — 异步生成器
// ============================================================

export interface MeetingYieldEvent {
    type: 'message' | 'summary' | 'end';
    message?: MeetingMessage;
    summary?: {
        keyPoints: string[];
        disagreements?: string[];
        actionItems: { assignee: string; task: string }[];
        highlights?: string[];
        nextSteps: string[];
        closing: string;
    };
}

export async function* runMeeting(
    topic: string,
    participantIds: string[],
    userContext?: string,
): AsyncGenerator<MeetingYieldEvent> {
    const participants = participantIds
        .map(id => getAgent(id))
        .filter((a): a is AgentProfile => !!a);

    if (participants.length === 0) return;

    const messages: MeetingMessage[] = [];

    // ---- 0. 用户补充上下文 ----
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

    // ---- 1. 主持人开场（自然、有引导性） ----
    const deptNames = [...new Set(participants.map(p => getDepartment(p.departmentId)?.name))].filter(Boolean);
    const isCrossDept = deptNames.length > 1;

    const openingMsg: MeetingMessage = {
        id: genMsgId(),
        agentId: 'moderator',
        agentName: '会议主持人',
        agentAvatar: '🎙️',
        agentColor: '#6366f1',
        content: isCrossDept
            ? `今天的议题是「${topic}」，我们邀请了来自${deptNames.join('、')}的同事一起讨论。各位从自己的专业角度出发，有不同意见直接说，我们需要的是真正的碰撞，不是客气话。${participants[0].name}，你先开始。`
            : `今天的议题是「${topic}」。${participants.map(p => p.name).join('、')}，大家各抒己见。如果观点有分歧不要回避,好的方案都是吵出来的。${participants[0].name}，请。`,
        timestamp: Date.now(),
        type: 'moderator',
    };
    messages.push(openingMsg);
    yield { type: 'message', message: openingMsg };

    // ---- 2. 第一轮：每人表态（带独立观点） ----
    for (const agent of participants) {
        const prompt = buildAgentMeetingPrompt(agent, topic, participants, messages, 'first');
        try {
            const content = await callClaude({
                system: prompt,
                messages: [{ role: 'user', content: `请从你${agent.role}的专业角度发表你的核心看法。` }],
                temperature: 0.85,
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

    // ---- 3. 自由讨论（真正的交锋） ----
    for (let round = 0; round < MAX_DISCUSSION_ROUNDS; round++) {
        const nextSpeakers = selectNextSpeakers(participants, messages, round);

        // 中间轮次插入主持人过渡引导
        if (round > 0 && round < MAX_DISCUSSION_ROUNDS - 1) {
            const transition = await generateModeratorTransition(topic, messages, nextSpeakers);
            const transMsg: MeetingMessage = {
                id: genMsgId(),
                agentId: 'moderator',
                agentName: '会议主持人',
                agentAvatar: '🎙️',
                agentColor: '#6366f1',
                content: transition,
                timestamp: Date.now(),
                type: 'moderator',
            };
            messages.push(transMsg);
            yield { type: 'message', message: transMsg };
        }

        for (const agent of nextSpeakers) {
            const isLastRound = round === MAX_DISCUSSION_ROUNDS - 1;
            const roundType = isLastRound ? 'final' : 'discussion';
            const prompt = buildAgentMeetingPrompt(agent, topic, participants, messages, roundType);

            try {
                const content = await callClaude({
                    system: prompt,
                    messages: [{
                        role: 'user', content: isLastRound
                            ? '会议即将结束，请给出你的最终观点和行动建议。'
                            : '请回应其他人的观点,表达你的立场。'
                    }],
                    temperature: 0.88,
                    maxTokens: 450,
                });

                // 智能判断消息类型
                const contentLower = content.toLowerCase();
                let msgType: MessageType = 'suggestion';
                if (contentLower.includes('不同意') || contentLower.includes('不太认同') ||
                    contentLower.includes('有不同看法') || contentLower.includes('但是') ||
                    contentLower.includes('我反对') || contentLower.includes('我质疑')) {
                    msgType = 'reply';
                } else if (contentLower.includes('同意') || contentLower.includes('补充') ||
                    contentLower.includes('说得对') || contentLower.includes('有道理')) {
                    msgType = 'suggestion';
                } else if (contentLower.includes('？') || contentLower.includes('为什么') ||
                    contentLower.includes('怎么看')) {
                    msgType = 'question';
                }

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

    // ---- 4. 会议纪要（抓核心、不走形式） ----
    try {
        const summaryPrompt = buildSummaryPrompt(topic, messages);
        const summaryRaw = await callClaude({
            system: summaryPrompt,
            messages: [{ role: 'user', content: '请生成会议纪要。' }],
            temperature: 0.3,
            maxTokens: 1200,
        });

        let summaryData;
        try {
            const jsonMatch = summaryRaw.match(/\{[\s\S]*\}/);
            summaryData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch { summaryData = null; }

        if (summaryData) {
            const closingMsg: MeetingMessage = {
                id: genMsgId(),
                agentId: 'moderator',
                agentName: '会议主持人',
                agentAvatar: '🎙️',
                agentColor: '#6366f1',
                content: summaryData.closing || '感谢各位的坦诚讨论，这次碰撞很有价值。',
                timestamp: Date.now(),
                type: 'summary',
            };
            messages.push(closingMsg);
            yield { type: 'message', message: closingMsg };
            yield { type: 'summary', summary: summaryData };
        }
    } catch (err) {
        console.error('[Meeting] Summary failed:', err);
    }

    yield { type: 'end' };
}
