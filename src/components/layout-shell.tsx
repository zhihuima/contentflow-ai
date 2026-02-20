'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

interface NavItem {
    key: string;
    label: string;
    icon: string;
    href: string;
    adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    { key: 'workspace', label: '创作工作台', icon: 'W', href: '/' },
    { key: 'profile', label: '个人中心', icon: 'P', href: '/profile' },
    { key: 'admin', label: '用户管理', icon: 'U', href: '/admin', adminOnly: true },
];

interface UserInfo {
    username: string;
    name: string;
    role: string;
    avatar?: string;
}

interface HistoryEntry {
    id: string;
    title: string;
    mode: string;
    createdAt: number;
}

const RESULT_HISTORY_KEY = 'workflow_result_history';

const MODE_LABELS: Record<string, string> = {
    video: '视频号',
    xhs: '小红书',
    douyin: '抖音',
    polish: '润色',
};

export default function LayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState('');
    const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);

    const fetchUser = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                setUser(data.user);
                if (data.user?.avatar) setAvatarUrl(data.user.avatar);
            }
        } catch {
            // ignore
        }
    }, []);

    // Load history from localStorage
    const loadHistory = useCallback(() => {
        try {
            const stored = localStorage.getItem(RESULT_HISTORY_KEY);
            if (stored) {
                const entries = JSON.parse(stored) as { id: string; title: string; mode: string; createdAt: number }[];
                setHistoryList(entries.map(e => ({
                    id: e.id,
                    title: e.title.replace(/^\[.*?\]\s*/, ''), // Remove mode prefix like [视频号]
                    mode: e.mode,
                    createdAt: e.createdAt,
                })));
            }
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        if (pathname !== '/login') {
            fetchUser();
            loadHistory();
        }
    }, [pathname, fetchUser, loadHistory]);

    // Listen for storage changes (when page.tsx saves a new result)
    useEffect(() => {
        const handler = () => loadHistory();
        window.addEventListener('storage', handler);
        // Also listen for custom event from same tab
        window.addEventListener('resultHistoryUpdated', handler);
        return () => {
            window.removeEventListener('storage', handler);
            window.removeEventListener('resultHistoryUpdated', handler);
        };
    }, [loadHistory]);

    // Don't wrap login page
    if (pathname === '/login') {
        return <>{children}</>;
    }

    const visibleNav = NAV_ITEMS.filter(n => !n.adminOnly || user?.role === 'admin');

    const handleLogout = () => {
        document.cookie = 'workflow_auth=; path=/; max-age=0';
        router.push('/login');
    };

    const handleHistoryClick = (entry: HistoryEntry) => {
        // Dispatch custom event to page.tsx
        window.dispatchEvent(new CustomEvent('loadHistoryEntry', { detail: { id: entry.id } }));
        setSidebarOpen(false);
    };

    // Group history by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const groupedHistory: { label: string; items: HistoryEntry[] }[] = [];
    const todayItems = historyList.filter(e => e.createdAt >= today.getTime());
    const yesterdayItems = historyList.filter(e => e.createdAt >= yesterday.getTime() && e.createdAt < today.getTime());
    const weekItems = historyList.filter(e => e.createdAt >= sevenDaysAgo.getTime() && e.createdAt < yesterday.getTime());
    const olderItems = historyList.filter(e => e.createdAt < sevenDaysAgo.getTime());

    if (todayItems.length > 0) groupedHistory.push({ label: '今天', items: todayItems });
    if (yesterdayItems.length > 0) groupedHistory.push({ label: '昨天', items: yesterdayItems });
    if (weekItems.length > 0) groupedHistory.push({ label: '最近 7 天', items: weekItems });
    if (olderItems.length > 0) groupedHistory.push({ label: '更早', items: olderItems });

    return (
        <div className="platform-layout">
            {/* Sidebar */}
            <aside className={`platform-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-brand">
                    <div className="sidebar-logo">
                        <span className="logo-icon">CF</span>
                        <div className="logo-text">
                            <span className="logo-name">ContentFlow</span>
                            <span className="logo-version">创流 AI</span>
                        </div>
                    </div>
                    <button
                        className="sidebar-new-chat-btn"
                        onClick={() => {
                            window.dispatchEvent(new CustomEvent('newWorkspaceSession'));
                            setSidebarOpen(false);
                            if (pathname !== '/') router.push('/');
                        }}
                        title="新建创作"
                    >
                        +
                    </button>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section-label">功能导航</div>
                    {visibleNav.map(item => (
                        <button
                            key={item.key}
                            className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                            onClick={() => { router.push(item.href); setSidebarOpen(false); }}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span className="nav-label">{item.label}</span>
                        </button>
                    ))}
                </nav>

                {/* History Section - Gemini Style */}
                <div className="sidebar-history">
                    <div className="sidebar-history-header">
                        <span className="nav-section-label">历史记录</span>
                    </div>
                    <div className="sidebar-history-list">
                        {groupedHistory.length === 0 && (
                            <div className="sidebar-history-empty">暂无创作记录</div>
                        )}
                        {groupedHistory.map(group => (
                            <div key={group.label} className="sidebar-history-group">
                                <div className="sidebar-history-group-label">{group.label}</div>
                                {group.items.map(entry => (
                                    <button
                                        key={entry.id}
                                        className="sidebar-history-item"
                                        onClick={() => handleHistoryClick(entry)}
                                        title={entry.title}
                                    >
                                        <span className={`sidebar-history-dot mode-${entry.mode}`} />
                                        <span className="sidebar-history-text">{entry.title || '未命名创作'}</span>
                                    </button>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="sidebar-footer">
                    <div className="sidebar-user" onClick={() => { router.push('/profile'); setSidebarOpen(false); }} style={{ cursor: 'pointer' }}>
                        <div className="user-avatar">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                user?.name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || '?'
                            )}
                        </div>
                        <div className="user-info">
                            <div className="user-name">{user?.name || '加载中...'}</div>
                            <div className="user-role">{user?.role === 'admin' ? '管理员' : '用户'}</div>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={handleLogout} title="退出登录">
                        ↗
                    </button>
                </div>
            </aside>

            {/* Mobile hamburger */}
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                {sidebarOpen ? '✕' : '☰'}
            </button>

            {/* Overlay */}
            {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

            {/* Main Content */}
            <main className="platform-main">
                {children}
            </main>
        </div>
    );
}
