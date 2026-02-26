'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, ReactNode } from 'react';
import { User, Pencil, Share2, Star, Trash2, X, Menu, Building2, MessageSquare, Sparkles, ListChecks, Phone } from 'lucide-react';

interface NavItem {
    key: string;
    label: string;
    icon: ReactNode;
    href: string;
    adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    { key: 'profile', label: '个人中心', icon: <User size={16} />, href: '/profile' },
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

interface RunningTask {
    id: string;
    title: string;
    mode: string;
    modeLabel: string;
    stage: string;
}

const RESULT_HISTORY_KEY = 'workflow_result_history';
const RUNNING_TASK_KEY = 'workflow_running_task';

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
    const [runningTask, setRunningTask] = useState<RunningTask | null>(null);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

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

    // Load running task from localStorage
    const loadRunningTask = useCallback(() => {
        try {
            const stored = localStorage.getItem(RUNNING_TASK_KEY);
            if (stored) {
                const task = JSON.parse(stored);
                setRunningTask({
                    id: task.id,
                    title: task.title || '创作任务',
                    mode: task.mode,
                    modeLabel: task.modeLabel || MODE_LABELS[task.mode] || task.mode,
                    stage: task.stage,
                });
            } else {
                setRunningTask(null);
            }
        } catch { setRunningTask(null); }
    }, []);

    useEffect(() => {
        if (pathname !== '/login') {
            fetchUser();
            loadHistory();
            loadRunningTask();
        }
    }, [pathname, fetchUser, loadHistory, loadRunningTask]);

