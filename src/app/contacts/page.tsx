'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import {
    Search, Send, ArrowLeft, Globe, Phone, Briefcase,
    MessageCircle, X, Loader2,
} from 'lucide-react';
import { DEPARTMENTS, getAllAgents } from '@/lib/departments';
import type { AgentProfile } from '@/lib/departments';

// ---- 部门颜色 ----
const DEPT_COLORS: Record<string, string> = {
    content: '#6366f1',
    marketing: '#f59e0b',
    design: '#ec4899',
    data: '#10b981',
    service: '#0ea5e9',
};

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    searched?: boolean;
}

const CHAT_HISTORY_KEY = 'ai_chat_history';

function loadChatHistory(): Record<string, ChatMessage[]> {
    if (typeof window === 'undefined') return {};
    try {
        const saved = localStorage.getItem(CHAT_HISTORY_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
}

function saveChatHistory(history: Record<string, ChatMessage[]>) {
    try {
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(history));
    } catch { /* ignore */ }
}

export default function ContactsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeAgent, setActiveAgent] = useState<AgentProfile | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [enableSearch, setEnableSearch] = useState(true);
    const [allHistory, setAllHistory] = useState<Record<string, ChatMessage[]>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const allAgents = getAllAgents();

    // Load history on mount
    useEffect(() => {
        setAllHistory(loadChatHistory());
    }, []);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const filteredAgents = searchQuery.trim()
        ? allAgents.filter(a =>
            a.name.includes(searchQuery) ||
            a.role.includes(searchQuery) ||
            a.capabilities?.some((s: string) => s.includes(searchQuery)) ||
            a.personality?.includes(searchQuery)
        )
        : allAgents;

    const openChat = (agent: AgentProfile) => {
        setActiveAgent(agent);
        const existing = allHistory[agent.id] || [];
        setChatMessages(existing);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const closeChat = () => {
        if (activeAgent && chatMessages.length > 0) {
            const updated = { ...allHistory, [activeAgent.id]: chatMessages };
            setAllHistory(updated);
            saveChatHistory(updated);
        }
        setActiveAgent(null);
        setChatMessages([]);
    };

    const clearHistory = () => {
        if (activeAgent) {
            setChatMessages([]);
            const updated = { ...allHistory };
            delete updated[activeAgent.id];
            setAllHistory(updated);
            saveChatHistory(updated);
        }
    };

    const handleSend = async (e?: FormEvent) => {
        e?.preventDefault();
        if (!inputText.trim() || !activeAgent || isLoading) return;

        const userMsg: ChatMessage = { role: 'user', content: inputText.trim() };
        const newMessages = [...chatMessages, userMsg];
        setChatMessages(newMessages);
        setInputText('');
        setIsLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: activeAgent.id,
                    messages: newMessages.slice(-10),
                    enableSearch,
                }),
            });
            const data = await res.json();
            if (res.ok && data.reply) {
                const assistantMsg: ChatMessage = {
                    role: 'assistant',
                    content: data.reply,
                    searched: data.searched,
                };
                const finalMessages = [...newMessages, assistantMsg];
                setChatMessages(finalMessages);
                const updated = { ...allHistory, [activeAgent.id]: finalMessages };
                setAllHistory(updated);
                saveChatHistory(updated);
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
    if (activeAgent) {
        const dept = DEPARTMENTS.find(d => d.agents.some(a => a.id === activeAgent.id));
        const color = DEPT_COLORS[dept?.id || ''] || '#6366f1';

        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
                {/* Chat Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0',
                    borderBottom: '1px solid var(--border-light)',
                }}>
                    <button onClick={closeChat} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                        color: 'var(--text-secondary)', display: 'flex',
                    }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%', background: color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: '0.95rem', flexShrink: 0,
                    }}>
                        {activeAgent.avatar}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{activeAgent.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                            {dept?.name} · {activeAgent.role}
                        </div>
                    </div>
                    <button
                        onClick={() => setEnableSearch(!enableSearch)}
                        title={enableSearch ? '已启用联网搜索' : '已关闭联网搜索'}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
                            borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                            border: '1px solid',
                            borderColor: enableSearch ? '#10b981' : '#e2e8f0',
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

                {/* Messages */}
                <div style={{ flex: 1, overflow: 'auto', padding: '16px 0' }}>
                    {chatMessages.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{activeAgent.avatar}</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                和{activeAgent.name}聊聊
                            </div>
                            <div style={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
                                {activeAgent.personality?.split('。')[0] || activeAgent.role}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 20 }}>
                                {(activeAgent.capabilities || []).slice(0, 4).map((s: string) => (
                                    <span key={s} style={{
                                        fontSize: '0.75rem', padding: '4px 10px', borderRadius: 20,
                                        background: `${color}15`, color, fontWeight: 500,
                                    }}>{s}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {chatMessages.map((msg, i) => (
                        <div key={i} style={{
                            display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            marginBottom: 14,
                        }}>
                            {msg.role === 'assistant' && (
                                <div style={{
                                    width: 30, height: 30, borderRadius: '50%', background: color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontWeight: 700, fontSize: '0.72rem', flexShrink: 0, marginRight: 8, marginTop: 2,
                                }}>
                                    {activeAgent.avatar}
                                </div>
                            )}
                            <div style={{
                                maxWidth: '75%', padding: '10px 14px', borderRadius: 14,
                                fontSize: '0.88rem', lineHeight: 1.7, whiteSpace: 'pre-wrap',
                                ...(msg.role === 'user' ? {
                                    background: '#6366f1', color: 'white',
                                    borderBottomRightRadius: 4,
                                } : {
                                    background: 'var(--bg-secondary)',
                                    borderBottomLeftRadius: 4,
                                }),
                            }}>
                                {msg.content}
                                {msg.searched && (
                                    <div style={{ fontSize: '0.7rem', color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : '#10b981', marginTop: 4 }}>
                                        🌐 已参考联网搜索结果
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                            <div style={{
                                width: 30, height: 30, borderRadius: '50%', background: color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontSize: '0.72rem',
                            }}>
                                {activeAgent.avatar}
                            </div>
                            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> {activeAgent.name}正在思考...
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
                        placeholder={`和${activeAgent.name}说点什么...`}
                        rows={1}
                        style={{
                            flex: 1, padding: '10px 14px', borderRadius: 12,
                            border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
                            fontSize: '0.88rem', resize: 'none', outline: 'none',
                            fontFamily: 'inherit',
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
            </div>
        );
    }

    // ---- Contacts Directory ----
    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Phone size={22} /> AI 员工通讯录
                </h1>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-tertiary)' }}>
                    找到合适的 AI 专家，一对一深度对话，每位员工都具备联网检索能力
                </p>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 24 }}>
                <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                    type="text"
                    placeholder="搜索员工：姓名、职能、技能..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{
                        width: '100%', padding: '12px 14px 12px 40px', borderRadius: 14,
                        border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
                        fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box',
                    }}
                />
            </div>

            {/* Departments */}
            {DEPARTMENTS.map(dept => {
                const deptAgents = dept.agents.filter(a => filteredAgents.some(fa => fa.id === a.id));
                if (deptAgents.length === 0) return null;
                const color = DEPT_COLORS[dept.id] || '#6366f1';

                return (
                    <div key={dept.id} style={{ marginBottom: 28 }}>
                        <div style={{
                            fontSize: '0.88rem', fontWeight: 700, color,
                            marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                            <Briefcase size={15} /> {dept.icon} {dept.name}
                            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#94a3b8' }}>
                                ({deptAgents.length}人)
                            </span>
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                            gap: 12,
                        }}>
                            {deptAgents.map(agent => {
                                const hasHistory = !!allHistory[agent.id]?.length;
                                return (
                                    <div
                                        key={agent.id}
                                        onClick={() => openChat(agent)}
                                        style={{
                                            padding: 16, borderRadius: 14, cursor: 'pointer',
                                            border: '1px solid var(--border-light)',
                                            background: 'var(--bg-primary)',
                                            transition: 'all 0.2s',
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                            <div style={{
                                                width: 38, height: 38, borderRadius: '50%', background: color,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'white', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0,
                                            }}>
                                                {agent.avatar}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{agent.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{agent.role}</div>
                                            </div>
                                            {hasHistory && (
                                                <div style={{
                                                    marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%',
                                                    background: '#10b981', flexShrink: 0,
                                                }} title="有对话记录" />
                                            )}
                                        </div>
                                        <p style={{
                                            fontSize: '0.78rem', color: 'var(--text-tertiary)', lineHeight: 1.5, margin: 0,
                                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                        }}>
                                            {agent.personality?.split('。')[0] || agent.role}
                                        </p>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                                            {(agent.capabilities || []).slice(0, 3).map((s: string) => (
                                                <span key={s} style={{
                                                    fontSize: '0.68rem', padding: '2px 8px', borderRadius: 12,
                                                    background: `${color}10`, color, fontWeight: 500,
                                                }}>{s}</span>
                                            ))}
                                        </div>
                                        <div style={{
                                            position: 'absolute', bottom: 12, right: 14,
                                            display: 'flex', alignItems: 'center', gap: 4,
                                            fontSize: '0.72rem', color, fontWeight: 600,
                                        }}>
                                            <MessageCircle size={12} /> 开聊
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
