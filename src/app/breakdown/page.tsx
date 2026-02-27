'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
    Link2, Search, Loader2, Sparkles, Copy, CheckCircle, ArrowRight, Zap,
    Wand2, X, Send, Clock, Trash2, ChevronRight,
} from 'lucide-react';
import { userGetItem, userSetItem, initUserStorage } from '@/lib/user-storage';

const BREAKDOWN_HISTORY_KEY = 'breakdown_history';
const MAX_BREAKDOWN_HISTORY = 30;

interface BreakdownRecord {
    id: string;
    url: string;
    result: string;
    contentLength: number;
    pseudoResult?: string;
    pseudoPlatform?: string;
    createdAt: number;
}

function loadBreakdownHistory(): BreakdownRecord[] {
    try {
        const stored = userGetItem(BREAKDOWN_HISTORY_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
}

function saveBreakdownHistory(records: BreakdownRecord[]) {
    try {
        userSetItem(BREAKDOWN_HISTORY_KEY, JSON.stringify(records.slice(0, MAX_BREAKDOWN_HISTORY)));
    } catch { /* ignore */ }
}

export default function BreakdownPage() {
    const router = useRouter();
    const [url, setUrl] = useState('');
    const [extraContext, setExtraContext] = useState('');
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [contentLength, setContentLength] = useState(0);

    // 历史记录
    const [history, setHistory] = useState<BreakdownRecord[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);

    // 伪原创相关状态
    const [showPseudoModal, setShowPseudoModal] = useState(false);
    const [pseudoPlatform, setPseudoPlatform] = useState('douyin');
    const [pseudoTopic, setPseudoTopic] = useState('');
    const [pseudoTone, setPseudoTone] = useState('');
    const [pseudoLoading, setPseudoLoading] = useState(false);
    const [pseudoResult, setPseudoResult] = useState('');
    const [pseudoError, setPseudoError] = useState('');
    const [pseudoCopied, setPseudoCopied] = useState(false);

    // 加载历史记录
    useEffect(() => {
        setHistory(loadBreakdownHistory());
    }, []);

    const handleSubmit = async (e?: FormEvent) => {
        e?.preventDefault();
        if (!url.trim() || loading) return;

        setLoading(true);
        setError('');
        setResult('');
        setContentLength(0);
        setPseudoResult('');
        setPseudoError('');

        try {
            const res = await fetch('/api/workflow/breakdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url.trim(), extraContext: extraContext.trim() || undefined }),
            });
            const data = await res.json();
            if (res.ok && data.data) {
                setResult(data.data);
                setContentLength(data.contentLength || 0);

                // 保存到历史记录
                const record: BreakdownRecord = {
                    id: `bd-${Date.now()}`,
                    url: url.trim(),
                    result: data.data,
                    contentLength: data.contentLength || 0,
                    createdAt: Date.now(),
                };
                setCurrentRecordId(record.id);
                const updated = [record, ...history];
                setHistory(updated);
                saveBreakdownHistory(updated);
            } else {
                setError(data.error || '分析失败，请重试');
            }
        } catch {
            setError('网络错误，请重试');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async (text: string, setter: (v: boolean) => void) => {
        await navigator.clipboard.writeText(text);
        setter(true);
        setTimeout(() => setter(false), 2000);
    };

    // 加载历史记录
    const loadRecord = (record: BreakdownRecord) => {
        setUrl(record.url);
        setResult(record.result);
        setContentLength(record.contentLength);
        setCurrentRecordId(record.id);
        if (record.pseudoResult) {
            setPseudoResult(record.pseudoResult);
            setPseudoPlatform(record.pseudoPlatform || 'douyin');
        } else {
            setPseudoResult('');
        }
        setError('');
        setShowHistory(false);
    };

    // 删除历史记录
    const deleteRecord = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = history.filter(r => r.id !== id);
        setHistory(updated);
        saveBreakdownHistory(updated);
    };

    // 格式化时间
    const formatTime = (ts: number) => {
        const d = new Date(ts);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
        return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    // 从 URL 提取域名
    const getDomain = (urlStr: string) => {
        try { return new URL(urlStr).hostname.replace('www.', ''); } catch { return urlStr.slice(0, 30); }
    };

    // 生成伪原创
    const handlePseudoOriginal = async () => {
        if (!result || pseudoLoading) return;
        setPseudoLoading(true);
        setPseudoError('');
        setPseudoResult('');

        try {
            const res = await fetch('/api/workflow/pseudo-original', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    breakdownResult: result,
                    platform: pseudoPlatform,
                    topic: pseudoTopic.trim() || undefined,
                    tone: pseudoTone.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (res.ok && data.data) {
                setPseudoResult(data.data);

                // 更新历史记录中的伪原创结果
                if (currentRecordId) {
                    const updated = history.map(r =>
                        r.id === currentRecordId
                            ? { ...r, pseudoResult: data.data, pseudoPlatform }
                            : r
                    );
                    setHistory(updated);
                    saveBreakdownHistory(updated);
                }
            } else {
                setPseudoError(data.error || '生成失败，请重试');
            }
        } catch {
            setPseudoError('网络错误，请重试');
        } finally {
            setPseudoLoading(false);
        }
    };

    // 发送到创作台
    const sendToWorkspace = () => {
        if (!pseudoResult) return;
        sessionStorage.setItem('pseudo_original_import', JSON.stringify({
            content: pseudoResult,
            platform: pseudoPlatform,
            sourceUrl: url,
            createdAt: Date.now(),
        }));
        const modeMap: Record<string, string> = { douyin: 'douyin', video: 'video', xhs: 'xhs' };
        router.push(`/workspace?mode=${modeMap[pseudoPlatform] || 'video'}&import=pseudo-original`);
    };

    const exampleUrls = [
        { label: '小红书爆款', placeholder: 'https://www.xiaohongshu.com/explore/...' },
        { label: '抖音热门', placeholder: 'https://www.douyin.com/video/...' },
        { label: '公众号10w+', placeholder: 'https://mp.weixin.qq.com/s/...' },
        { label: 'B站百万播放', placeholder: 'https://www.bilibili.com/video/...' },
    ];

    const platformOptions = [
        { value: 'douyin', label: '抖音脚本', emoji: '🎵' },
        { value: 'video', label: '视频号脚本', emoji: '📹' },
        { value: 'xhs', label: '小红书图文', emoji: '📕' },
    ];

    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
            {/* Header */}
            <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                        borderRadius: 20, background: 'rgba(245,158,11,0.08)', color: '#f59e0b',
                        fontSize: '0.72rem', fontWeight: 600, marginBottom: 12,
                    }}>
                        <Zap size={12} /> 爆款拆解引擎
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Sparkles size={22} style={{ color: '#f59e0b' }} /> 爆款内容拆解
                    </h1>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', margin: 0 }}>
                        输入任意自媒体链接，AI 自动抓取内容并深度拆解爆款密码
                    </p>
                </div>

                {/* 历史记录按钮 */}
                {history.length > 0 && (
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                            borderRadius: 10, border: '1px solid var(--border-light)',
                            background: showHistory ? 'rgba(245,158,11,0.08)' : 'transparent',
                            color: showHistory ? '#f59e0b' : 'var(--text-secondary)',
                            fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.2s', flexShrink: 0,
                        }}
                    >
                        <Clock size={14} />
                        历史 ({history.length})
                    </button>
                )}
            </div>

            {/* 历史记录面板 */}
            {showHistory && history.length > 0 && (
                <div style={{
                    marginBottom: 20, padding: '16px', borderRadius: 14,
                    border: '1px solid var(--border-light)', background: 'var(--bg-primary)',
                }}>
                    <div style={{
                        fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)',
                        marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                        <Clock size={13} /> 拆解历史记录
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                        {history.map(record => (
                            <button
                                key={record.id}
                                onClick={() => loadRecord(record)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                    borderRadius: 10, border: '1px solid var(--border-light)',
                                    background: currentRecordId === record.id ? 'rgba(245,158,11,0.05)' : 'var(--bg-secondary)',
                                    cursor: 'pointer', textAlign: 'left', width: '100%',
                                    transition: 'all 0.15s',
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>
                                        {getDomain(record.url)}
                                    </div>
                                    <div style={{
                                        fontSize: '0.7rem', color: 'var(--text-tertiary)',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>
                                        {record.url}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                    {record.pseudoResult && (
                                        <span style={{
                                            padding: '2px 6px', borderRadius: 6, fontSize: '0.6rem',
                                            background: 'rgba(99,102,241,0.08)', color: '#6366f1', fontWeight: 600,
                                        }}>
                                            已伪原创
                                        </span>
                                    )}
                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                                        {formatTime(record.createdAt)}
                                    </span>
                                    <button
                                        onClick={(e) => deleteRecord(record.id, e)}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: 'var(--text-tertiary)', padding: 2, display: 'flex',
                                        }}
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                    <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSubmit} style={{
                background: 'var(--bg-primary)', border: '1px solid var(--border-light)',
                borderRadius: 16, padding: 24, marginBottom: 24,
            }}>
                <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                        <Link2 size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                        内容链接
                    </label>
                    <input
                        type="url"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        placeholder="粘贴抖音、小红书、公众号、B站等任意链接..."
                        style={{
                            width: '100%', padding: '14px 16px', borderRadius: 12,
                            border: '2px solid var(--border-light)', background: 'var(--bg-secondary)',
                            fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
                            transition: 'border-color 0.2s',
                        }}
                        onFocus={e => e.target.style.borderColor = '#f59e0b'}
                        onBlur={e => e.target.style.borderColor = 'var(--border-light)'}
                        autoFocus
                    />
                </div>

                {/* Example platforms */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                    {exampleUrls.map(ex => (
                        <span key={ex.label} style={{
                            fontSize: '0.7rem', padding: '3px 10px', borderRadius: 12,
                            background: 'rgba(245,158,11,0.06)', color: '#b45309', fontWeight: 500,
                            border: '1px solid rgba(245,158,11,0.12)',
                        }}>
                            {ex.label}
                        </span>
                    ))}
                </div>

                {/* Extra context */}
                <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>
                        补充信息（可选 — 如果链接无法抓取，可手动粘贴内容）
                    </label>
                    <textarea
                        value={extraContext}
                        onChange={e => setExtraContext(e.target.value)}
                        placeholder="可选：粘贴文案内容、标题、评论数据等补充信息..."
                        rows={3}
                        style={{
                            width: '100%', padding: '10px 14px', borderRadius: 10,
                            border: '1px solid var(--border-light)', background: 'var(--bg-secondary)',
                            fontSize: '0.82rem', resize: 'vertical', outline: 'none',
                            fontFamily: 'inherit', boxSizing: 'border-box',
                        }}
                    />
                </div>

                <button type="submit" disabled={loading || !url.trim()} style={{
                    width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                    background: (loading || !url.trim())
                        ? '#e2e8f0'
                        : 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
                    color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: (loading || !url.trim()) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: (!loading && url.trim()) ? '0 4px 14px rgba(245,158,11,0.3)' : 'none',
                    transition: 'all 0.2s',
                }}>
                    {loading ? (
                        <>
                            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                            正在抓取并分析...
                        </>
                    ) : (
                        <>
                            <Search size={18} />
                            开始拆解
                            <ArrowRight size={16} />
                        </>
                    )}
                </button>
            </form>

            {/* Error */}
            {error && (
                <div style={{
                    padding: '14px 18px', borderRadius: 12, marginBottom: 20,
                    background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
                    fontSize: '0.85rem',
                }}>
                    ⚠️ {error}
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div style={{
                    textAlign: 'center', padding: '40px 20px', color: 'var(--text-tertiary)',
                }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.1))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: '#f59e0b' }} />
                    </div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>AI 正在拆解爆款...</div>
                    <div style={{ fontSize: '0.78rem' }}>
                        抓取内容 → 分析标题 → 拆解结构 → 提炼公式
                    </div>
                </div>
            )}

            {/* Result */}
            {result && (
                <div>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: 12,
                    }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                            已抓取 {contentLength.toLocaleString()} 字符内容并完成分析
                        </div>
                        <button onClick={() => handleCopy(result, setCopied)} style={{
                            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                            borderRadius: 8, border: '1px solid var(--border-light)',
                            background: copied ? '#10b981' : 'transparent',
                            color: copied ? 'white' : 'var(--text-secondary)',
                            fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                        }}>
                            {copied ? <><CheckCircle size={12} /> 已复制</> : <><Copy size={12} /> 复制</>}
                        </button>
                    </div>
                    <div style={{
                        padding: '24px 28px', borderRadius: 16,
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-primary)', lineHeight: 1.8,
                        fontSize: '0.88rem', whiteSpace: 'pre-wrap',
                    }}>
                        {result}
                    </div>

                    {/* 伪原创按钮 */}
                    <div style={{
                        marginTop: 20, display: 'flex', gap: 10, flexWrap: 'wrap',
                    }}>
                        <button
                            onClick={() => { setShowPseudoModal(true); setPseudoResult(''); setPseudoError(''); }}
                            style={{
                                flex: 1, minWidth: 200, padding: '16px 24px', borderRadius: 14, border: 'none',
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                color: 'white', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                                transition: 'all 0.2s',
                            }}
                        >
                            <Wand2 size={18} />
                            基于拆解创作伪原创
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* 伪原创 Modal */}
            {showPseudoModal && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 20,
                }}>
                    <div style={{
                        width: '100%', maxWidth: 640, maxHeight: '90vh',
                        background: 'var(--bg-primary, #fff)', borderRadius: 20,
                        border: '1px solid var(--border-light, #e2e8f0)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '20px 24px', borderBottom: '1px solid var(--border-light, #e2e8f0)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                    width: 36, height: 36, borderRadius: 10,
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Wand2 size={18} color="white" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>AI 伪原创生成</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary, #94a3b8)' }}>
                                        学习爆款结构，生成全新原创内容
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setShowPseudoModal(false)} style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--text-tertiary, #94a3b8)', padding: 4,
                            }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                            {!pseudoResult ? (
                                <>
                                    {/* 平台选择 */}
                                    <div style={{ marginBottom: 20 }}>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 10, color: 'var(--text-secondary, #475569)' }}>
                                            目标平台
                                        </label>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            {platformOptions.map(p => (
                                                <button
                                                    key={p.value}
                                                    onClick={() => setPseudoPlatform(p.value)}
                                                    style={{
                                                        flex: 1, padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
                                                        border: pseudoPlatform === p.value
                                                            ? '2px solid #6366f1'
                                                            : '2px solid var(--border-light, #e2e8f0)',
                                                        background: pseudoPlatform === p.value
                                                            ? 'rgba(99,102,241,0.05)'
                                                            : 'var(--bg-secondary, #f8fafc)',
                                                        textAlign: 'center', transition: 'all 0.2s',
                                                    }}
                                                >
                                                    <div style={{ fontSize: '1.3rem', marginBottom: 4 }}>{p.emoji}</div>
                                                    <div style={{
                                                        fontSize: '0.78rem', fontWeight: 600,
                                                        color: pseudoPlatform === p.value ? '#6366f1' : 'var(--text-secondary, #475569)',
                                                    }}>{p.label}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 自定义主题 */}
                                    <div style={{ marginBottom: 16 }}>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary, #475569)' }}>
                                            创作主题（可选）
                                        </label>
                                        <input
                                            value={pseudoTopic}
                                            onChange={e => setPseudoTopic(e.target.value)}
                                            placeholder="不填则 AI 自动选择相近主题..."
                                            style={{
                                                width: '100%', padding: '12px 14px', borderRadius: 10,
                                                border: '1px solid var(--border-light, #e2e8f0)',
                                                background: 'var(--bg-secondary, #f8fafc)',
                                                fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box',
                                            }}
                                        />
                                    </div>

                                    {/* 语气风格 */}
                                    <div style={{ marginBottom: 24 }}>
                                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary, #475569)' }}>
                                            语气风格（可选）
                                        </label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {['轻松幽默', '专业权威', '认真走心', '情绪张力', '口语化'].map(t => (
                                                <button
                                                    key={t}
                                                    onClick={() => setPseudoTone(pseudoTone === t ? '' : t)}
                                                    style={{
                                                        padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                                                        border: pseudoTone === t ? '1px solid #6366f1' : '1px solid var(--border-light, #e2e8f0)',
                                                        background: pseudoTone === t ? 'rgba(99,102,241,0.08)' : 'transparent',
                                                        color: pseudoTone === t ? '#6366f1' : 'var(--text-secondary, #64748b)',
                                                        fontSize: '0.78rem', fontWeight: 500, transition: 'all 0.2s',
                                                    }}
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {pseudoError && (
                                        <div style={{
                                            padding: '12px 16px', borderRadius: 10, marginBottom: 16,
                                            background: '#fef2f2', border: '1px solid #fecaca',
                                            color: '#dc2626', fontSize: '0.82rem',
                                        }}>
                                            ⚠️ {pseudoError}
                                        </div>
                                    )}

                                    {/* 生成按钮 */}
                                    <button
                                        onClick={handlePseudoOriginal}
                                        disabled={pseudoLoading}
                                        style={{
                                            width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
                                            background: pseudoLoading
                                                ? '#e2e8f0'
                                                : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                            color: 'white', fontWeight: 700, fontSize: '0.95rem',
                                            cursor: pseudoLoading ? 'not-allowed' : 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                            boxShadow: !pseudoLoading ? '0 4px 14px rgba(99,102,241,0.3)' : 'none',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {pseudoLoading ? (
                                            <>
                                                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                                                正在生成伪原创...
                                            </>
                                        ) : (
                                            <>
                                                <Wand2 size={18} />
                                                开始生成
                                            </>
                                        )}
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* 伪原创结果 */}
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        marginBottom: 12,
                                    }}>
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px',
                                            borderRadius: 20, background: 'rgba(34,197,94,0.08)', color: '#16a34a',
                                            fontSize: '0.72rem', fontWeight: 600,
                                        }}>
                                            <CheckCircle size={12} /> 伪原创生成完成
                                        </div>
                                        <button onClick={() => handleCopy(pseudoResult, setPseudoCopied)} style={{
                                            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
                                            borderRadius: 8, border: '1px solid var(--border-light, #e2e8f0)',
                                            background: pseudoCopied ? '#10b981' : 'transparent',
                                            color: pseudoCopied ? 'white' : 'var(--text-secondary, #64748b)',
                                            fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                        }}>
                                            {pseudoCopied ? <><CheckCircle size={12} /> 已复制</> : <><Copy size={12} /> 复制</>}
                                        </button>
                                    </div>
                                    <div style={{
                                        padding: '20px 24px', borderRadius: 14,
                                        border: '1px solid var(--border-light, #e2e8f0)',
                                        background: 'var(--bg-secondary, #f8fafc)', lineHeight: 1.8,
                                        fontSize: '0.85rem', whiteSpace: 'pre-wrap',
                                        maxHeight: 400, overflowY: 'auto',
                                    }}>
                                        {pseudoResult}
                                    </div>

                                    {/* 操作按钮 */}
                                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                                        <button
                                            onClick={() => { setPseudoResult(''); setPseudoError(''); }}
                                            style={{
                                                flex: 1, padding: '12px 0', borderRadius: 10,
                                                border: '1px solid var(--border-light, #e2e8f0)',
                                                background: 'transparent',
                                                color: 'var(--text-secondary, #64748b)',
                                                fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                                            }}
                                        >
                                            重新生成
                                        </button>
                                        <button
                                            onClick={sendToWorkspace}
                                            style={{
                                                flex: 2, padding: '12px 0', borderRadius: 10, border: 'none',
                                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                                color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                                            }}
                                        >
                                            <Send size={15} />
                                            发送到创作台编辑
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
    );
}
