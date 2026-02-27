// ============================================================
// Messages API — 会话管理 + 消息收发
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { findById, findByUsername } from '@/lib/user-store';
import { getAgent, DEPARTMENTS } from '@/lib/departments';
import { callClaude } from '@/lib/claude';
import {
    getConversationsForUser,
    getConversation,
    findPrivateConversation,
    createConversation,
    addMemberToConversation,
    getMessages,
    sendMessage,
    getUnreadCount,
    markAsRead,
} from '@/lib/message-store';
import type { ConversationMember, Message } from '@/lib/message-store';

function getCurrentUser(request: NextRequest) {
    const authCookie = request.cookies.get('workflow_auth')?.value;
    if (!authCookie) return null;
    const [username] = authCookie.split(':');
    const user = findByUsername(username);
    return user || null;
}

// GET — 获取会话列表或指定会话的消息
export async function GET(request: NextRequest) {
    const user = getCurrentUser(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const userId = user.id;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const conversationId = searchParams.get('conversationId');

    // 获取会话列表
    if (action === 'conversations') {
        const conversations = getConversationsForUser(userId);
        const withUnread = conversations.map(c => ({
            ...c,
            unreadCount: getUnreadCount(c.id, userId),
        }));
        return NextResponse.json({ conversations: withUnread });
    }

    // 获取消息列表
    if (action === 'messages' && conversationId) {
        const conv = getConversation(conversationId);
        if (!conv || !conv.members.some(m => m.id === userId)) {
            return NextResponse.json({ error: '无权访问该会话' }, { status: 403 });
        }
        const limit = parseInt(searchParams.get('limit') || '50');
        const before = searchParams.get('before') || undefined;
        const messages = getMessages(conversationId, limit, before);
        markAsRead(conversationId, userId);
        return NextResponse.json({ messages, conversation: conv });
    }

    // 获取可用联系人（真人用户 + AI 员工）
    if (action === 'contacts') {
        const { getAllUsers } = await import('@/lib/user-store');
        const users = getAllUsers()
            .filter(u => u.id !== userId)
            .map(u => ({
                id: u.id, name: u.name, type: 'user' as const,
                avatar: u.avatar, role: u.role,
            }));

        const aiAgents = DEPARTMENTS.flatMap(d =>
            d.agents.map(a => ({
                id: a.id, name: a.name, type: 'ai' as const,
                avatar: a.avatar, role: a.role, department: d.name,
            }))
        );

        return NextResponse.json({ contacts: [...users, ...aiAgents] });
    }

    return NextResponse.json({ error: '缺少 action 参数' }, { status: 400 });
}

// POST — 创建会话 / 发送消息 / 邀请成员
export async function POST(request: NextRequest) {
    const user = getCurrentUser(request);
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
    const userId = user.id;

    const body = await request.json();
    const action = body.action as string;

    // 创建会话
    if (action === 'create') {
        const { type, name, memberIds } = body as {
            type: 'private' | 'group';
            name?: string;
            memberIds: string[];
        };

        if (!memberIds?.length) {
            return NextResponse.json({ error: '请选择聊天对象' }, { status: 400 });
        }

        // For private chat, check if conversation already exists
        if (type === 'private' && memberIds.length === 1) {
            const existing = findPrivateConversation(userId, memberIds[0]);
            if (existing) return NextResponse.json({ conversation: existing });
        }

        // Build member list
        const members: ConversationMember[] = [{
            id: userId,
            name: user.name,
            type: 'user',
            avatar: user.avatar,
            joinedAt: new Date().toISOString(),
        }];

        for (const memberId of memberIds) {
            // Check if it's a user
            const memberUser = findById(memberId);
            if (memberUser) {
                members.push({
                    id: memberUser.id,
                    name: memberUser.name,
                    type: 'user',
                    avatar: memberUser.avatar,
                    joinedAt: new Date().toISOString(),
                });
                continue;
            }
            // Check if it's an AI agent
            const agent = getAgent(memberId);
            if (agent) {
                members.push({
                    id: agent.id,
                    name: agent.name,
                    type: 'ai',
                    avatar: agent.avatar,
                    joinedAt: new Date().toISOString(),
                });
            }
        }

        const conversation = createConversation({
            type,
            name: name || (type === 'private' ? undefined : `群聊 (${members.length}人)`),
            members,
            createdBy: userId,
        });

        return NextResponse.json({ conversation });
    }

    // 发送消息
    if (action === 'send') {
        const { conversationId, content, attachments } = body as {
            conversationId: string;
            content: string;
            attachments?: { type: 'image' | 'file'; name: string; url: string; size?: number }[];
        };

        if (!conversationId || !content?.trim()) {
            return NextResponse.json({ error: '缺少消息内容' }, { status: 400 });
        }

        const conv = getConversation(conversationId);
        if (!conv || !conv.members.some(m => m.id === userId)) {
            return NextResponse.json({ error: '无权访问该会话' }, { status: 403 });
        }

        // Send user message
        const msg = sendMessage({
            conversationId,
            senderId: userId,
            senderName: user.name,
            senderAvatar: user.avatar,
            senderType: 'user',
            content: content.trim(),
            attachments: attachments?.map(a => ({
                id: `att-${Date.now().toString(36)}`,
                ...a,
            })),
        });

        // Check if any AI agents are in the conversation and should reply
        const aiMembers = conv.members.filter(m => m.type === 'ai');
        const aiReplies: Message[] = [];

        if (aiMembers.length > 0) {
            // Get recent messages for context
            const recentMessages = getMessages(conversationId, 12);

            for (const aiMember of aiMembers) {
                const agent = getAgent(aiMember.id);
                if (!agent) continue;

                const dept = DEPARTMENTS.find(d => d.agents.some(a => a.id === aiMember.id));
                const otherMembers = conv.members.filter(m => m.id !== aiMember.id);

                // Build system prompt
                const isGroup = conv.members.length > 2;
                const systemPrompt = `你是「${agent.name}」，${dept ? `${dept.name}的` : ''}${agent.role}。

## 完整人设
${agent.systemPrompt || agent.personality || ''}

## 你的专长
${agent.capabilities?.join('、') || agent.role}

## 对话环境
${isGroup
                        ? `你在一个群聊中，群里有：${otherMembers.map(m => `${m.name}${m.type === 'ai' ? `（${getAgent(m.id)?.role || 'AI'}）` : '（用户）'}`).join('、')}。`
                        : `你在和${otherMembers[0]?.name || '用户'}私聊。`}

## 对话规则
1. 保持你的人设角色说话
2. 不要说"作为AI"之类的话
3. 用自然的方式交流，保持你的性格特点
4. ${isGroup ? '控制回复在150字以内，简洁参与讨论' : '回复要有深度，展现专业洞察'}
5. 如果用户发的是图片或文件，描述你看到了什么并给出专业意见`;

                // Build message history
                const claudeMessages = recentMessages.map(m => ({
                    role: (m.senderType === 'ai' && m.senderId === aiMember.id ? 'assistant' : 'user') as 'user' | 'assistant',
                    content: m.senderType === 'ai' && m.senderId !== aiMember.id
                        ? `[${m.senderName}]: ${m.content}`
                        : m.senderId === userId
                            ? m.content
                            : `[${m.senderName}]: ${m.content}`,
                }));

                // Ensure last message is from user
                if (claudeMessages.length > 0 && claudeMessages[claudeMessages.length - 1].role !== 'user') {
                    claudeMessages.push({ role: 'user', content: content.trim() });
                }

                try {
                    const reply = await callClaude({
                        system: systemPrompt,
                        messages: claudeMessages.length > 0 ? claudeMessages : [{ role: 'user', content: content.trim() }],
                        temperature: 0.8,
                        maxTokens: isGroup ? 800 : 2000,
                    });

                    const aiMsg = sendMessage({
                        conversationId,
                        senderId: aiMember.id,
                        senderName: agent.name,
                        senderAvatar: agent.avatar,
                        senderType: 'ai',
                        content: reply,
                    });
                    aiReplies.push(aiMsg);
                } catch (err) {
                    console.error(`[Messages] AI reply failed for ${agent.name}:`, err);
                }

                // In group chats with multiple AI, add a small delay feel (but actually sequential)
                if (aiMembers.length > 1) {
                    // Only reply with 1-2 AI agents per turn in groups to feel natural
                    if (aiReplies.length >= 2) break;
                }
            }
        }

        return NextResponse.json({ message: msg, aiReplies });
    }

    // 邀请成员
    if (action === 'invite') {
        const { conversationId, memberId } = body as {
            conversationId: string;
            memberId: string;
        };

        const conv = getConversation(conversationId);
        if (!conv || !conv.members.some(m => m.id === userId)) {
            return NextResponse.json({ error: '无权操作' }, { status: 403 });
        }

        // Build member info
        let member: ConversationMember | null = null;
        const memberUser = findById(memberId);
        if (memberUser) {
            member = {
                id: memberUser.id, name: memberUser.name, type: 'user',
                avatar: memberUser.avatar, joinedAt: new Date().toISOString(),
            };
        } else {
            const agent = getAgent(memberId);
            if (agent) {
                member = {
                    id: agent.id, name: agent.name, type: 'ai',
                    avatar: agent.avatar, joinedAt: new Date().toISOString(),
                };
            }
        }

        if (!member) {
            return NextResponse.json({ error: '未找到该用户或AI员工' }, { status: 404 });
        }

        // If private chat, convert to group
        if (conv.type === 'private') {
            // We need to update the conversation type - for simplicity, add a system message
            const allConvs = (await import('@/lib/message-store')).readConversations();
            const targetConv = allConvs.find(c => c.id === conversationId);
            if (targetConv) {
                targetConv.type = 'group';
                targetConv.name = targetConv.name || `群聊 (${targetConv.members.length + 1}人)`;
                const fs = await import('fs');
                const path = await import('path');
                fs.writeFileSync(
                    path.join(process.cwd(), 'src/data/messages/conversations.json'),
                    JSON.stringify(allConvs, null, 2), 'utf-8'
                );
            }
        }

        addMemberToConversation(conversationId, member);

        // Send system message
        sendMessage({
            conversationId,
            senderId: 'system',
            senderName: '系统',
            senderType: 'user',
            content: `${user.name} 邀请了 ${member.name} 加入聊天`,
        });

        return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
}