    // Listen for storage changes and running task updates
    useEffect(() => {
        const handler = () => { loadHistory(); loadRunningTask(); };
        const runningHandler = () => loadRunningTask();
        window.addEventListener('storage', handler);
        window.addEventListener('resultHistoryUpdated', handler);
        window.addEventListener('runningTaskUpdated', runningHandler);
        return () => {
            window.removeEventListener('storage', handler);
            window.removeEventListener('resultHistoryUpdated', handler);
            window.removeEventListener('runningTaskUpdated', runningHandler);
        };
    }, [loadHistory, loadRunningTask]);

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
        // Navigate to workspace first if not already there
        if (pathname !== '/workspace') {
            router.push('/workspace');
            // Delay event dispatch to allow page.tsx to mount and listen
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('loadHistoryEntry', { detail: { id: entry.id } }));
            }, 300);
        } else {
            window.dispatchEvent(new CustomEvent('loadHistoryEntry', { detail: { id: entry.id } }));
        }
        setSidebarOpen(false);
    };

    // History item actions
    const deleteHistoryItem = (id: string) => {
        try {
            const stored = localStorage.getItem(RESULT_HISTORY_KEY);
            if (stored) {
                const entries = JSON.parse(stored).filter((e: { id: string }) => e.id !== id);
                localStorage.setItem(RESULT_HISTORY_KEY, JSON.stringify(entries));
                loadHistory();
                window.dispatchEvent(new CustomEvent('resultHistoryUpdated'));
            }
        } catch { /* ignore */ }
        setActiveMenuId(null);
    };

    const shareHistoryItem = (entry: HistoryEntry) => {
        try {
            const stored = localStorage.getItem(RESULT_HISTORY_KEY);
            if (stored) {
                const full = JSON.parse(stored).find((e: { id: string }) => e.id === entry.id);
                const text = full?.summary
                    ? `【${MODE_LABELS[entry.mode] || entry.mode}】${entry.title}\n\n${full.summary}`
                    : `【${MODE_LABELS[entry.mode] || entry.mode}】${entry.title}`;
                navigator.clipboard.writeText(text).then(() => {
                    showToast('已复制到剪贴板');
                });
            }
        } catch { /* ignore */ }
        setActiveMenuId(null);
    };

    const startRename = (entry: HistoryEntry) => {
        setRenamingId(entry.id);
        setRenameValue(entry.title);
        setActiveMenuId(null);
    };

    const commitRename = (id: string) => {
        if (!renameValue.trim()) { setRenamingId(null); return; }
        try {
            const stored = localStorage.getItem(RESULT_HISTORY_KEY);
            if (stored) {
                const entries = JSON.parse(stored).map((e: { id: string; title: string }) =>
                    e.id === id ? { ...e, title: renameValue.trim() } : e
                );
                localStorage.setItem(RESULT_HISTORY_KEY, JSON.stringify(entries));
                loadHistory();
                window.dispatchEvent(new CustomEvent('resultHistoryUpdated'));
            }
        } catch { /* ignore */ }
        setRenamingId(null);
    };

    const toggleFavorite = (entry: HistoryEntry) => {
        try {
            const stored = localStorage.getItem(RESULT_HISTORY_KEY);
            const favKey = 'workflow_favorites';
            const favs: string[] = JSON.parse(localStorage.getItem(favKey) || '[]');
            if (favs.includes(entry.id)) {
                localStorage.setItem(favKey, JSON.stringify(favs.filter(f => f !== entry.id)));
                showToast('已取消收藏');
            } else {
                localStorage.setItem(favKey, JSON.stringify([...favs, entry.id]));
                showToast('已收藏');
            }
        } catch { /* ignore */ }
        setActiveMenuId(null);
    };

    const [toastMsg, setToastMsg] = useState('');
    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 2000);
    };

    // Close menu on outside click
    useEffect(() => {
        if (!activeMenuId) return;
        const handler = () => setActiveMenuId(null);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [activeMenuId]);

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
                <div className="sidebar-brand" onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
                    <div className="sidebar-logo">
                        <span className="logo-icon">CF</span>
                        <div className="logo-text">
                            <span className="logo-name">ContentFlow</span>
                            <span className="logo-version">创流 AI</span>
                        </div>
                    </div>
                </div>

                {/* New Task Button — right below logo */}
                <button
                    className="sidebar-new-task-btn"
                    onClick={() => {
                        window.dispatchEvent(new CustomEvent('newWorkspaceSession'));
                        setSidebarOpen(false);
                        if (pathname !== '/workspace') router.push('/workspace');
                    }}
                >
                    <span className="new-task-icon">＋</span>
                    新建任务
                </button>

                {/* Platform navigation */}
                <div className="sidebar-nav-section">
                    <button
                        className={`sidebar-nav-link ${pathname === '/departments' ? 'active' : ''}`}
                        onClick={() => { router.push('/departments'); setSidebarOpen(false); }}
                    >
                        <Building2 size={16} />
                        <span>部门管理</span>
                        <span className="nav-badge">5</span>
                    </button>
                    <button
                        className={`sidebar-nav-link ${pathname === '/meeting' ? 'active' : ''}`}
                        onClick={() => { router.push('/meeting'); setSidebarOpen(false); }}
                    >
                        <MessageSquare size={16} />
                        <span>AI 会议室</span>
                    </button>
                    <button
                        className={`sidebar-nav-link ${pathname === '/contacts' ? 'active' : ''}`}
                        onClick={() => { router.push('/contacts'); setSidebarOpen(false); }}
                    >
                        <Phone size={16} />
                        <span>AI 通讯录</span>
                    </button>
                    <button
                        className={`sidebar-nav-link ${pathname === '/tasks' ? 'active' : ''}`}
                        onClick={() => { router.push('/tasks'); setSidebarOpen(false); }}
                    >
                        <ListChecks size={16} />
                        <span>任务中心</span>
                    </button>
                    <button
                        className={`sidebar-nav-link ${pathname === '/workspace' ? 'active' : ''}`}
                        onClick={() => { router.push('/workspace'); setSidebarOpen(false); }}
                    >
                        <Sparkles size={16} />
                        <span>创作工作区</span>
                    </button>
                </div>

                {/* History Section — expanded, takes most space */}
                <div className="sidebar-history sidebar-history-expanded">
                    <div className="sidebar-history-header">
                        <span className="nav-section-label">历史记录</span>
                    </div>
                    <div className="sidebar-history-list">
                        {/* Running task — show at top with spinner */}
                        {runningTask && pathname !== '/workspace' && (
                            <button
                                className="sidebar-history-item sidebar-running-task"
                                onClick={() => {
                                    router.push('/workspace');
                                    setSidebarOpen(false);
                                }}
                                title={`[${runningTask.modeLabel}] ${runningTask.title} — 进行中`}
                            >
                                <span className="sidebar-running-spinner" />
                                <span className={`sidebar-history-mode-tag mode-${runningTask.mode}`}>{runningTask.modeLabel}</span>
                                <span className="sidebar-history-text">{runningTask.title}</span>
                            </button>
                        )}
                        {historyList.length === 0 && !runningTask && (
                            <div className="sidebar-history-empty">暂无创作记录</div>
                        )}
                        {groupedHistory.map(group => (
                            <div key={group.label} className="sidebar-history-group">
                                <div className="sidebar-history-group-label">{group.label}</div>
                                {group.items.map(entry => (
                                    <div key={entry.id} className="sidebar-history-item-wrap">
                                        {renamingId === entry.id ? (
                                            <div className="sidebar-rename-input">
                                                <input
                                                    autoFocus
                                                    value={renameValue}
                                                    onChange={e => setRenameValue(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') commitRename(entry.id); if (e.key === 'Escape') setRenamingId(null); }}
                                                    onBlur={() => commitRename(entry.id)}
                                                />
                                            </div>
                                        ) : (
                                            <button
                                                className="sidebar-history-item"
                                                onClick={() => handleHistoryClick(entry)}
                                                title={`[${MODE_LABELS[entry.mode] || entry.mode}] ${entry.title}`}
                                            >
                                                <span className={`sidebar-history-mode-tag mode-${entry.mode}`}>{MODE_LABELS[entry.mode] || entry.mode}</span>
                                                <span className="sidebar-history-text">{entry.title || '未命名创作'}</span>
                                            </button>
                                        )}
                                        <button
                                            className="sidebar-history-menu-btn"
                                            onClick={e => { e.stopPropagation(); setActiveMenuId(activeMenuId === entry.id ? null : entry.id); }}
                                        >⋯</button>
                                        {activeMenuId === entry.id && (
                                            <div className="sidebar-history-dropdown" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => startRename(entry)}><Pencil size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 重命名</button>
                                                <button onClick={() => shareHistoryItem(entry)}><Share2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 分享</button>
                                                <button onClick={() => toggleFavorite(entry)}><Star size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 收藏</button>
                                                <button className="danger" onClick={() => deleteHistoryItem(entry.id)}><Trash2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 删除</button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Toast notification */}
                {toastMsg && <div className="sidebar-toast">{toastMsg}</div>}

                {/* Bottom: ChatGPT-style user row */}
                <div className="sidebar-bottom-group">
                    <div className="gpt-user-row" onClick={() => { router.push('/profile'); setSidebarOpen(false); }}>
                        <div className="gpt-user-avatar">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                                (user?.name?.[0] || user?.username?.[0] || '?').toUpperCase()
                            )}
                        </div>
                        <span className="gpt-user-name">{user?.name || user?.username || '用户'}</span>
                    </div>
                    <button
                        className="gpt-logout-btn"
                        onClick={handleLogout}
                        title="退出登录"
                    >
                        退出
                    </button>
                </div>
            </aside>

            {/* Mobile hamburger */}
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
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
