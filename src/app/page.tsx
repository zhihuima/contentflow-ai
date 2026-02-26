'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, ReactNode } from 'react';
import { Music, Video, BookOpen, Sparkles, Hand, ArrowRight, Bot, BarChart3, Palette, Zap } from 'lucide-react';

const RESULT_HISTORY_KEY = 'workflow_result_history';

const MODE_CARDS = [
    {
        mode: 'douyin',
        label: '抖音脚本',
        desc: '爆款短视频脚本创作，AI智能编排',
        icon: <Music size={20} />,
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    {
        mode: 'video',
        label: '视频号脚本',
        desc: '微信视频号专属脚本优化',
        icon: <Video size={20} />,
        gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    {
        mode: 'xhs',
        label: '小红书图文',
        desc: '图文笔记 + AI配图一键生成',
        icon: <BookOpen size={20} />,
        gradient: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
    },
    {
        mode: 'polish',
        label: '内容润色',
        desc: '智能改写润色，提升内容质量',
        icon: <Sparkles size={20} />,
        gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    },
];

interface HistoryEntry {
    id: string;
    title: string;
    mode: string;
    score: number | null;
    createdAt: number;
}

const MODE_LABELS: Record<string, string> = {
    video: '视频号',
    xhs: '小红书',
    douyin: '抖音',
    polish: '润色',
};

export default function HomePage() {
    const router = useRouter();
    const [recentHistory, setRecentHistory] = useState<HistoryEntry[]>([]);
    const [greeting, setGreeting] = useState('');
    const [userName, setUserName] = useState('');

    useEffect(() => {
        // Set greeting based on time
        const hour = new Date().getHours();
        if (hour < 6) setGreeting('夜深了');
        else if (hour < 12) setGreeting('早上好');
        else if (hour < 14) setGreeting('中午好');
        else if (hour < 18) setGreeting('下午好');
        else setGreeting('晚上好');

        // Load user
        fetch('/api/auth/me').then(r => r.json()).then(d => {
            if (d.user?.name) setUserName(d.user.name);
        }).catch(() => { });

        // Load recent history
        try {
            const stored = localStorage.getItem(RESULT_HISTORY_KEY);
            if (stored) {
                const entries = JSON.parse(stored);
                setRecentHistory(entries.slice(0, 6));
            }
        } catch { /* ignore */ }
    }, []);

    const handleModeClick = (mode: string) => {
        // Navigate to workspace with mode pre-selected
        router.push(`/workspace?mode=${mode}`);
    };

    const handleHistoryClick = (id: string) => {
        router.push('/workspace');
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('loadHistoryEntry', { detail: { id } }));
        }, 300);
    };

    const formatTime = (ts: number) => {
        const d = new Date(ts);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
        if (diff < 172800000) return '昨天';
        return `${d.getMonth() + 1}/${d.getDate()}`;
    };

    return (
        <div className="home-page">
            {/* Hero Section */}
            <div className="home-hero">
                <div className="home-hero-bg" />
                <div className="home-hero-content">
                    <div className="home-greeting">
                        <span className="home-greeting-emoji"><Hand size={24} /></span>
                        <span>{greeting}，{userName || '创作者'}</span>
                    </div>
                    <h1 className="home-title">
                        用 AI 重新定义<span className="home-title-highlight">内容创作</span>
                    </h1>
                    <p className="home-subtitle">
                        多平台智能创作 · Multi-Agent 深度优化 · 一键生成高质量内容
                    </p>
                    <button className="home-cta" onClick={() => router.push('/workspace')}>
                        <span>开始创作</span>
                        <span className="home-cta-arrow"><ArrowRight size={16} /></span>
                    </button>
                </div>
            </div>

            {/* Mode Cards */}
            <div className="home-section">
                <h2 className="home-section-title">选择创作模式</h2>
                <div className="home-mode-grid">
                    {MODE_CARDS.map(card => (
                        <button
                            key={card.mode}
                            className="home-mode-card"
                            onClick={() => handleModeClick(card.mode)}
                        >
                            <div className="home-mode-icon" style={{ background: card.gradient }}>
                                {card.icon}
                            </div>
                            <div className="home-mode-info">
                                <div className="home-mode-label">{card.label}</div>
                                <div className="home-mode-desc">{card.desc}</div>
                            </div>
                            <span className="home-mode-arrow"><ArrowRight size={16} /></span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Recent History */}
            {recentHistory.length > 0 && (
                <div className="home-section">
                    <h2 className="home-section-title">最近创作</h2>
                    <div className="home-history-grid">
                        {recentHistory.map(entry => (
                            <button
                                key={entry.id}
                                className="home-history-card"
                                onClick={() => handleHistoryClick(entry.id)}
                            >
                                <div className="home-history-header">
                                    <span className={`home-history-tag mode-${entry.mode}`}>
                                        {MODE_LABELS[entry.mode] || entry.mode}
                                    </span>
                                    <span className="home-history-time">{formatTime(entry.createdAt)}</span>
                                </div>
                                <div className="home-history-title">
                                    {(entry.title || '未命名').replace(/^\[.*?\]\s*/, '')}
                                </div>
                                {entry.score !== null && (
                                    <div className="home-history-score">
                                        <span className="score-dot" style={{ background: entry.score >= 80 ? '#22c55e' : entry.score >= 60 ? '#f59e0b' : '#ef4444' }} />
                                        {entry.score}分
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Features */}
            <div className="home-section home-features">
                <div className="home-feature">
                    <div className="home-feature-icon"><Bot size={24} /></div>
                    <div className="home-feature-title">Multi-Agent 协作</div>
                    <div className="home-feature-desc">内容、结构、配图、审核多智能体协同</div>
                </div>
                <div className="home-feature">
                    <div className="home-feature-icon"><BarChart3 size={24} /></div>
                    <div className="home-feature-title">质量评分</div>
                    <div className="home-feature-desc">AI 自动审核评分，确保内容达标</div>
                </div>
                <div className="home-feature">
                    <div className="home-feature-icon"><Palette size={24} /></div>
                    <div className="home-feature-title">AI 智能配图</div>
                    <div className="home-feature-desc">根据内容自动生成高质量配图</div>
                </div>
                <div className="home-feature">
                    <div className="home-feature-icon"><Zap size={24} /></div>
                    <div className="home-feature-title">一键生成</div>
                    <div className="home-feature-desc">输入需求，全自动产出完整内容</div>
                </div>
            </div>
        </div>
    );
}
