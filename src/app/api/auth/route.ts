import { NextRequest, NextResponse } from 'next/server';
import { findByPassword, findByUsername, updateLastLogin } from '@/lib/user-store';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { password, username } = body;

        // Support both legacy (password-only) and new (username+password) login
        let user;
        if (username) {
            user = findByUsername(username);
            if (!user || user.password !== password) {
                return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
            }
        } else {
            user = findByPassword(password);
            if (!user) {
                return NextResponse.json({ error: '密码错误' }, { status: 401 });
            }
        }

        // Update last login time
        updateLastLogin(user.id);

        const response = NextResponse.json({
            ok: true,
            user: { id: user.id, name: user.name, username: user.username, role: user.role },
        });

        // Store auth info in cookie (username:role for middleware)
        response.cookies.set('workflow_auth', `${user.username}:${user.role}`, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return response;
    } catch {
        return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
    }
}
