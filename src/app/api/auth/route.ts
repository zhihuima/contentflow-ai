import { NextRequest, NextResponse } from 'next/server';
import { findByPassword, findByUsername, updateLastLogin } from '@/lib/user-store';

// Fallback password for serverless environments where users.json can't be read
const FALLBACK_PASSWORD = process.env.AUTH_PASSWORD || 'meijiehua';

export async function POST(request: NextRequest) {
    let body;
    try {
        body = await request.json();
    } catch (parseErr) {
        console.error('[auth] Failed to parse request body:', parseErr);
        return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }

    try {
        const { password, username } = body;
        console.log('[auth] Login attempt:', { username: username || '(password-only)', hasPassword: !!password });

        // Support both legacy (password-only) and new (username+password) login
        let user;
        if (username) {
            user = findByUsername(username);
            if (!user || user.password !== password) {
                return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
            }
        } else {
            user = findByPassword(password);
            // Fallback: if users.json can't be read (e.g., Vercel serverless), check env/default password
            if (!user && (password === FALLBACK_PASSWORD)) {
                console.log('[auth] Using fallback admin user');
                user = {
                    id: 'admin-001',
                    name: '管理员',
                    username: 'admin',
                    password: FALLBACK_PASSWORD,
                    role: 'admin' as const,
                    createdAt: '2026-01-01T00:00:00.000Z',
                    lastLogin: new Date().toISOString(),
                };
            }
            if (!user) {
                return NextResponse.json({ error: '密码错误' }, { status: 401 });
            }
        }

        // Update last login time (may fail on serverless, non-critical)
        try {
            updateLastLogin(user.id);
        } catch (e) {
            console.warn('[auth] updateLastLogin failed (expected on serverless):', e);
        }

        const response = NextResponse.json({
            ok: true,
            user: { id: user.id, name: user.name, username: user.username, role: user.role },
        });

        // Store auth info in cookie (username:role for middleware)
        response.cookies.set('workflow_auth', `${user.username}:${user.role}`, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return response;
    } catch (err) {
        console.error('[auth] Unexpected error:', err);
        return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
    }
}

