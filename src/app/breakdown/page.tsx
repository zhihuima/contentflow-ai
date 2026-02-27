'use client';

import { useState, FormEvent } from 'react';
import { Link2, Search, Loader2, Sparkles, Copy, CheckCircle, ArrowRight, Zap } from 'lucide-react';

export default function BreakdownPage() {
    const [url, setUrl] = useState('');
    const [extraContext, setExtraContext] = useState('');
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [contentLength, setContentLength] = useState(0);

    const handleSubmit = async (e?: FormEvent) => {
        e?.preventDefault();
        if (!url.trim() || loading) return;

        setLoading(true);
        setError('');
        setResult('');
        setContentLength(0);

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
            } else {
                setError(data.error || '分析失败，请重试');
            }
        } catch {
            setError('网络错误，请重试');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(result);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const exampleUrls = [
        { label: '小红书爆款', placeholder: 'https://www.xiaohongshu.com/explore/...' },
        { label: '抖音热门', placeholder: 'https://www.douyin.com/video/...' },
        { label: '公众号10w+', placeholder: 'https://mp.weixin.qq.com/s/...' },
        { label: 'B站百万播放', placeholder: 'https://www.bilibili.com/video/...' },
    ];

    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
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
                        <button onClick={handleCopy} style={{
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
                </div>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
    );
}
