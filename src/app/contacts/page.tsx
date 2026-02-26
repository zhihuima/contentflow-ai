'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import {
    Search, Send, ArrowLeft, Globe, Phone, Briefcase,
    MessageCircle, X, Loader2, UserPlus, Users, ChevronDown,
} from 'lucide-react';
import { DEPARTMENTS, getAllAgents, getAgent } from '@/lib/departments';
import type { AgentProfile } from '@/lib/departments';

// ---- 部门颜色 ----
const DEPT_COLORS: Record<string, string> = {
    content: '#6366f1',
    marketing: '#f59e0b',
    design: '#ec4899',
    data: '#10b981',
    service: '#0ea5e9',
};

function getAgentColor(agentId: string): string {
    const dept = DEPARTMENTS.find(d => d.agents.some(a => a.id === agentId));
    return DEPT_COLORS[dept?.id || ''] || '#6366f1';
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    agentId?: string;
    agentName?: string;
    agentAvatar?: string;
    searched?: boolean;
}

interface ChatSession {
    id: string;
    agentIds: string[];
    name: string;
    messages: ChatMessage[];
    lastMessage?: string;
    updatedAt: string;
}

const SESSIONS_KEY = 'ai_chat_sessions';

function loadSessions(): ChatSession[] {
    if (typeof window === 'undefined') return [];
    try {
        const saved = localStorage.getItem(SESSIONS_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
}

function saveSessions(sessions: ChatSession[]) {
    try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 50)));
    } catch { /* ignore */ }
}

