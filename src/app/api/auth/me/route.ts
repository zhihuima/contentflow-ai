import { NextRequest, NextResponse } from 'next/server';
import { findByUsername } from '@/lib/user-store';

// GET /api/auth/me — return current user info from cookie
export async function GET(request: NextRequest) {
    const authCookie = request.cookies.get('workflow_auth')?.value;
    if (!authCookie) {
        return NextResponse.json({ user: null }, { status: 401 });
    }
    const [username, role] = authCookie.split(':');
    const user = findByUsername(username);
    return NextResponse.json({
        user: {
            id: user?.id || '',
            username: username || '未知用户',
            name: user?.name || username,
            role: role || 'user',
            avatar: user?.avatar || '',
            bio: user?.bio || '',
            createdAt: user?.createdAt || '',
            lastLogin: user?.lastLogin || '',
        },
    });
}
