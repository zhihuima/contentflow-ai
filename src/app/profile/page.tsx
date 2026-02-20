'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface UserProfile {
    id: string;
    name: string;
    username: string;
    role: string;
    avatar: string;
    bio: string;
    createdAt: string;
    lastLogin: string;
}

interface ResultHistoryEntry {
    id: string;
    mode: string;
    title: string;
    summary: string;
    score: number | null;
    createdAt: number;
}

const RESULT_HISTORY_KEY = 'contentflow_result_history';

export default function ProfilePage() {
    const router = useRouter();
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Edit states
    const [editName, setEditName] = useState('');
    const [editBio, setEditBio] = useState('');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');

    // History
    const [resultHistory, setResultHistory] = useState<ResultHistoryEntry[]>([]);
    const [historyFilter, setHistoryFilter] = useState('all');

    const avatarInputRef = useRef<HTMLInputElement>(null);

    const fetchUser = useCallback(async () => {
        try {
            const res = await fetch('/api/profile');
            if (!res.ok) { router.push('/login'); return; }
            const data = await res.json();
            setUser(data.user);
            setEditName(data.user.name);
            setEditBio(data.user.bio || '');
        } catch {
            router.push('/login');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    useEffect(() => {
        try {
            const stored = localStorage.getItem(RESULT_HISTORY_KEY);
            if (stored) setResultHistory(JSON.parse(stored));
        } catch { /* ignore */ }
    }, []);

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleSaveProfile = async () => {
        if (!editName.trim()) { showMessage('error', '昵称不能为空'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName.trim(), bio: editBio.trim() }),
            });
            if (res.ok) {
                setUser(prev => prev ? { ...prev, name: editName.trim(), bio: editBio.trim() } : null);
                showMessage('success', '保存成功');
            } else {
                const data = await res.json();
                showMessage('error', data.error || '保存失败');
            }
        } catch { showMessage('error', '网络错误'); }
        finally { setSaving(false); }
    };

    const handleChangePassword = async () => {
        if (!oldPassword) { showMessage('error', '请输入旧密码'); return; }
        if (!newPassword) { showMessage('error', '请输入新密码'); return; }
        if (newPassword.length < 6) { showMessage('error', '新密码至少 6 位'); return; }
        if (newPassword !== confirmPassword) { showMessage('error', '两次输入的密码不一致'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPassword, password: newPassword }),
            });
            if (res.ok) {
                setOldPassword(''); setNewPassword(''); setConfirmPassword('');
                showMessage('success', '密码修改成功');
            } else {
                const data = await res.json();
                showMessage('error', data.error || '密码修改失败');
            }
        } catch { showMessage('error', '网络错误'); }
        finally { setSaving(false); }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('avatar', file);
        try {
            const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok) {
                setUser(prev => prev ? { ...prev, avatar: data.avatar + '?t=' + Date.now() } : null);
                showMessage('success', '头像更新成功');
            } else {
                showMessage('error', data.error || '上传失败');
            }
        } catch { showMessage('error', '上传失败'); }
    };

    const deleteResultHistory = (id: string) => {
        setResultHistory(prev => {
            const updated = prev.filter(e => e.id !== id);
            try { localStorage.setItem(RESULT_HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
            return updated;
        });
    };

    const clearAllHistory = () => {
        setResultHistory([]);
        try { localStorage.removeItem(RESULT_HISTORY_KEY); } catch { /* ignore */ }
    };

    const filteredHistory = historyFilter === 'all'
        ? resultHistory
        : resultHistory.filter(e => e.mode === historyFilter);

    const modeLabels: Record<string, string> = {
        video: '视频号', xhs: '小红书', douyin: '抖音', polish: '润色',
    };

    if (loading) {
        return (
            <div className="profile-loading">
                <div className="spinner" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="profile-page">
            {/* Toast Message */}
            {message && (
                <div className={`profile-toast ${message.type}`}>
                    {message.text}
                </div>
            )}

            {/* Profile Header Card */}
            <div className="profile-header-card">
                <div className="profile-avatar-section">
                    <div
                        className="profile-avatar"
                        onClick={() => avatarInputRef.current?.click()}
                        title="点击更换头像"
                    >
                        {user.avatar ? (
                            <img src={user.avatar} alt="avatar" />
                        ) : (
                            <span className="profile-avatar-text">
                                {user.name?.[0]?.toUpperCase() || '?'}
                            </span>
                        )}
                        <div className="profile-avatar-overlay">更换</div>
                    </div>
                    <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        style={{ display: 'none' }}
                        onChange={handleAvatarUpload}
                    />
                    <div className="profile-user-info">
                        <h1 className="profile-name">{user.name}</h1>
                        <div className="profile-meta">
                            <span className={`profile-role-badge ${user.role}`}>
                                {user.role === 'admin' ? '管理员' : '用户'}
                            </span>
                            <span className="profile-username">@{user.username}</span>
                        </div>
                        {user.bio && <p className="profile-bio">{user.bio}</p>}
                    </div>
                </div>
                <div className="profile-stats">
                    <div className="profile-stat">
                        <span className="profile-stat-value">{resultHistory.length}</span>
                        <span className="profile-stat-label">创作记录</span>
                    </div>
                    <div className="profile-stat">
                        <span className="profile-stat-value">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '-'}
                        </span>
                        <span className="profile-stat-label">注册时间</span>
                    </div>
                    <div className="profile-stat">
                        <span className="profile-stat-value">
                            {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('zh-CN') : '-'}
                        </span>
                        <span className="profile-stat-label">上次登录</span>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="profile-tabs">
                <button
                    className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
                    onClick={() => setActiveTab('profile')}
                >
                    个人设置
                </button>
                <button
                    className={`profile-tab ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    创作历史 {resultHistory.length > 0 && <span className="profile-tab-badge">{resultHistory.length}</span>}
                </button>
            </div>

            {/* Profile Settings */}
            {activeTab === 'profile' && (
                <div className="profile-settings">
                    {/* Basic Info */}
                    <div className="profile-section">
                        <h2 className="profile-section-title">基本信息</h2>
                        <div className="profile-form">
                            <div className="profile-field">
                                <label>用户名</label>
                                <input type="text" value={user.username} disabled />
                                <span className="profile-field-hint">用户名不可修改</span>
                            </div>
                            <div className="profile-field">
                                <label>昵称</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    placeholder="输入昵称"
                                />
                            </div>
                            <div className="profile-field">
                                <label>个人简介</label>
                                <textarea
                                    value={editBio}
                                    onChange={e => setEditBio(e.target.value)}
                                    placeholder="写一句介绍自己..."
                                    rows={3}
                                />
                            </div>
                            <button
                                className="profile-save-btn"
                                onClick={handleSaveProfile}
                                disabled={saving}
                            >
                                {saving ? '保存中...' : '保存修改'}
                            </button>
                        </div>
                    </div>

                    {/* Password Change */}
                    <div className="profile-section">
                        <h2 className="profile-section-title">修改密码</h2>
                        <div className="profile-form">
                            <div className="profile-field">
                                <label>旧密码</label>
                                <input
                                    type="password"
                                    value={oldPassword}
                                    onChange={e => setOldPassword(e.target.value)}
                                    placeholder="输入当前密码"
                                />
                            </div>
                            <div className="profile-field">
                                <label>新密码</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="至少 6 位"
                                />
                            </div>
                            <div className="profile-field">
                                <label>确认新密码</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="再次输入新密码"
                                />
                            </div>
                            <button
                                className="profile-save-btn"
                                onClick={handleChangePassword}
                                disabled={saving}
                            >
                                {saving ? '修改中...' : '修改密码'}
                            </button>
                        </div>
                    </div>

                    {/* Account Info */}
                    <div className="profile-section">
                        <h2 className="profile-section-title">账户信息</h2>
                        <div className="profile-info-grid">
                            <div className="profile-info-item">
                                <span className="profile-info-label">角色</span>
                                <span className="profile-info-value">{user.role === 'admin' ? '管理员' : '普通用户'}</span>
                            </div>
                            <div className="profile-info-item">
                                <span className="profile-info-label">注册时间</span>
                                <span className="profile-info-value">
                                    {user.createdAt ? new Date(user.createdAt).toLocaleString('zh-CN') : '-'}
                                </span>
                            </div>
                            <div className="profile-info-item">
                                <span className="profile-info-label">上次登录</span>
                                <span className="profile-info-value">
                                    {user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-CN') : '-'}
                                </span>
                            </div>
                            <div className="profile-info-item">
                                <span className="profile-info-label">用户 ID</span>
                                <span className="profile-info-value" style={{ fontSize: '0.75rem', opacity: 0.6 }}>{user.id}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="profile-history">
                    <div className="profile-history-toolbar">
                        <div className="profile-history-filters">
                            {['all', 'video', 'xhs', 'douyin', 'polish'].map(f => (
                                <button
                                    key={f}
                                    className={`profile-filter-btn ${historyFilter === f ? 'active' : ''}`}
                                    onClick={() => setHistoryFilter(f)}
                                >
                                    {f === 'all' ? '全部' : modeLabels[f] || f}
                                </button>
                            ))}
                        </div>
                        {resultHistory.length > 0 && (
                            <button className="profile-clear-btn" onClick={clearAllHistory}>
                                清空全部
                            </button>
                        )}
                    </div>

                    {filteredHistory.length === 0 ? (
                        <div className="profile-history-empty">
                            <p>暂无创作记录</p>
                        </div>
                    ) : (
                        <div className="profile-history-list">
                            {filteredHistory.map(entry => (
                                <div key={entry.id} className="profile-history-card">
                                    <div className="profile-history-card-header">
                                        <span className={`profile-history-mode mode-${entry.mode}`}>
                                            {modeLabels[entry.mode] || entry.mode}
                                        </span>
                                        {entry.score !== null && (
                                            <span className="profile-history-score">{entry.score}</span>
                                        )}
                                    </div>
                                    <h3 className="profile-history-title">{entry.title}</h3>
                                    <p className="profile-history-summary">{entry.summary}</p>
                                    <div className="profile-history-card-footer">
                                        <span className="profile-history-time">
                                            {new Date(entry.createdAt).toLocaleString('zh-CN')}
                                        </span>
                                        <button
                                            className="profile-history-delete"
                                            onClick={() => deleteResultHistory(entry.id)}
                                        >
                                            删除
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
