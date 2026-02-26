'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, User, CheckCircle, Lock } from 'lucide-react';

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

            {/* Profile Settings */}
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

                {/* Role & Permissions */}
                <div className="profile-section">
                    <h2 className="profile-section-title">角色与权限</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <span className={`profile-role-badge ${user.role}`} style={{ fontSize: '1rem', padding: '6px 16px' }}>
                            {user.role === 'admin' ? <><Crown size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 管理员</> : <><User size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 普通用户</>}
                        </span>
                    </div>
                    <div className="profile-info-grid">
                        {[
                            { label: '创作工作台', allowed: true },
                            { label: '内容润色', allowed: true },
                            { label: '内容模仿', allowed: true },
                            { label: '历史记录管理', allowed: true },
                            { label: '收藏 & 分享', allowed: true },
                            { label: '用户管理', allowed: user.role === 'admin' },
                            { label: '系统配置', allowed: user.role === 'admin' },
                        ].map(perm => (
                            <div key={perm.label} className="profile-info-item" style={{ opacity: perm.allowed ? 1 : 0.4 }}>
                                <span className="profile-info-label">{perm.allowed ? <CheckCircle size={16} style={{ color: 'var(--success)' }} /> : <Lock size={16} />}</span>
                                <span className="profile-info-value">{perm.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
