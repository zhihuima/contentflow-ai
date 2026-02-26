'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
    MessageSquare, Users, Send, Mic, ChevronDown, ChevronRight,
    Play, Sparkles, FileText, CheckCircle, ArrowRight,
    Building2, Plus, X, Clock, Eye,
} from 'lucide-react';
import { DEPARTMENTS, getAllAgents, getAgent } from '@/lib/departments';
import type { AgentProfile, Department } from '@/lib/departments';
import type { MeetingMessage } from '@/lib/meeting-types';
import type { MeetingYieldEvent } from '@/lib/meeting-engine';

// ---- 会议历史 ----
interface MeetingRecord {
    id: string;
    topic: string;
    agents: string[];
    messages: MeetingMessage[];
    summary: { keyPoints: string[]; disagreements?: string[]; highlights?: string[]; actionItems: { assignee: string; task: string }[]; nextSteps: string[] } | null;
    createdAt: string;
}

const MEETING_HISTORY_KEY = 'ai_meeting_history';

function loadMeetingHistory(): MeetingRecord[] {
    if (typeof window === 'undefined') return [];
    try {
        const saved = localStorage.getItem(MEETING_HISTORY_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
}

function saveMeetingRecord(record: MeetingRecord) {
    try {
        const history = loadMeetingHistory();
        history.unshift(record);
        // 最多保存 20 条
        localStorage.setItem(MEETING_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
    } catch { /* ignore */ }
}

export default function MeetingPage() {
    const router = useRouter();

    // ---- 会议状态 ----
    const [phase, setPhase] = useState<'setup' | 'running' | 'done'>('setup');
    const [topic, setTopic] = useState('');
    const [userContext, setUserContext] = useState('');
    const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
    const [messages, setMessages] = useState<MeetingMessage[]>([]);
    const [summary, setSummary] = useState<{
        keyPoints: string[]; disagreements?: string[]; highlights?: string[]; actionItems: { assignee: string; task: string }[]; nextSteps: string[];
    } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedDept, setExpandedDept] = useState<string | null>('content');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [meetingHistory, setMeetingHistory] = useState<MeetingRecord[]>([]);
    const [viewingHistory, setViewingHistory] = useState<MeetingRecord | null>(null);
    const hasSavedRef = useRef(false);

    // Load history on mount
    useEffect(() => {
        setMeetingHistory(loadMeetingHistory());
    }, []);

    // Save meeting when done
    useEffect(() => {
        if (phase === 'done' && messages.length > 0 && topic && !hasSavedRef.current) {
            hasSavedRef.current = true;
            const record: MeetingRecord = {
                id: Date.now().toString(),
                topic,
                agents: selectedAgents,
                messages,
                summary,
                createdAt: new Date().toLocaleString('zh-CN'),
            };
            saveMeetingRecord(record);
            setMeetingHistory(loadMeetingHistory());
        }
    }, [phase, messages, topic, selectedAgents, summary]);

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ---- 切换选择员工 ----
    function toggleAgent(agentId: string) {
        setSelectedAgents(prev =>
            prev.includes(agentId)
                ? prev.filter(id => id !== agentId)
                : [...prev, agentId]
        );
    }

    // ---- 快速选择整个部门 ----
    function selectDepartment(dept: Department) {
        const deptAgentIds = dept.agents.map(a => a.id);
        const allSelected = deptAgentIds.every(id => selectedAgents.includes(id));
        if (allSelected) {
            setSelectedAgents(prev => prev.filter(id => !deptAgentIds.includes(id)));
        } else {
            setSelectedAgents(prev => [...new Set([...prev, ...deptAgentIds])]);
        }
    }

    // ---- 发起会议 ----
    async function startMeeting() {
        if (!topic.trim() || selectedAgents.length === 0) return;
        setPhase('running');
        setIsLoading(true);
        setMessages([]);
        setSummary(null);

        try {
            const res = await fetch('/api/meeting/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: topic.trim(),
                    participantIds: selectedAgents,
                    userContext: userContext.trim() || undefined,
                }),
            });

            if (!res.ok) throw new Error('会议启动失败');

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) throw new Error('无法读取流');

            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') {
                            setPhase('done');
                            setIsLoading(false);
                            continue;
                        }
                        try {
                            const event: MeetingYieldEvent = JSON.parse(data);
                            if (event.type === 'message' && event.message) {
                                setMessages(prev => [...prev, event.message!]);
                            } else if (event.type === 'summary' && event.summary) {
                                setSummary(event.summary);
                            } else if (event.type === 'end') {
                                setPhase('done');
                                setIsLoading(false);
                            }
                        } catch {
                            // ignore parse errors
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Meeting error:', err);
            setIsLoading(false);
            setPhase('done');
        }
    }

    // ---- 重新开始 ----
    function resetMeeting() {
        setPhase('setup');
        setMessages([]);
        setSummary(null);
        setTopic('');
        setUserContext('');
        setSelectedAgents([]);
        hasSavedRef.current = false;
        setViewingHistory(null);
    }

    return (
        <>
            <style>{`
                .meeting-page { max-width: 1200px; margin: 0 auto; padding: 32px 24px; min-height: calc(100vh - 64px); }
                .meeting-header { margin-bottom: 24px; }
                .meeting-header h1 { font-size: 1.8rem; font-weight: 800; color: #1e293b; margin: 0 0 6px; display: flex; align-items: center; gap: 10px; }
                .meeting-header p { color: #64748b; font-size: 0.9rem; margin: 0; }

                /* ---- Setup Phase ---- */
                .setup-grid { display: grid; grid-template-columns: 1fr 340px; gap: 24px; }
                @media (max-width: 768px) { .setup-grid { grid-template-columns: 1fr; } }

                .setup-main { background: white; border-radius: 20px; padding: 28px; border: 1px solid #e2e8f0; }
                .setup-main h2 { font-size: 1.1rem; font-weight: 700; color: #1e293b; margin: 0 0 16px; display: flex; align-items: center; gap: 8px; }
                .setup-input { width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 1rem; outline: none; background: #f8fafc; box-sizing: border-box; transition: border-color 0.2s; color: #1e293b; }
                .setup-input:focus { border-color: #818cf8; }
                .setup-textarea { min-height: 80px; resize: vertical; font-family: inherit; }
                .setup-label { font-size: 0.85rem; font-weight: 600; color: #475569; margin: 16px 0 8px; display: block; }

                .setup-sidebar { display: flex; flex-direction: column; gap: 16px; }
                .agent-picker { background: white; border-radius: 20px; padding: 20px; border: 1px solid #e2e8f0; }
                .agent-picker h3 { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 0 0 12px; display: flex; align-items: center; gap: 8px; }

                .picker-dept { margin-bottom: 8px; }
                .picker-dept-header { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 8px; cursor: pointer; transition: background 0.2s; font-size: 0.85rem; font-weight: 600; color: #334155; }
                .picker-dept-header:hover { background: #f1f5f9; }
                .picker-dept-header .dept-dot { width: 8px; height: 8px; border-radius: 50%; }
                .picker-dept-agents { padding: 4px 0 4px 24px; }
                .picker-agent { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 8px; cursor: pointer; font-size: 0.82rem; color: #475569; transition: all 0.2s; }
                .picker-agent:hover { background: #f1f5f9; }
                .picker-agent.selected { background: rgba(99,102,241,0.08); color: #6366f1; font-weight: 600; }
                .picker-check { width: 16px; height: 16px; border-radius: 4px; border: 2px solid #cbd5e1; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; }
                .picker-check.checked { background: #6366f1; border-color: #6366f1; }

                .selected-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
                .selected-tag { display: flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; background: rgba(99,102,241,0.08); color: #6366f1; font-size: 0.78rem; font-weight: 600; }
                .selected-tag button { background: none; border: none; cursor: pointer; color: #6366f1; padding: 0; display: flex; }

                .start-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 16px; border-radius: 14px; border: none; font-size: 1rem; font-weight: 700; color: white; background: linear-gradient(135deg, #6366f1, #8b5cf6); cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 14px rgba(99,102,241,0.3); }
                .start-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99,102,241,0.4); }
                .start-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

                /* ---- Running Phase ---- */
                .meeting-room { display: grid; grid-template-columns: 1fr 260px; gap: 20px; height: calc(100vh - 180px); }
                @media (max-width: 768px) { .meeting-room { grid-template-columns: 1fr; } }

                .chat-area { background: white; border-radius: 20px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
                .chat-header { padding: 16px 20px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: space-between; }
                .chat-title { font-size: 1rem; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 8px; }
                .chat-badge { padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; }
                .chat-badge.active { background: rgba(34,197,94,0.1); color: #16a34a; }
                .chat-badge.done { background: rgba(99,102,241,0.1); color: #6366f1; }

                .chat-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
                .chat-msg { display: flex; gap: 12px; animation: msgIn 0.4s ease; }
                @keyframes msgIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .chat-msg-avatar { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; }
                .chat-msg-body { flex: 1; min-width: 0; }
                .chat-msg-name { font-size: 0.78rem; font-weight: 700; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
                .chat-msg-role { font-size: 0.68rem; font-weight: 400; color: #94a3b8; }
                .chat-msg-content { font-size: 0.88rem; line-height: 1.6; color: #334155; background: #f8fafc; padding: 12px 16px; border-radius: 0 14px 14px 14px; }
                .chat-msg-content.moderator { background: linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.06)); border: 1px solid rgba(99,102,241,0.1); }
                .chat-msg-content.summary { background: linear-gradient(135deg, rgba(34,197,94,0.06), rgba(16,185,129,0.06)); border: 1px solid rgba(34,197,94,0.1); }

                .typing-indicator { display: flex; align-items: center; gap: 8px; padding: 12px 16px; color: #94a3b8; font-size: 0.85rem; }
                .typing-dots { display: flex; gap: 4px; }
                .typing-dots span { width: 6px; height: 6px; border-radius: 50%; background: #94a3b8; animation: bounce 1.4s infinite; }
                .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
                .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-8px); } }

                /* 参与者面板 */
                .participants-panel { background: white; border-radius: 20px; border: 1px solid #e2e8f0; padding: 20px; overflow-y: auto; }
                .participants-panel h3 { font-size: 0.9rem; font-weight: 700; color: #1e293b; margin: 0 0 16px; display: flex; align-items: center; gap: 6px; }
                .participant-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; margin-bottom: 6px; }
                .participant-avatar { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; }
                .participant-info { flex: 1; }
                .participant-name { font-size: 0.82rem; font-weight: 600; color: #1e293b; }
                .participant-dept { font-size: 0.7rem; color: #94a3b8; }
                .participant-speaking { animation: pulse 2s infinite; }
                @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); } 70% { box-shadow: 0 0 0 6px rgba(99,102,241,0); } 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); } }

                /* 会议纪要 */
                .summary-panel { background: white; border-radius: 20px; border: 1px solid #e2e8f0; padding: 24px; margin-top: 20px; }
                .summary-panel h3 { font-size: 1.1rem; font-weight: 700; color: #1e293b; margin: 0 0 16px; display: flex; align-items: center; gap: 8px; }
                .summary-section { margin-bottom: 16px; }
                .summary-section h4 { font-size: 0.85rem; font-weight: 700; color: #475569; margin: 0 0 8px; }
                .summary-list { list-style: none; padding: 0; margin: 0; }
                .summary-list li { font-size: 0.85rem; color: #334155; padding: 6px 0; padding-left: 16px; position: relative; line-height: 1.5; }
                .summary-list li::before { content: ''; position: absolute; left: 0; top: 12px; width: 6px; height: 6px; border-radius: 50%; background: #6366f1; }
                .action-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 6px; font-size: 0.82rem; }
                .action-assignee { font-weight: 700; color: #6366f1; white-space: nowrap; }

                .done-actions { display: flex; gap: 12px; margin-top: 20px; }
                .done-btn { padding: 12px 24px; border-radius: 12px; border: 1px solid #e2e8f0; background: white; font-size: 0.9rem; font-weight: 600; color: #334155; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
                .done-btn:hover { border-color: #6366f1; color: #6366f1; }
                .done-btn.primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; }
            `}</style>

            <div className="meeting-page">
                <div className="meeting-header">
                    <h1><MessageSquare size={28} /> AI 会议室</h1>
                    <p>发起 AI 员工会议，让多个智能体协作讨论解决问题</p>
                </div>

                {/* ---- 设置阶段 ---- */}
                {phase === 'setup' && (
                    <div className="setup-grid">
                        <div className="setup-main">
                            <h2><Sparkles size={18} /> 会议设置</h2>
                            <label className="setup-label">会议主题 *</label>
                            <input
                                className="setup-input"
                                placeholder="例如：讨论下周抖音内容策略"
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                            />
                            <label className="setup-label">补充说明（可选）</label>
                            <textarea
                                className="setup-input setup-textarea"
                                placeholder="例如：目标用户是25-35岁女性，主打护肤品类..."
                                value={userContext}
                                onChange={e => setUserContext(e.target.value)}
                            />

                            {selectedAgents.length > 0 && (
                                <div className="selected-tags" style={{ marginTop: 20 }}>
                                    <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
                                        已选 {selectedAgents.length} 人：
                                    </span>
                                    {selectedAgents.map(id => {
                                        const a = getAgent(id);
                                        return a ? (
                                            <span key={id} className="selected-tag">
                                                {a.avatar} {a.name}
                                                <button onClick={() => toggleAgent(id)}><X size={12} /></button>
                                            </span>
                                        ) : null;
                                    })}
                                </div>
                            )}

                            <button
                                className="start-btn"
                                style={{ marginTop: 24 }}
                                disabled={!topic.trim() || selectedAgents.length === 0}
                                onClick={startMeeting}
                            >
                                <Play size={20} /> 发起会议
                            </button>
                        </div>

                        <div className="setup-sidebar">
                            <div className="agent-picker">
                                <h3><Users size={16} /> 选择参与者</h3>
                                {DEPARTMENTS.map(dept => (
                                    <div key={dept.id} className="picker-dept">
                                        <div
                                            className="picker-dept-header"
                                            onClick={() => setExpandedDept(expandedDept === dept.id ? null : dept.id)}
                                        >
                                            <span className="dept-dot" style={{ background: dept.color }} />
                                            {dept.icon} {dept.name}
                                            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#94a3b8' }}>
                                                {dept.agents.filter(a => selectedAgents.includes(a.id)).length}/{dept.agents.length}
                                            </span>
                                            {expandedDept === dept.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </div>
                                        {expandedDept === dept.id && (
                                            <div className="picker-dept-agents">
                                                <div
                                                    className="picker-agent"
                                                    onClick={() => selectDepartment(dept)}
                                                    style={{ fontWeight: 600, color: '#6366f1', marginBottom: 4 }}
                                                >
                                                    <div className={`picker-check ${dept.agents.every(a => selectedAgents.includes(a.id)) ? 'checked' : ''}`}>
                                                        {dept.agents.every(a => selectedAgents.includes(a.id)) && <CheckCircle size={10} color="white" />}
                                                    </div>
                                                    全选
                                                </div>
                                                {dept.agents.map(agent => (
                                                    <div
                                                        key={agent.id}
                                                        className={`picker-agent ${selectedAgents.includes(agent.id) ? 'selected' : ''}`}
                                                        onClick={() => toggleAgent(agent.id)}
                                                    >
                                                        <div className={`picker-check ${selectedAgents.includes(agent.id) ? 'checked' : ''}`}>
                                                            {selectedAgents.includes(agent.id) && <CheckCircle size={10} color="white" />}
                                                        </div>
                                                        {agent.avatar} {agent.name}
                                                        <span style={{ color: '#94a3b8', fontSize: '0.72rem', marginLeft: 'auto' }}>{agent.role}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 历史会议记录 */}
                {phase === 'setup' && meetingHistory.length > 0 && (
                    <div style={{ maxWidth: 1200, marginTop: 24, background: 'white', borderRadius: 20, padding: 24, border: '1px solid #e2e8f0' }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e293b', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Clock size={16} /> 历史会议记录
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                            {meetingHistory.slice(0, 10).map(record => (
                                <div key={record.id}
                                    onClick={() => {
                                        setViewingHistory(record);
                                        setTopic(record.topic);
                                        setSelectedAgents(record.agents);
                                        setMessages(record.messages);
                                        setSummary(record.summary);
                                        setPhase('done');
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                                        borderRadius: 12, border: '1px solid #e2e8f0', cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#6366f1'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; }}
                                >
                                    <MessageSquare size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {record.topic}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                            {record.createdAt} · {record.agents.length}人参与 · {record.messages.length}条发言
                                        </div>
                                    </div>
                                    <Eye size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {/* ---- 会议进行中 / 完成 ---- */}
                {(phase === 'running' || phase === 'done') && (
                    <>
                        <div className="meeting-room">
                            <div className="chat-area">
                                <div className="chat-header">
                                    <div className="chat-title">
                                        <Mic size={16} /> {topic}
                                    </div>
                                    <span className={`chat-badge ${phase === 'running' ? 'active' : 'done'}`}>
                                        {phase === 'running' ? '讨论中...' : '已结束'}
                                    </span>
                                </div>
                                <div className="chat-messages">
                                    {messages.map(msg => {
                                        const agentProfile = getAgent(msg.agentId);
                                        return (
                                            <div key={msg.id} className="chat-msg">
                                                <div
                                                    className="chat-msg-avatar"
                                                    style={{ background: `${msg.agentColor}15`, color: msg.agentColor }}
                                                >
                                                    {msg.agentAvatar}
                                                </div>
                                                <div className="chat-msg-body">
                                                    <div className="chat-msg-name" style={{ color: msg.agentColor }}>
                                                        {msg.agentName}
                                                        {agentProfile && <span className="chat-msg-role">{agentProfile.role}</span>}
                                                    </div>
                                                    <div className={`chat-msg-content ${msg.type === 'moderator' ? 'moderator' : ''} ${msg.type === 'summary' ? 'summary' : ''}`}>
                                                        {msg.content}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {isLoading && (
                                        <div className="typing-indicator">
                                            <div className="typing-dots">
                                                <span /><span /><span />
                                            </div>
                                            AI 员工正在思考和讨论...
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            </div>

                            <div className="participants-panel">
                                <h3><Users size={16} /> 参与者 ({selectedAgents.length})</h3>
                                {selectedAgents.map(id => {
                                    const agent = getAgent(id);
                                    if (!agent) return null;
                                    const dept = DEPARTMENTS.find(d => d.id === agent.departmentId);
                                    const lastMsg = [...messages].reverse().find(m => m.agentId === id);
                                    const isSpeaking = isLoading && messages.length > 0 && messages[messages.length - 1].agentId !== id;
                                    return (
                                        <div key={id} className={`participant-item ${isSpeaking ? '' : ''}`}>
                                            <div
                                                className="participant-avatar"
                                                style={{ background: `${agent.color}15`, color: agent.color }}
                                            >
                                                {agent.avatar}
                                            </div>
                                            <div className="participant-info">
                                                <div className="participant-name">{agent.name}</div>
                                                <div className="participant-dept">{dept?.name} · {agent.role}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {/* 主持人 */}
                                <div className="participant-item" style={{ opacity: 0.7 }}>
                                    <div className="participant-avatar" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                                        🎙️
                                    </div>
                                    <div className="participant-info">
                                        <div className="participant-name">会议主持人</div>
                                        <div className="participant-dept">AI 主持</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 会议纪要 */}
                        {summary && (
                            <div className="summary-panel">
                                <h3><FileText size={18} /> 会议纪要</h3>

                                {summary.keyPoints?.length > 0 && (
                                    <div className="summary-section">
                                        <h4>✅ 核心共识</h4>
                                        <ul className="summary-list">
                                            {summary.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {summary.disagreements && summary.disagreements.length > 0 && (
                                    <div className="summary-section">
                                        <h4>⚡ 关键分歧</h4>
                                        <ul className="summary-list">
                                            {summary.disagreements.map((d, i) => <li key={i} style={{ borderLeft: '2px solid #f59e0b', paddingLeft: 14 }}>{d}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {summary.highlights && summary.highlights.length > 0 && (
                                    <div className="summary-section">
                                        <h4>💡 亮点观点</h4>
                                        <ul className="summary-list">
                                            {summary.highlights.map((h, i) => <li key={i} style={{ borderLeft: '2px solid #8b5cf6', paddingLeft: 14 }}>{h}</li>)}
                                        </ul>
                                    </div>
                                )}

                                {summary.actionItems?.length > 0 && (
                                    <div className="summary-section">
                                        <h4>📋 行动建议</h4>
                                        {summary.actionItems.map((item, i) => (
                                            <div key={i} className="action-item">
                                                <CheckCircle size={14} color="#6366f1" />
                                                <span className="action-assignee">{item.assignee}</span>
                                                <span>{item.task}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {summary.nextSteps?.length > 0 && (
                                    <div className="summary-section">
                                        <h4>🔜 后续计划</h4>
                                        <ul className="summary-list">
                                            {summary.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {phase === 'done' && (
                            <div className="done-actions">
                                <button className="done-btn" onClick={resetMeeting}>
                                    <Plus size={16} /> 新会议
                                </button>
                                <button className="done-btn" onClick={() => router.push('/departments')}>
                                    <Building2 size={16} /> 部门管理
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}
