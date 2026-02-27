// ============================================================
// Message Store — JSON file-based messaging system
// ============================================================
import fs from 'fs';
import path from 'path';

/* ---- Types ---- */
export interface MessageAttachment {
    id: string;
    type: 'image' | 'file';
    name: string;
    url: string;
    size?: number;
}

export interface Message {
    id: string;
    conversationId: string;
    senderId: string;       // user ID or AI agent ID
    senderName: string;
    senderAvatar?: string;
    senderType: 'user' | 'ai';
    content: string;
    attachments?: MessageAttachment[];
    createdAt: string;
    readBy?: string[];      // User IDs who have read the message
}

export interface Conversation {
    id: string;
    type: 'private' | 'group';
    name?: string;          // Group name (null for private chats)
    avatar?: string;
    members: ConversationMember[];
    createdBy: string;
    lastMessage?: string;
    lastMessageAt?: string;
    lastSenderId?: string;
    lastSenderName?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ConversationMember {
    id: string;
    name: string;
    type: 'user' | 'ai';
    avatar?: string;
    joinedAt: string;
}

/* ---- Paths ---- */
const DATA_DIR = path.join(process.cwd(), 'src/data/messages');
const CONVERSATIONS_PATH = path.join(DATA_DIR, 'conversations.json');

function ensureDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

function messagesPath(conversationId: string): string {
    return path.join(DATA_DIR, `${conversationId}.json`);
}

/* ---- Conversations ---- */
export function readConversations(): Conversation[] {
    try {
        if (!fs.existsSync(CONVERSATIONS_PATH)) return [];
        return JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf-8'));
    } catch { return []; }
}

function writeConversations(conversations: Conversation[]) {
    ensureDir();
    fs.writeFileSync(CONVERSATIONS_PATH, JSON.stringify(conversations, null, 2), 'utf-8');
}

export function getConversationsForUser(userId: string): Conversation[] {
    return readConversations()
        .filter(c => c.members.some(m => m.id === userId))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getConversation(conversationId: string): Conversation | undefined {
    return readConversations().find(c => c.id === conversationId);
}

export function findPrivateConversation(userId1: string, userId2: string): Conversation | undefined {
    return readConversations().find(c =>
        c.type === 'private' &&
        c.members.length === 2 &&
        c.members.some(m => m.id === userId1) &&
        c.members.some(m => m.id === userId2)
    );
}

export function createConversation(data: {
    type: 'private' | 'group';
    name?: string;
    members: ConversationMember[];
    createdBy: string;
}): Conversation {
    const conversations = readConversations();
    const now = new Date().toISOString();
    const conv: Conversation = {
        id: `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        type: data.type,
        name: data.name,
        members: data.members,
        createdBy: data.createdBy,
        createdAt: now,
        updatedAt: now,
    };
    conversations.unshift(conv);
    writeConversations(conversations);
    return conv;
}

export function addMemberToConversation(conversationId: string, member: ConversationMember): boolean {
    const conversations = readConversations();
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return false;
    if (conv.members.some(m => m.id === member.id)) return true; // Already a member
    conv.members.push(member);
    conv.updatedAt = new Date().toISOString();
    writeConversations(conversations);
    return true;
}

/* ---- Messages ---- */
export function readMessages(conversationId: string): Message[] {
    try {
        const p = messagesPath(conversationId);
        if (!fs.existsSync(p)) return [];
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch { return []; }
}

function writeMessages(conversationId: string, messages: Message[]) {
    ensureDir();
    fs.writeFileSync(messagesPath(conversationId), JSON.stringify(messages, null, 2), 'utf-8');
}

export function getMessages(conversationId: string, limit = 50, before?: string): Message[] {
    let msgs = readMessages(conversationId);
    if (before) {
        const idx = msgs.findIndex(m => m.id === before);
        if (idx > 0) msgs = msgs.slice(0, idx);
    }
    return msgs.slice(-limit);
}

export function sendMessage(data: {
    conversationId: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    senderType: 'user' | 'ai';
    content: string;
    attachments?: MessageAttachment[];
}): Message {
    const msgs = readMessages(data.conversationId);
    const msg: Message = {
        id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        conversationId: data.conversationId,
        senderId: data.senderId,
        senderName: data.senderName,
        senderAvatar: data.senderAvatar,
        senderType: data.senderType,
        content: data.content,
        attachments: data.attachments,
        createdAt: new Date().toISOString(),
        readBy: [data.senderId],
    };
    msgs.push(msg);
    // Keep max 500 messages per conversation
    if (msgs.length > 500) msgs.splice(0, msgs.length - 500);
    writeMessages(data.conversationId, msgs);

    // Update conversation last message
    const conversations = readConversations();
    const conv = conversations.find(c => c.id === data.conversationId);
    if (conv) {
        conv.lastMessage = data.content.slice(0, 100);
        conv.lastMessageAt = msg.createdAt;
        conv.lastSenderId = data.senderId;
        conv.lastSenderName = data.senderName;
        conv.updatedAt = msg.createdAt;
        writeConversations(conversations);
    }

    return msg;
}

export function getUnreadCount(conversationId: string, userId: string): number {
    const msgs = readMessages(conversationId);
    return msgs.filter(m => m.senderId !== userId && !(m.readBy || []).includes(userId)).length;
}

export function markAsRead(conversationId: string, userId: string): void {
    const msgs = readMessages(conversationId);
    let changed = false;
    for (const msg of msgs) {
        if (msg.senderId !== userId && !(msg.readBy || []).includes(userId)) {
            if (!msg.readBy) msg.readBy = [];
            msg.readBy.push(userId);
            changed = true;
        }
    }
    if (changed) writeMessages(conversationId, msgs);
}
