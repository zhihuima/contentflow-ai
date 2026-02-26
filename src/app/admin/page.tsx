'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, X, Loader2 } from 'lucide-react';

interface UserItem {
    id: string;
    name: string;
    username: string;
    role: 'admin' | 'user';
    createdAt: string;
    lastLogin: string | null;
}

export default function AdminPage() {
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [form, setForm] = useState({ name: '', username: '', password: '', role: 'user' as 'admin' | 'user' });
    const [error, setError] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch('/api/users');
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            setUsers(data.users || []);
        } catch {
            setError('加载用户列表失败');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleAdd = async () => {
        if (!form.name.trim() || !form.username.trim() || !form.password.trim()) {
            setError('请填写完整信息');
            return;
        }
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '添加失败');
            }
            setShowAddModal(false);
            setForm({ name: '', username: '', password: '', role: 'user' });
            setError('');
            fetchUsers();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '添加失败');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '删除失败');
            }
            setDeleteConfirm(null);
            fetchUsers();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '删除失败');
        }
    };

    const formatTime = (t: string | null) => {
        if (!t) return '—';
        return new Date(t).toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    };

    return (
        <>
            <style>{`
                .admin-page {
                    max-width: 960px;
                    margin: 0 auto;
                    padding: 32px 24px;
                }
                .admin-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 32px;
                }
                .admin-header h1 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #0f172a;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .admin-header h1 .icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #7c3aed, #a855f7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.1rem;
                    color: white;
                }
                .admin-subtitle {
                    font-size: 0.85rem;
                    color: #64748b;
                    margin-top: 4px;
                }
                .admin-stats {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 24px;
                }
                .stat-card {
                    flex: 1;
                    padding: 20px;
                    background: rgba(255,255,255,0.72);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(226,232,240,0.6);
                    border-radius: 14px;
                    box-shadow: 0 1px 3px rgba(15,23,42,0.06);
                }
                .stat-card .stat-value {
                    font-size: 2rem;
                    font-weight: 800;
                    color: #0f172a;
                    line-height: 1;
                }
                .stat-card .stat-label {
                    font-size: 0.8rem;
                    color: #64748b;
                    margin-top: 6px;
                }
                .admin-table-wrap {
                    background: rgba(255,255,255,0.72);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(226,232,240,0.6);
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 4px 16px rgba(15,23,42,0.06);
                }
                .admin-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.88rem;
                }
                .admin-table th {
                    text-align: left;
                    padding: 14px 20px;
                    font-weight: 600;
                    color: #64748b;
                    font-size: 0.78rem;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    background: rgba(243,244,248,0.5);
                    border-bottom: 1px solid rgba(226,232,240,0.6);
                }
                .admin-table td {
                    padding: 14px 20px;
                    border-bottom: 1px solid rgba(241,245,249,0.5);
                    color: #334155;
                }
                .admin-table tr:last-child td { border-bottom: none; }
                .admin-table tr:hover td { background: rgba(243,244,248,0.4); }
                .role-badge {
                    display: inline-block;
                    padding: 3px 10px;
                    border-radius: 100px;
                    font-size: 0.72rem;
                    font-weight: 600;
                    letter-spacing: 0.02em;
                }
                .role-badge.admin {
                    background: linear-gradient(135deg, rgba(124,58,237,0.12), rgba(168,85,247,0.12));
                    color: #7c3aed;
                }
                .role-badge.user {
                    background: rgba(59,130,246,0.1);
                    color: #3b82f6;
                }
                .admin-btn {
                    padding: 8px 20px;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .admin-btn-primary {
                    background: linear-gradient(135deg, #4f46e5, #7c3aed);
                    color: white;
                    box-shadow: 0 2px 8px rgba(79,70,229,0.3);
                }
                .admin-btn-primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 14px rgba(79,70,229,0.4);
                }
                .admin-btn-danger {
                    background: rgba(239,68,68,0.1);
                    color: #dc2626;
                }
                .admin-btn-danger:hover { background: rgba(239,68,68,0.2); }
                .admin-btn-ghost {
                    background: transparent;
                    color: #64748b;
                }
                .admin-btn-ghost:hover { background: rgba(0,0,0,0.04); }
                .action-group {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                /* Modal */
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.4);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                .modal-card {
                    width: 100%;
                    max-width: 440px;
                    background: white;
                    border-radius: 20px;
                    padding: 32px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.15);
                }
                .modal-card h2 {
                    font-size: 1.2rem;
                    font-weight: 700;
                    margin-bottom: 24px;
                    color: #0f172a;
                }
                .form-group {
                    margin-bottom: 16px;
                }
                .form-group label {
                    display: block;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #475569;
                    margin-bottom: 6px;
                }
                .form-input {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 0.9rem;
                    outline: none;
                    transition: border-color 0.2s;
                    box-sizing: border-box;
                    color: #1e293b;
                    background: #f8fafc;
                }
                .form-input:focus {
                    border-color: #818cf8;
                    box-shadow: 0 0 0 3px rgba(79,70,229,0.08);
                }
                .form-select {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 0.9rem;
                    outline: none;
                    background: #f8fafc;
                    color: #1e293b;
                    box-sizing: border-box;
                }
                .modal-actions {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                    margin-top: 24px;
                }
                .error-msg {
                    padding: 10px 16px;
                    background: #fef2f2;
                    color: #dc2626;
                    border-radius: 10px;
                    font-size: 0.82rem;
                    margin-bottom: 16px;
                }
                .empty-state {
                    text-align: center;
                    padding: 60px 20px;
                    color: #94a3b8;
                }
                .empty-state .empty-icon { font-size: 2.5rem; margin-bottom: 12px; }
                @media (max-width: 768px) {
                    .admin-stats { flex-direction: column; }
                    .admin-table { font-size: 0.8rem; }
                    .admin-table th, .admin-table td { padding: 10px 12px; }
                }
            `}</style>

            <div className="admin-page">
                <div className="admin-header">
                    <div>
                        <h1>
                            <span className="icon"><Users size={18} /></span>
                            用户管理
                        </h1>
                        <div className="admin-subtitle">管理平台用户账号、角色和权限</div>
                    </div>
                    <button className="admin-btn admin-btn-primary" onClick={() => setShowAddModal(true)}>
                        + 添加用户
                    </button>
                </div>

                {error && <div className="error-msg">{error} <button className="admin-btn admin-btn-ghost" onClick={() => setError('')} style={{ marginLeft: 8, fontSize: '0.75rem' }}><X size={14} /></button></div>}

                {/* Stats */}
                <div className="admin-stats">
                    <div className="stat-card">
                        <div className="stat-value">{users.length}</div>
                        <div className="stat-label">总用户数</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{users.filter(u => u.role === 'admin').length}</div>
                        <div className="stat-label">管理员</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{users.filter(u => u.role === 'user').length}</div>
                        <div className="stat-label">普通用户</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{users.filter(u => u.lastLogin).length}</div>
                        <div className="stat-label">活跃用户</div>
                    </div>
                </div>

                {/* Table */}
                <div className="admin-table-wrap">
                    {loading ? (
                        <div className="empty-state"><div className="empty-icon"><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>加载中...</div>
                    ) : users.length === 0 ? (
                        <div className="empty-state"><div className="empty-icon"><Users size={32} /></div>暂无用户</div>
                    ) : (
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>用户名</th>
                                    <th>姓名</th>
                                    <th>角色</th>
                                    <th>创建时间</th>
                                    <th>最后登录</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td style={{ fontWeight: 600 }}>{u.username}</td>
                                        <td>{u.name}</td>
                                        <td><span className={`role-badge ${u.role}`}>{u.role === 'admin' ? '管理员' : '用户'}</span></td>
                                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{formatTime(u.createdAt)}</td>
                                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>{formatTime(u.lastLogin)}</td>
                                        <td>
                                            <div className="action-group">
                                                {deleteConfirm === u.id ? (
                                                    <>
                                                        <button className="admin-btn admin-btn-danger" style={{ fontSize: '0.75rem' }} onClick={() => handleDelete(u.id)}>确认删除</button>
                                                        <button className="admin-btn admin-btn-ghost" style={{ fontSize: '0.75rem' }} onClick={() => setDeleteConfirm(null)}>取消</button>
                                                    </>
                                                ) : (
                                                    <button className="admin-btn admin-btn-danger" style={{ fontSize: '0.75rem' }} onClick={() => setDeleteConfirm(u.id)}>删除</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Add User Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <h2>添加用户</h2>
                        <div className="form-group">
                            <label>姓名</label>
                            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="用户姓名" />
                        </div>
                        <div className="form-group">
                            <label>用户名（登录用）</label>
                            <input className="form-input" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="英文用户名" />
                        </div>
                        <div className="form-group">
                            <label>密码</label>
                            <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="登录密码" />
                        </div>
                        <div className="form-group">
                            <label>角色</label>
                            <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'user' }))}>
                                <option value="user">普通用户</option>
                                <option value="admin">管理员</option>
                            </select>
                        </div>
                        <div className="modal-actions">
                            <button className="admin-btn admin-btn-ghost" onClick={() => setShowAddModal(false)}>取消</button>
                            <button className="admin-btn admin-btn-primary" onClick={handleAdd}>确认添加</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