export default function ContactsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [enableSearch, setEnableSearch] = useState(true);
    const [showInvitePanel, setShowInvitePanel] = useState(false);
    const [view, setView] = useState<'contacts' | 'sessions'>('contacts');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const allAgents = getAllAgents();

    // Load sessions on mount
    useEffect(() => {
        setSessions(loadSessions());
    }, []);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const filteredAgents = searchQuery.trim()
        ? allAgents.filter(a =>
            a.name.includes(searchQuery) ||
            a.role.includes(searchQuery) ||
            a.capabilities?.some((s: string) => s.includes(searchQuery))
        )
        : allAgents;

    // ---- Session Management ----
    const openChat = (agent: AgentProfile) => {
        // Check if existing 1:1 session exists
        const existing = sessions.find(s => s.agentIds.length === 1 && s.agentIds[0] === agent.id);
        if (existing) {
            setActiveSession(existing);
            setChatMessages(existing.messages);
        } else {
            const newSession: ChatSession = {
                id: Date.now().toString(),
                agentIds: [agent.id],
                name: agent.name,
                messages: [],
                updatedAt: new Date().toLocaleString('zh-CN'),
            };
            setActiveSession(newSession);
            setChatMessages([]);
        }
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const saveCurrentSession = (msgs: ChatMessage[], agentIds?: string[]) => {
        if (!activeSession) return;
        const updatedSession: ChatSession = {
            ...activeSession,
            agentIds: agentIds || activeSession.agentIds,
            name: (agentIds || activeSession.agentIds).length > 1
                ? (agentIds || activeSession.agentIds).map(id => getAgent(id)?.name || '').filter(Boolean).join('、')
                : activeSession.name,
            messages: msgs,
            lastMessage: msgs[msgs.length - 1]?.content?.slice(0, 60) || '',
            updatedAt: new Date().toLocaleString('zh-CN'),
        };
        setActiveSession(updatedSession);

        const updatedSessions = [
            updatedSession,
            ...sessions.filter(s => s.id !== updatedSession.id),
        ];
        setSessions(updatedSessions);
        saveSessions(updatedSessions);
    };

    const closeChat = () => {
        if (activeSession && chatMessages.length > 0) {
            saveCurrentSession(chatMessages);
        }
        setActiveSession(null);
        setChatMessages([]);
        setShowInvitePanel(false);
    };

    const clearHistory = () => {
        if (activeSession) {
            setChatMessages([]);
            const updatedSessions = sessions.filter(s => s.id !== activeSession.id);
            setSessions(updatedSessions);
            saveSessions(updatedSessions);
            setActiveSession(null);
        }
    };

    const inviteAgent = (agentId: string) => {
        if (!activeSession || activeSession.agentIds.includes(agentId)) return;
        const newAgentIds = [...activeSession.agentIds, agentId];
        const agent = getAgent(agentId);
        const joinMsg: ChatMessage = {
            role: 'assistant',
            content: `大家好！我是${agent?.name}（${agent?.role}），很高兴加入讨论 🙌`,
            agentId,
            agentName: agent?.name,
            agentAvatar: agent?.avatar,
        };
        const newMsgs = [...chatMessages, joinMsg];
        setChatMessages(newMsgs);
        saveCurrentSession(newMsgs, newAgentIds);
        setShowInvitePanel(false);
    };

    const isGroupChat = (activeSession?.agentIds?.length || 0) > 1;

    const handleSend = async (e?: FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() || !activeSession || isLoading) return;

        const userMsg: ChatMessage = { role: 'user', content: inputText.trim() };
        const newMessages = [...chatMessages, userMsg];
        setChatMessages(newMessages);
        setInputText('');
        setIsLoading(true);

        try {
            const endpoint = isGroupChat ? '/api/chat/group' : '/api/chat';
            const body = isGroupChat
                ? {
                    agentIds: activeSession.agentIds,
                    messages: newMessages.slice(-12),
                    enableSearch,
                }
                : {
                    agentId: activeSession.agentIds[0],
                    messages: newMessages.slice(-10).map(m => ({ role: m.role, content: m.content })),
                    enableSearch,
                };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (res.ok && data.reply) {
                const assistantMsg: ChatMessage = {
                    role: 'assistant',
                    content: data.reply,
                    agentId: isGroupChat ? data.agentId : activeSession.agentIds[0],
                    agentName: isGroupChat ? data.agentName : getAgent(activeSession.agentIds[0])?.name,
                    agentAvatar: isGroupChat ? data.agentAvatar : getAgent(activeSession.agentIds[0])?.avatar,
                    searched: data.searched,
                };
                const finalMessages = [...newMessages, assistantMsg];
                setChatMessages(finalMessages);
                saveCurrentSession(finalMessages);
            } else {
                setChatMessages([...newMessages, { role: 'assistant', content: `⚠️ ${data.error || '回复失败'}` }]);
            }
        } catch {
            setChatMessages([...newMessages, { role: 'assistant', content: '⚠️ 网络错误，请重试' }]);
        } finally {
            setIsLoading(false);
        }
    };

    // ---- Chat View ----
    if (activeSession) {
        const agents = activeSession.agentIds.map(id => getAgent(id)).filter(Boolean) as AgentProfile[];
        const primaryColor = getAgentColor(activeSession.agentIds[0]);

        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
                {/* Chat Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0',
                    borderBottom: '1px solid var(--border-light)',
                }}>
                    <button onClick={closeChat} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                        color: 'var(--text-secondary)', display: 'flex',
                    }}>
                        <ArrowLeft size={20} />
                    </button>
                    {/* Avatars */}
                    <div style={{ display: 'flex', position: 'relative', width: isGroupChat ? 50 : 40, height: 40 }}>
                        {agents.slice(0, 3).map((a, i) => (
                            <div key={a.id} style={{
                                width: isGroupChat ? 28 : 40, height: isGroupChat ? 28 : 40, borderRadius: '50%',
                                background: getAgentColor(a.id), display: 'flex', alignItems: 'center',
                                justifyContent: 'center', color: 'white', fontWeight: 700,
                                fontSize: isGroupChat ? '0.65rem' : '0.95rem', position: 'absolute',
                                left: i * 14, top: i * (isGroupChat ? 5 : 0),
                                border: '2px solid white', zIndex: 3 - i,
                            }}>
                                {a.avatar}
                            </div>
                        ))}
                    </div>
                    <div style={{ flex: 1, marginLeft: isGroupChat ? 10 : 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                            {isGroupChat ? `群聊 (${agents.length}人)` : agents[0]?.name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                            {agents.map(a => a.name).join('、')}
                        </div>
                    </div>
                    {/* Invite button */}
                    <button
                        onClick={() => setShowInvitePanel(!showInvitePanel)}
                        title="邀请更多 AI 员工"
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
                            borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                            border: '1px solid #e2e8f0', background: showInvitePanel ? 'rgba(99,102,241,0.08)' : 'transparent',
                            color: showInvitePanel ? '#6366f1' : '#94a3b8',
                        }}
                    >
                        <UserPlus size={13} /> 邀请
                    </button>
                    <button
                        onClick={() => setEnableSearch(!enableSearch)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
                            borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                            border: '1px solid', borderColor: enableSearch ? '#10b981' : '#e2e8f0',
                            background: enableSearch ? 'rgba(16,185,129,0.08)' : 'transparent',
                            color: enableSearch ? '#10b981' : '#94a3b8',
                        }}
                    >
                        <Globe size={13} /> {enableSearch ? '联网' : '离线'}
                    </button>
                    {chatMessages.length > 0 && (
                        <button onClick={clearHistory} title="清空对话" style={{
                            background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4,
                        }}>
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Invite Panel */}
                {showInvitePanel && (
                    <div style={{
                        padding: 12, background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                        display: 'flex', flexWrap: 'wrap', gap: 6,
                    }}>
                        <span style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: '32px', marginRight: 4 }}>
                            邀请同事加入：
                        </span>
                        {allAgents.filter(a => !activeSession.agentIds.includes(a.id)).map(a => (
                            <button
                                key={a.id}
                                onClick={() => inviteAgent(a.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                                    borderRadius: 20, fontSize: '0.75rem', border: '1px solid #e2e8f0',
                                    background: 'white', cursor: 'pointer', color: '#334155',
                                }}
                            >
                                {a.avatar} {a.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* Messages */}
                <div style={{ flex: 1, overflow: 'auto', padding: '16px 0' }}>
                    {chatMessages.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-tertiary)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: 10 }}>
                                {agents.map(a => a.avatar).join(' ')}
                            </div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                {isGroupChat ? '开始群聊讨论' : `和${agents[0]?.name}聊聊`}
                            </div>
                            <div style={{ fontSize: '0.78rem', lineHeight: 1.6 }}>
                                {isGroupChat
                                    ? `${agents.map(a => a.name).join('、')} 等你发起话题`
                                    : agents[0]?.personality?.split('。')[0] || agents[0]?.role}
                            </div>
                            {!isGroupChat && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 16 }}>
                                    {(agents[0]?.capabilities || []).slice(0, 4).map((s: string) => (
                                        <span key={s} style={{
                                            fontSize: '0.72rem', padding: '4px 10px', borderRadius: 20,
                                            background: `${primaryColor}12`, color: primaryColor, fontWeight: 500,
                                        }}>{s}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {chatMessages.map((msg, i) => {
                        const agentColor = msg.agentId ? getAgentColor(msg.agentId) : primaryColor;
                        return (
                            <div key={i} style={{
                                display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                marginBottom: 12,
                            }}>
                                {msg.role === 'assistant' && (
                                    <div style={{
                                        width: 30, height: 30, borderRadius: '50%', background: agentColor,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0,
                                        marginRight: 8, marginTop: 2,
                                    }}>
                                        {msg.agentAvatar || agents[0]?.avatar}
                                    </div>
                                )}
                                <div style={{ maxWidth: '75%' }}>
                                    {msg.role === 'assistant' && isGroupChat && msg.agentName && (
                                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: agentColor, marginBottom: 2 }}>
                                            {msg.agentName}
                                        </div>
                                    )}
                                    <div style={{
                                        padding: '10px 14px', borderRadius: 14,
                                        fontSize: '0.86rem', lineHeight: 1.7, whiteSpace: 'pre-wrap',
                                        ...(msg.role === 'user' ? {
                                            background: '#6366f1', color: 'white', borderBottomRightRadius: 4,
                                        } : {
                                            background: 'var(--bg-secondary)', borderBottomLeftRadius: 4,
                                        }),
                                    }}>
                                        {msg.content}
                                        {msg.searched && (
                                            <div style={{ fontSize: '0.68rem', color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : '#10b981', marginTop: 4 }}>
                                                🌐 已参考联网搜索结果
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {isLoading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> 正在思考...
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSend} style={{
                    display: 'flex', gap: 8, padding: '12px 0', borderTop: '1px solid var(--border-light)',
                }}>
                    <textarea
                        ref={inputRef}
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder={isGroupChat ? '发起话题讨论...' : `和${agents[0]?.name}说点什么...`}
                        rows={1}
                        style={{
                            flex: 1, padding: '10px 14px', borderRadius: 12,
                            border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
                            fontSize: '0.86rem', resize: 'none', outline: 'none', fontFamily: 'inherit',
                        }}
                    />
                    <button type="submit" disabled={isLoading || !inputText.trim()} style={{
                        padding: '10px 16px', borderRadius: 12, border: 'none',
                        background: (!inputText.trim() || isLoading) ? '#e2e8f0' : '#6366f1',
                        color: 'white', cursor: (!inputText.trim() || isLoading) ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center',
                    }}>
                        <Send size={16} />
                    </button>
                </form>
                <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
            </div>
        );
    }

    // ---- Main View: Tabs (Contacts / Sessions) ----
    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
            <div style={{ marginBottom: 20 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Phone size={22} /> AI 员工通讯录
                </h1>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                    找到 AI 专家一对一对话，也可以拉人建群，支持联网检索
                </p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: '#f1f5f9', borderRadius: 10, padding: 3 }}>
                <button onClick={() => setView('contacts')} style={{
                    flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none',
                    background: view === 'contacts' ? 'white' : 'transparent',
                    boxShadow: view === 'contacts' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    color: view === 'contacts' ? '#1e293b' : '#94a3b8',
                }}>
                    <Briefcase size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    通讯录
                </button>
                <button onClick={() => setView('sessions')} style={{
                    flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none',
                    background: view === 'sessions' ? 'white' : 'transparent',
                    boxShadow: view === 'sessions' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    color: view === 'sessions' ? '#1e293b' : '#94a3b8',
                }}>
                    <MessageCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    聊天记录 {sessions.length > 0 && `(${sessions.length})`}
                </button>
            </div>

            {/* Sessions List */}
            {view === 'sessions' && (
                <div>
                    {sessions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                            <MessageCircle size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>暂无聊天记录</div>
                            <div style={{ fontSize: '0.82rem' }}>去通讯录找 AI 同事聊聊吧</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {sessions.map(session => {
                                const agents = session.agentIds.map(id => getAgent(id)).filter(Boolean) as AgentProfile[];
                                const isGroup = agents.length > 1;
                                return (
                                    <div
                                        key={session.id}
                                        onClick={() => {
                                            setActiveSession(session);
                                            setChatMessages(session.messages);
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                                            borderRadius: 14, border: '1px solid var(--border-light)',
                                            background: 'var(--bg-primary)', cursor: 'pointer', transition: 'all 0.15s',
                                        }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#6366f1'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'; }}
                                    >
                                        <div style={{ display: 'flex', position: 'relative', width: isGroup ? 40 : 36, height: 36, flexShrink: 0 }}>
                                            {agents.slice(0, 3).map((a, i) => (
                                                <div key={a.id} style={{
                                                    width: isGroup ? 24 : 36, height: isGroup ? 24 : 36, borderRadius: '50%',
                                                    background: getAgentColor(a.id), position: 'absolute',
                                                    left: i * 10, top: i * (isGroup ? 4 : 0),
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'white', fontWeight: 700, fontSize: isGroup ? '0.6rem' : '0.85rem',
                                                    border: '2px solid white', zIndex: 3 - i,
                                                }}>
                                                    {a.avatar}
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {isGroup && <Users size={12} style={{ color: '#6366f1' }} />}
                                                {session.name}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {session.lastMessage || '暂无消息'}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.68rem', color: '#c0c5cc', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                            {session.updatedAt}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Contacts Directory */}
            {view === 'contacts' && (
                <>
                    <div style={{ position: 'relative', marginBottom: 20 }}>
                        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            placeholder="搜索员工：姓名、职能、技能..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 14px 12px 40px', borderRadius: 14,
                                border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
                                fontSize: '0.86rem', outline: 'none', boxSizing: 'border-box',
                            }}
                        />
                    </div>

                    {DEPARTMENTS.map(dept => {
                        const deptAgents = dept.agents.filter(a => filteredAgents.some(fa => fa.id === a.id));
                        if (deptAgents.length === 0) return null;
                        const color = DEPT_COLORS[dept.id] || '#6366f1';

                        return (
                            <div key={dept.id} style={{ marginBottom: 24 }}>
                                <div style={{
                                    fontSize: '0.85rem', fontWeight: 700, color,
                                    marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
                                }}>
                                    <Briefcase size={14} /> {dept.icon} {dept.name}
                                    <span style={{ fontSize: '0.72rem', fontWeight: 500, color: '#94a3b8' }}>
                                        ({deptAgents.length}人)
                                    </span>
                                </div>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                                    gap: 10,
                                }}>
                                    {deptAgents.map(agent => {
                                        const hasHistory = sessions.some(s =>
                                            s.agentIds.includes(agent.id) && s.messages.length > 0
                                        );
                                        return (
                                            <div
                                                key={agent.id}
                                                onClick={() => openChat(agent)}
                                                style={{
                                                    padding: 14, borderRadius: 14, cursor: 'pointer',
                                                    border: '1px solid var(--border-light)',
                                                    background: 'var(--bg-primary)', transition: 'all 0.2s',
                                                    position: 'relative',
                                                }}
                                                onMouseEnter={e => {
                                                    (e.currentTarget as HTMLElement).style.borderColor = color;
                                                    (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${color}15`;
                                                }}
                                                onMouseLeave={e => {
                                                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)';
                                                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                                    <div style={{
                                                        width: 36, height: 36, borderRadius: '50%', background: color,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: 'white', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
                                                    }}>
                                                        {agent.avatar}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{agent.name}</div>
                                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{agent.role}</div>
                                                    </div>
                                                    {hasHistory && (
                                                        <div style={{
                                                            marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%',
                                                            background: '#10b981', flexShrink: 0,
                                                        }} title="有对话记录" />
                                                    )}
                                                </div>
                                                <p style={{
                                                    fontSize: '0.75rem', color: 'var(--text-tertiary)', lineHeight: 1.5, margin: 0,
                                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                }}>
                                                    {agent.personality?.split('。')[0] || agent.role}
                                                </p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                                                    {(agent.capabilities || []).slice(0, 3).map((s: string) => (
                                                        <span key={s} style={{
                                                            fontSize: '0.66rem', padding: '2px 8px', borderRadius: 12,
                                                            background: `${color}10`, color, fontWeight: 500,
                                                        }}>{s}</span>
                                                    ))}
                                                </div>
                                                <div style={{
                                                    position: 'absolute', bottom: 10, right: 12,
                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                    fontSize: '0.7rem', color, fontWeight: 600,
                                                }}>
                                                    <MessageCircle size={11} /> 开聊
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </>
            )}
        </div>
    );
}
