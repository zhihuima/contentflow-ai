'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (!password.trim()) {
            setError('请输入密码');
            return;
        }
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password.trim() }),
            });

            if (res.ok) {
                router.push('/');
                router.refresh();
            } else {
                setError('密码错误，请重试');
                setLoading(false);
            }
        } catch {
            setError('网络错误，请重试');
            setLoading(false);
        }
    }

    return (
        <>
            <style>{`
                /* 登录页独立样式 — 覆盖全局 */
                .login-wrap {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, #e0e7ff 0%, #f0e6ff 50%, #dbeafe 100%);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                    position: relative;
                    z-index: 10;
                }
                .login-card {
                    width: 100%;
                    max-width: 400px;
                    padding: 40px;
                    background: rgba(255,255,255,0.9);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-radius: 20px;
                    border: 1px solid rgba(255,255,255,0.5);
                    box-shadow: 0 20px 60px rgba(0,0,0,0.08);
                    text-align: center;
                    position: relative;
                    z-index: 20;
                }
                .login-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 16px;
                    background: rgba(255,255,255,0.9);
                    border: 1px solid rgba(0,0,0,0.06);
                    border-radius: 100px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    letter-spacing: 0.08em;
                    color: #334155;
                    margin-bottom: 24px;
                }
                .login-badge .dot {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: #22c55e;
                    display: inline-block;
                }
                .login-card h1 {
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: #1e293b;
                    margin: 0 0 8px;
                }
                .login-card p.sub {
                    font-size: 0.85rem;
                    color: #64748b;
                    margin: 0 0 28px;
                }
                .login-input {
                    width: 100%;
                    padding: 14px 16px;
                    font-size: 1rem;
                    border: 2px solid #e2e8f0;
                    border-radius: 12px;
                    outline: none;
                    background: #f8fafc;
                    box-sizing: border-box;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    color: #1e293b;
                }
                .login-input:focus {
                    border-color: #818cf8;
                    box-shadow: 0 0 0 3px rgba(79,70,229,0.1);
                }
                .login-input::placeholder {
                    color: #94a3b8;
                }
                .login-error {
                    color: #ef4444;
                    font-size: 0.8rem;
                    margin: 10px 0 0;
                }
                .login-btn {
                    display: block;
                    width: 100%;
                    margin-top: 20px;
                    padding: 14px 0;
                    font-size: 1rem;
                    font-weight: 700;
                    color: #fff !important;
                    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
                    border: none !important;
                    border-radius: 12px;
                    cursor: pointer;
                    position: relative;
                    z-index: 30;
                    box-shadow: 0 4px 14px rgba(99,102,241,0.3);
                    transition: transform 0.15s, box-shadow 0.15s;
                    pointer-events: auto !important;
                    opacity: 1 !important;
                }
                .login-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(99,102,241,0.4);
                }
                .login-btn:active {
                    transform: translateY(0);
                }
                .login-btn.is-loading {
                    opacity: 0.7 !important;
                    cursor: wait;
                }
            `}</style>

            <div className="login-wrap">
                <div className="login-card">
                    <div className="login-badge">
                        <span className="dot" />
                        WORKFLOW AGENT V2.0
                    </div>

                    <h1>访问验证</h1>
                    <p className="sub">请输入访问密码以继续</p>

                    <form onSubmit={onSubmit}>
                        <input
                            className="login-input"
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="请输入密码"
                            autoFocus
                        />

                        {error && <p className="login-error">{error}</p>}

                        <button
                            type="submit"
                            className={`login-btn${loading ? ' is-loading' : ''}`}
                        >
                            {loading ? '验证中...' : '进入系统'}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}
