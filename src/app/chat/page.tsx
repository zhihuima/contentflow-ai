'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import {
    Search, Send, ArrowLeft, Plus, Users, UserPlus, Image as ImageIcon,
    Paperclip, X, Loader2, MessageCircle, ChevronRight, Bot, User,
    Smile, MoreHorizontal, Check, CheckCheck,
} from 'lucide-react';

interface ConversationMember {
    id: string;
    name: string;
    type: 'user' | 'ai';
    avatar?: string;
}

interface Conversation {
    id: string;
    type: 'private' | 'group';
    name?: string;
    members: ConversationMember[];
    lastMessage?: string;
    lastMessageAt?: string;
    lastSenderName?: string;
    unreadCount?: number;
    updatedAt: string;
}

interface MessageAttachment {
    id: string;
    type: 'image' | 'file';
    name: string;
    url: string;
    size?: number;
}

interface Message {
    id: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    senderType: 'user' | 'ai';
    content: string;
    attachments?: MessageAttachment[];
    createdAt: string;
}

interface Contact {
    id: string;
    name: string;
    type: 'user' | 'ai';
    avatar?: string;
    role?: string;
    department?: string;
}

export default function ChatPage() {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConv, setActiveConv] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [currentUserId, setCurrentUserId] = useState('');

    // UI states
    const [showNewChat, setShowNewChat] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [isGroup, setIsGroup] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [showMobile, setShowMobile] = useState<'list' | 'chat'>('list');

    // File upload
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    // Load current user
    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(d => { if (d.user) setCurrentUserId(d.user.id); })
            .catch(() => { });
    }, []);

    // Load conversations
    useEffect(() => {
        loadConversations();
        // Poll for new messages every 3 seconds
        pollRef.current = setInterval(loadConversations, 3000);
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    // Auto-scroll messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadConversations = async () => {
        try {
            const res = await fetch('/api/messages?action=conversations');
            const data = await res.json();
            if (data.conversations) {
                setConversations(data.conversations);
            }
        } catch { /* ignore */ }
        setLoading(false);
    };

    const loadMessages = async (convId: string) => {
        try {
            const res = await fetch(`/api/messages?action=messages&conversationId=${convId}`);
            const data = await res.json();
            if (data.messages) setMessages(data.messages);
            if (data.conversation) setActiveConv(data.conversation);
        } catch { /* ignore */ }
    };

    const loadContacts = async () => {
        try {
            const res = await fetch('/api/messages?action=contacts');
            const data = await res.json();
            if (data.contacts) setContacts(data.contacts);
        } catch { /* ignore */ }
    };

    const openConversation = async (conv: Conversation) => {
        setActiveConv(conv);
        setShowMobile('chat');
        await loadMessages(conv.id);
        // Refresh conversation list to update unread
        loadConversations();
    };

    const handleSend = async (e?: FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() || !activeConv || sending) return;

        const text = inputText.trim();
        setInputText('');
        setSending(true);

        // Optimistic update
        const tempMsg: Message = {
            id: `temp-${Date.now()}`,
            conversationId: activeConv.id,
            senderId: currentUserId,
            senderName: '我',
            senderType: 'user',
            content: text,
            createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, tempMsg]);

        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'send',
                    conversationId: activeConv.id,
                    content: text,
                }),
            });
            const data = await res.json();
            if (data.message) {
                // Replace temp message with real one, add any AI replies
                setMessages(prev => {
                    const filtered = prev.filter(m => m.id !== tempMsg.id);
                    const newMsgs = [data.message, ...(data.aiReplies || [])];
                    return [...filtered, ...newMsgs];
                });
            }
            loadConversations();
        } catch { /* ignore */ }
        setSending(false);
    };

    const handleFileUpload = async (files: FileList | null, type: 'image' | 'file') => {
        if (!files?.length || !activeConv) return;
        const file = files[0];

        // For images, create a data URL preview
        if (type === 'image') {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const dataUrl = e.target?.result as string;
                setSending(true);
                try {
                    const res = await fetch('/api/messages', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'send',
                            conversationId: activeConv.id,
                            content: `[图片] ${file.name}`,
                            attachments: [{
                                type: 'image',
                                name: file.name,
                                url: dataUrl,
                                size: file.size,
                            }],
                        }),
                    });
                    const data = await res.json();
                    if (data.message) {
                        setMessages(prev => [...prev, data.message, ...(data.aiReplies || [])]);
                    }
                } catch { /* ignore */ }
                setSending(false);
            };
            reader.readAsDataURL(file);
        } else {
            // For files, send file info
            setSending(true);
            try {
                const res = await fetch('/api/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'send',
                        conversationId: activeConv.id,
                        content: `[文件] ${file.name} (${(file.size / 1024).toFixed(1)}KB)`,
                        attachments: [{
                            type: 'file',
                            name: file.name,
                            url: '#',
                            size: file.size,
                        }],
                    }),
                });
                const data = await res.json();
                if (data.message) {
                    setMessages(prev => [...prev, data.message, ...(data.aiReplies || [])]);
                }
            } catch { /* ignore */ }
            setSending(false);
        }
    };

    // Create new conversation
    const createNewConversation = async () => {
        if (selectedContacts.length === 0) return;

        const type = isGroup || selectedContacts.length > 1 ? 'group' : 'private';

        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    type,
                    name: groupName.trim() || undefined,
                    memberIds: selectedContacts,
                }),
            });
            const data = await res.json();
            if (data.conversation) {
                setShowNewChat(false);
                setSelectedContacts([]);
                setGroupName('');
                setIsGroup(false);
                await loadConversations();
                openConversation(data.conversation);
            }
        } catch { /* ignore */ }
    };

    // Invite member to current conversation
    const inviteMember = async (memberId: string) => {
        if (!activeConv) return;
        try {
            await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'invite',
                    conversationId: activeConv.id,
                    memberId,
                }),
            });
            await loadMessages(activeConv.id);
            setShowInvite(false);
        } catch { /* ignore */ }
    };

    // Poll for new messages in active conversation
    useEffect(() => {
        if (!activeConv) return;
        const interval = setInterval(() => loadMessages(activeConv.id), 3000);
        return () => clearInterval(interval);
    }, [activeConv?.id]);

    const toggleContact = (id: string) => {
        setSelectedContacts(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const getConversationName = (conv: Conversation) => {
        if (conv.name) return conv.name;
        if (conv.type === 'private') {
            const other = conv.members.find(m => m.id !== currentUserId);
            return other?.name || '私聊';
        }
        return conv.members.map(m => m.name).join(', ');
    };

    const getConversationAvatar = (conv: Conversation) => {
        if (conv.type === 'group') return null; // Use group icon
        const other = conv.members.find(m => m.id !== currentUserId);
        return other;
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
        if (diff < 86400000) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        return `${d.getMonth() + 1}/${d.getDate()}`;
    };

    const filteredContacts = contacts.filter(c =>
        !searchQuery || c.name.includes(searchQuery) || c.department?.includes(searchQuery)
    );

    // ============ RENDER ============
    return (
        <div style={{
            display: 'flex', height: 'calc(100vh - 60px)', maxWidth: 1200, margin: '0 auto',
            background: 'var(--bg-primary, #fff)', borderRadius: '16px 16px 0 0',
            border: '1px solid var(--border-light, #e2e8f0)', overflow: 'hidden',
            marginTop: 8,
        }}>
            {/* === Left: Conversation List === */}
            <div style={{
                width: 340, borderRight: '1px solid var(--border-light, #e2e8f0)',
                display: 'flex', flexDirection: 'column',
                ...(showMobile === 'chat' ? { display: 'none' } : {}),
            }}
                className="chat-sidebar"
            >
                {/* Header */}
                <div style={{
                    padding: '16px 16px 12px', borderBottom: '1px solid var(--border-light, #e2e8f0)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                            <MessageCircle size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                            消息
                        </h2>
                        <button
                            onClick={() => { setShowNewChat(true); loadContacts(); setSelectedContacts([]); setSearchQuery(''); }}
                            style={{
                                padding: '6px 12px', borderRadius: 8, border: 'none',
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: 'white', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 4,
                            }}
                        >
                            <Plus size={14} /> 新聊天
                        </button>
                    </div>
                </div>

                {/* Conversation List */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary, #94a3b8)' }}>
                            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                        </div>
                    ) : conversations.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary, #94a3b8)' }}>
                            <MessageCircle size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                            <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>暂无消息</div>
                            <div style={{ fontSize: '0.75rem', marginTop: 4 }}>点击「新聊天」开始交流</div>
                        </div>
                    ) : (
                        conversations.map(conv => {
                            const avatarMember = getConversationAvatar(conv);
                            const isActive = activeConv?.id === conv.id;
                            return (
                                <button
                                    key={conv.id}
                                    onClick={() => openConversation(conv)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '12px 16px', border: 'none', cursor: 'pointer',
                                        background: isActive ? 'rgba(99,102,241,0.06)' : 'transparent',
                                        borderLeft: isActive ? '3px solid #6366f1' : '3px solid transparent',
                                        textAlign: 'left', transition: 'all 0.15s',
                                    }}
                                >
                                    {/* Avatar */}
                                    <div style={{
                                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                                        background: conv.type === 'group'
                                            ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                            : avatarMember?.type === 'ai'
                                                ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                                                : 'linear-gradient(135deg, #10b981, #059669)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontSize: avatarMember?.avatar ? '1.4rem' : '0.85rem', fontWeight: 700,
                                    }}>
                                        {conv.type === 'group' ? <Users size={20} />
                                            : avatarMember?.avatar ? avatarMember.avatar
                                                : avatarMember?.type === 'ai' ? <Bot size={20} />
                                                    : <User size={20} />}
                                    </div>
                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{
                                                fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)',
                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                            }}>
                                                {getConversationName(conv)}
                                            </span>
                                            {conv.lastMessageAt && (
                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary, #94a3b8)', flexShrink: 0, marginLeft: 8 }}>
                                                    {formatTime(conv.lastMessageAt)}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                                            <span style={{
                                                fontSize: '0.75rem', color: 'var(--text-tertiary, #94a3b8)',
                                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                            }}>
                                                {conv.lastSenderName ? `${conv.lastSenderName}: ` : ''}{conv.lastMessage || '暂无消息'}
                                            </span>
                                            {(conv.unreadCount || 0) > 0 && (
                                                <span style={{
                                                    minWidth: 18, height: 18, borderRadius: 9, flexShrink: 0,
                                                    background: '#ef4444', color: 'white', fontSize: '0.6rem',
                                                    fontWeight: 700, display: 'flex', alignItems: 'center',
                                                    justifyContent: 'center', padding: '0 5px', marginLeft: 8,
                                                }}>
                                                    {conv.unreadCount}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* === Right: Chat Window === */}
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                ...(showMobile === 'list' && !activeConv ? {} : {}),
            }}
                className="chat-main"
            >
                {!activeConv ? (
                    /* Empty State */
                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-tertiary, #94a3b8)',
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <MessageCircle size={56} style={{ marginBottom: 16, opacity: 0.2 }} />
                            <div style={{ fontSize: '1rem', fontWeight: 600 }}>选择一个会话开始聊天</div>
                            <div style={{ fontSize: '0.8rem', marginTop: 6 }}>
                                或点击「新聊天」与同事或 AI 员工交流
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Chat Header */}
                        <div style={{
                            padding: '12px 20px', borderBottom: '1px solid var(--border-light, #e2e8f0)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <button
                                    onClick={() => { setActiveConv(null); setShowMobile('list'); }}
                                    className="chat-back-btn"
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'var(--text-secondary)', padding: 4, display: 'none',
                                    }}
                                >
                                    <ArrowLeft size={20} />
                                </button>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                                        {getConversationName(activeConv)}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary, #94a3b8)' }}>
                                        {activeConv.members.length} 位成员
                                        {activeConv.members.filter(m => m.type === 'ai').length > 0 &&
                                            ` · ${activeConv.members.filter(m => m.type === 'ai').length} 位 AI`}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                                <button
                                    onClick={() => { setShowInvite(true); loadContacts(); }}
                                    style={{
                                        padding: '6px 10px', borderRadius: 8,
                                        border: '1px solid var(--border-light, #e2e8f0)',
                                        background: 'transparent', cursor: 'pointer',
                                        color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: 600,
                                        display: 'flex', alignItems: 'center', gap: 4,
                                    }}
                                >
                                    <UserPlus size={14} /> 邀请
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div style={{
                            flex: 1, overflowY: 'auto', padding: '16px 20px',
                            display: 'flex', flexDirection: 'column', gap: 12,
                        }}>
                            {messages.map(msg => {
                                const isMe = msg.senderId === currentUserId;
                                const isSystem = msg.senderId === 'system';

                                if (isSystem) {
                                    return (
                                        <div key={msg.id} style={{
                                            textAlign: 'center', fontSize: '0.7rem',
                                            color: 'var(--text-tertiary, #94a3b8)', padding: '4px 0',
                                        }}>
                                            {msg.content}
                                        </div>
                                    );
                                }

                                return (
                                    <div key={msg.id} style={{
                                        display: 'flex', gap: 10,
                                        flexDirection: isMe ? 'row-reverse' : 'row',
                                        alignItems: 'flex-start',
                                    }}>
                                        {/* Avatar */}
                                        <div style={{
                                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                            background: isMe
                                                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                                : msg.senderType === 'ai'
                                                    ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                                                    : 'linear-gradient(135deg, #10b981, #059669)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', fontSize: msg.senderAvatar ? '1.2rem' : '0.7rem',
                                            fontWeight: 700,
                                        }}>
                                            {msg.senderAvatar || msg.senderName.slice(0, 1)}
                                        </div>
                                        {/* Bubble */}
                                        <div style={{ maxWidth: '70%' }}>
                                            {!isMe && (
                                                <div style={{
                                                    fontSize: '0.68rem', color: 'var(--text-tertiary, #94a3b8)',
                                                    marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4,
                                                }}>
                                                    {msg.senderName}
                                                    {msg.senderType === 'ai' && (
                                                        <span style={{
                                                            padding: '1px 5px', borderRadius: 4, fontSize: '0.55rem',
                                                            background: 'rgba(245,158,11,0.1)', color: '#d97706',
                                                            fontWeight: 600,
                                                        }}>AI</span>
                                                    )}
                                                </div>
                                            )}
                                            <div style={{
                                                padding: '10px 14px', borderRadius: 14,
                                                background: isMe
                                                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                                    : 'var(--bg-secondary, #f1f5f9)',
                                                color: isMe ? 'white' : 'var(--text-primary)',
                                                fontSize: '0.85rem', lineHeight: 1.6,
                                                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                                borderTopRightRadius: isMe ? 4 : 14,
                                                borderTopLeftRadius: isMe ? 14 : 4,
                                            }}>
                                                {msg.content}
                                            </div>
                                            {/* Attachments */}
                                            {msg.attachments?.map(att => (
                                                <div key={att.id} style={{ marginTop: 6 }}>
                                                    {att.type === 'image' ? (
                                                        <img src={att.url} alt={att.name}
                                                            style={{
                                                                maxWidth: 240, maxHeight: 180, borderRadius: 10,
                                                                display: 'block', objectFit: 'cover',
                                                            }}
                                                        />
                                                    ) : (
                                                        <div style={{
                                                            display: 'flex', alignItems: 'center', gap: 8,
                                                            padding: '8px 12px', borderRadius: 8,
                                                            background: 'rgba(99,102,241,0.05)',
                                                            border: '1px solid var(--border-light, #e2e8f0)',
                                                            fontSize: '0.78rem',
                                                        }}>
                                                            <Paperclip size={14} /> {att.name}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            <div style={{
                                                fontSize: '0.6rem', color: 'var(--text-tertiary, #94a3b8)',
                                                marginTop: 3, textAlign: isMe ? 'right' : 'left',
                                            }}>
                                                {new Date(msg.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSend} style={{
                            padding: '12px 16px', borderTop: '1px solid var(--border-light, #e2e8f0)',
                            display: 'flex', alignItems: 'flex-end', gap: 8,
                        }}>
                            {/* File buttons */}
                            <div style={{ display: 'flex', gap: 4, paddingBottom: 4 }}>
                                <button type="button" onClick={() => imageInputRef.current?.click()} style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-tertiary, #94a3b8)', padding: 4,
                                }}>
                                    <ImageIcon size={20} />
                                </button>
                                <button type="button" onClick={() => fileInputRef.current?.click()} style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-tertiary, #94a3b8)', padding: 4,
                                }}>
                                    <Paperclip size={20} />
                                </button>
                            </div>
                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={e => handleFileUpload(e.target.files, 'image')}
                            />
                            <input
                                ref={fileInputRef}
                                type="file"
                                style={{ display: 'none' }}
                                onChange={e => handleFileUpload(e.target.files, 'file')}
                            />
                            <textarea
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder="输入消息...   Enter 发送，Shift+Enter 换行"
                                rows={1}
                                style={{
                                    flex: 1, padding: '10px 14px', borderRadius: 12,
                                    border: '1px solid var(--border-light, #e2e8f0)',
                                    background: 'var(--bg-secondary, #f8fafc)',
                                    fontSize: '0.85rem', outline: 'none', resize: 'none',
                                    fontFamily: 'inherit', minHeight: 40, maxHeight: 120,
                                    boxSizing: 'border-box',
                                }}
                            />
                            <button type="submit" disabled={!inputText.trim() || sending} style={{
                                padding: '10px 14px', borderRadius: 10, border: 'none',
                                background: inputText.trim() && !sending
                                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                    : '#e2e8f0',
                                color: 'white', cursor: inputText.trim() && !sending ? 'pointer' : 'not-allowed',
                                display: 'flex', alignItems: 'center',
                            }}>
                                {sending
                                    ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                                    : <Send size={18} />}
                            </button>
                        </form>
                    </>
                )}
            </div>

            {/* === New Chat Modal === */}
            {showNewChat && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
                }}>
                    <div style={{
                        width: '100%', maxWidth: 480, maxHeight: '80vh',
                        background: 'var(--bg-primary, #fff)', borderRadius: 20,
                        border: '1px solid var(--border-light, #e2e8f0)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '18px 20px', borderBottom: '1px solid var(--border-light, #e2e8f0)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>新建聊天</div>
                            <button onClick={() => setShowNewChat(false)} style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--text-tertiary)', padding: 4,
                            }}><X size={20} /></button>
                        </div>

                        {/* Group toggle */}
                        <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                                onClick={() => setIsGroup(false)}
                                style={{
                                    padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                                    border: !isGroup ? '1px solid #6366f1' : '1px solid var(--border-light)',
                                    background: !isGroup ? 'rgba(99,102,241,0.08)' : 'transparent',
                                    color: !isGroup ? '#6366f1' : 'var(--text-secondary)',
                                    fontSize: '0.78rem', fontWeight: 600,
                                }}
                            >私聊</button>
                            <button
                                onClick={() => setIsGroup(true)}
                                style={{
                                    padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                                    border: isGroup ? '1px solid #6366f1' : '1px solid var(--border-light)',
                                    background: isGroup ? 'rgba(99,102,241,0.08)' : 'transparent',
                                    color: isGroup ? '#6366f1' : 'var(--text-secondary)',
                                    fontSize: '0.78rem', fontWeight: 600,
                                }}
                            ><Users size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />群聊</button>
                        </div>

                        {/* Group name */}
                        {isGroup && (
                            <div style={{ padding: '0 20px 12px' }}>
                                <input
                                    value={groupName}
                                    onChange={e => setGroupName(e.target.value)}
                                    placeholder="群聊名称（可选）"
                                    style={{
                                        width: '100%', padding: '10px 14px', borderRadius: 10,
                                        border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
                                        fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                        )}

                        {/* Search */}
                        <div style={{ padding: '0 20px 8px' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} style={{
                                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                                    color: 'var(--text-tertiary)',
                                }} />
                                <input
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="搜索用户或 AI 员工..."
                                    style={{
                                        width: '100%', padding: '10px 14px 10px 36px', borderRadius: 10,
                                        border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
                                        fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Selected tags */}
                        {selectedContacts.length > 0 && (
                            <div style={{ padding: '0 20px 8px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {selectedContacts.map(id => {
                                    const c = contacts.find(ct => ct.id === id);
                                    return (
                                        <span key={id} onClick={() => toggleContact(id)} style={{
                                            padding: '3px 10px', borderRadius: 16, fontSize: '0.72rem',
                                            fontWeight: 600, cursor: 'pointer',
                                            background: 'rgba(99,102,241,0.08)', color: '#6366f1',
                                            display: 'flex', alignItems: 'center', gap: 4,
                                        }}>
                                            {c?.name || id} <X size={10} />
                                        </span>
                                    );
                                })}
                            </div>
                        )}

                        {/* Contact list */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
                            {/* Users section */}
                            {filteredContacts.filter(c => c.type === 'user').length > 0 && (
                                <>
                                    <div style={{
                                        fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)',
                                        padding: '8px 8px 4px', textTransform: 'uppercase',
                                    }}>团队成员</div>
                                    {filteredContacts.filter(c => c.type === 'user').map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => toggleContact(c.id)}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                                padding: '8px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                                background: selectedContacts.includes(c.id) ? 'rgba(99,102,241,0.06)' : 'transparent',
                                                textAlign: 'left',
                                            }}
                                        >
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 10,
                                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'white', fontSize: '0.8rem', fontWeight: 700,
                                            }}>{c.name.slice(0, 1)}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{c.name}</div>
                                            </div>
                                            {selectedContacts.includes(c.id) && (
                                                <Check size={16} style={{ color: '#6366f1' }} />
                                            )}
                                        </button>
                                    ))}
                                </>
                            )}

                            {/* AI section */}
                            {filteredContacts.filter(c => c.type === 'ai').length > 0 && (
                                <>
                                    <div style={{
                                        fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-tertiary)',
                                        padding: '12px 8px 4px', textTransform: 'uppercase',
                                    }}>AI 员工</div>
                                    {filteredContacts.filter(c => c.type === 'ai').map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => toggleContact(c.id)}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                                padding: '8px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                                background: selectedContacts.includes(c.id) ? 'rgba(99,102,241,0.06)' : 'transparent',
                                                textAlign: 'left',
                                            }}
                                        >
                                            <div style={{
                                                width: 36, height: 36, borderRadius: 10,
                                                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'white', fontSize: c.avatar ? '1.2rem' : '0.8rem', fontWeight: 700,
                                            }}>{c.avatar || c.name.slice(0, 1)}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{c.name}</div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                                                    {c.department} · {c.role}
                                                </div>
                                            </div>
                                            {selectedContacts.includes(c.id) && (
                                                <Check size={16} style={{ color: '#6366f1' }} />
                                            )}
                                        </button>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* Create button */}
                        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-light)' }}>
                            <button
                                onClick={createNewConversation}
                                disabled={selectedContacts.length === 0}
                                style={{
                                    width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
                                    background: selectedContacts.length > 0
                                        ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                                        : '#e2e8f0',
                                    color: 'white', fontWeight: 700, fontSize: '0.88rem',
                                    cursor: selectedContacts.length > 0 ? 'pointer' : 'not-allowed',
                                }}
                            >
                                {isGroup ? '创建群聊' : '开始聊天'}
                                {selectedContacts.length > 0 && ` (${selectedContacts.length}人)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* === Invite Member Modal === */}
            {showInvite && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
                }}>
                    <div style={{
                        width: '100%', maxWidth: 400, maxHeight: '70vh',
                        background: 'var(--bg-primary, #fff)', borderRadius: 20,
                        border: '1px solid var(--border-light, #e2e8f0)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    }}>
                        <div style={{
                            padding: '18px 20px', borderBottom: '1px solid var(--border-light)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>邀请成员</div>
                            <button onClick={() => setShowInvite(false)} style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--text-tertiary)', padding: 4,
                            }}><X size={20} /></button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                            {contacts.filter(c =>
                                !activeConv?.members.some(m => m.id === c.id) && c.id !== currentUserId
                            ).map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => inviteMember(c.id)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                        background: 'transparent', textAlign: 'left',
                                    }}
                                >
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10,
                                        background: c.type === 'ai'
                                            ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                                            : 'linear-gradient(135deg, #10b981, #059669)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontSize: c.avatar ? '1.2rem' : '0.8rem', fontWeight: 700,
                                    }}>{c.avatar || c.name.slice(0, 1)}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{c.name}</div>
                                        {c.department && <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{c.department}</div>}
                                    </div>
                                    <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
                @media (max-width: 768px) {
                    .chat-sidebar { width: 100% !important; display: ${showMobile === 'list' ? 'flex' : 'none'} !important; }
                    .chat-main { display: ${showMobile === 'chat' || activeConv ? 'flex' : 'none'} !important; }
                    .chat-back-btn { display: flex !important; }
                }
            `}</style>
        </div>
    );
}
