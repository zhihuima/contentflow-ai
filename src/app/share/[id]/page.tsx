'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Eye, Calendar, Award, Copy, CheckCircle, Loader2, Share2, FileText } from 'lucide-react';

interface ShareData {
    id: string;
    userName: string;
    mode: string;
    title: string;
    content: string;
    score: number | null;
    platform: string;
    createdAt: string;
    viewCount: number;
}

export default function ShareDetailPage() {
    const params = useParams();
    const router = useRouter();
    const shareId = params.id as string;

    const [share, setShare] = useState<ShareData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    useEffect(() => {
        if (!shareId) return;
        fetch(`/api/share?id=${shareId}`)
            .then(r => r.json())
            .then(data => {
                if (data.share) {
                    setShare(data.share);
                } else {
                    setError(data.error || '分享不存在');
                }
            })
            .catch(() => setError('加载失败'))
            .finally(() => setLoading(false));
    }, [shareId]);

    const handleCopyContent = async () => {
        if (!share) return;
        await navigator.clipboard.writeText(share.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyLink = async () => {
        await navigator.clipboard.writeText(window.location.href);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: '60vh', color: 'var(--text-tertiary, #94a3b8)',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
                    <div style={{ fontSize: '0.9rem' }}>加载分享内容...</div>
                </div>
            </div>
        );
    }

    if (error || !share) {
        return (
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: '60vh',
            }}>
                <div style={{
                    textAlign: 'center', padding: '40px 30px', borderRadius: 20,
                    background: 'var(--bg-primary, #fff)', border: '1px solid var(--border-light, #e2e8f0)',
                    maxWidth: 400,
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>😕</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>
                        {error || '分享不存在'}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary, #94a3b8)', marginBottom: 20 }}>
                        该分享可能已过期或被删除
                    </div>
                    <button onClick={() => router.push('/')} style={{
                        padding: '10px 24px', borderRadius: 10, border: 'none',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    }}>
                        返回首页
                    </button>
                </div>
            </div>
        );
    }

    const modeColors: Record<string, string> = {
        '视频号': '#6366f1', '小红书': '#ef4444', '抖音': '#1e293b',
        '润色': '#10b981', '模仿': '#f59e0b', '公众号': '#059669', '朋友圈': '#0ea5e9',
    };

    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
            {/* Back button */}
            <button onClick={() => router.push('/')} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                borderRadius: 10, border: '1px solid var(--border-light, #e2e8f0)',
                background: 'transparent', color: 'var(--text-secondary, #64748b)',
                fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', marginBottom: 20,
            }}>
                <ArrowLeft size={16} /> 返回首页
            </button>

            {/* Share Card */}
            <div style={{
                background: 'var(--bg-primary, #fff)', borderRadius: 20,
                border: '1px solid var(--border-light, #e2e8f0)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    padding: '28px 28px 20px', borderBottom: '1px solid var(--border-light, #e2e8f0)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <span style={{
                            padding: '4px 12px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                            color: 'white', background: modeColors[share.platform] || '#6366f1',
                        }}>
                            {share.platform}
                        </span>
                        {share.score !== null && (
                            <span style={{
                                display: 'flex', alignItems: 'center', gap: 4,
                                padding: '4px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
                                background: share.score >= 80 ? 'rgba(34,197,94,0.08)' : share.score >= 60 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
                                color: share.score >= 80 ? '#16a34a' : share.score >= 60 ? '#d97706' : '#dc2626',
                            }}>
                                <Award size={12} /> {share.score}分
                            </span>
                        )}
                    </div>
                    <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 12px', lineHeight: 1.4 }}>
                        {share.title.replace(/^\[.*?\]\s*/, '')}
                    </h1>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.75rem',
                        color: 'var(--text-tertiary, #94a3b8)',
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FileText size={13} /> {share.userName}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={13} /> {formatDate(share.createdAt)}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Eye size={13} /> {share.viewCount} 次查看
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div style={{
                    padding: '28px', lineHeight: 1.9, fontSize: '0.9rem',
                    whiteSpace: 'pre-wrap', color: 'var(--text-primary, #1e293b)',
                }}>
                    {share.content}
                </div>

                {/* Actions */}
                <div style={{
                    padding: '16px 28px 24px', display: 'flex', gap: 10,
                    borderTop: '1px solid var(--border-light, #e2e8f0)',
                }}>
                    <button onClick={handleCopyContent} style={{
                        flex: 1, padding: '12px 0', borderRadius: 10,
                        border: '1px solid var(--border-light, #e2e8f0)',
                        background: copied ? '#10b981' : 'transparent',
                        color: copied ? 'white' : 'var(--text-secondary, #64748b)',
                        fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        transition: 'all 0.2s',
                    }}>
                        {copied ? <><CheckCircle size={15} /> 已复制</> : <><Copy size={15} /> 复制内容</>}
                    </button>
                    <button onClick={handleCopyLink} style={{
                        flex: 1, padding: '12px 0', borderRadius: 10, border: 'none',
                        background: linkCopied
                            ? '#10b981'
                            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: 'white', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        boxShadow: '0 2px 10px rgba(99,102,241,0.2)',
                        transition: 'all 0.2s',
                    }}>
                        {linkCopied ? <><CheckCircle size={15} /> 链接已复制</> : <><Share2 size={15} /> 复制分享链接</>}
                    </button>
                </div>
            </div>

            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
    );
}
