import { NextRequest, NextResponse } from 'next/server';
import { findByUsername, findById, updateUser } from '@/lib/user-store';

function getUserId(request: NextRequest): { id: string; username: string } | null {
    const auth = request.cookies.get('workflow_auth')?.value;
    if (!auth) return null;
    const [username] = auth.split(':');
    const user = findByUsername(username);
    if (!user) return null;
    return { id: user.id, username: user.username };
}

// GET /api/profile — get current user profile
export async function GET(request: NextRequest) {
    const info = getUserId(request);
    if (!info) return NextResponse.json({ error: '未登录' }, { status: 401 });

    const user = findById(info.id);
    if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });

    return NextResponse.json({
        user: {
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role,
            avatar: user.avatar || '',
            bio: user.bio || '',
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
        },
    });
}

// PATCH /api/profile — update current user profile
export async function PATCH(request: NextRequest) {
    const info = getUserId(request);
    if (!info) return NextResponse.json({ error: '未登录' }, { status: 401 });

    try {
        const body = await request.json();
        const { name, password, oldPassword, bio, avatar } = body;

        // If changing password, verify old password
        if (password) {
            const user = findById(info.id);
            if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
            if (oldPassword !== user.password) {
                return NextResponse.json({ error: '旧密码不正确' }, { status: 400 });
            }
        }

        const updateData: Record<string, string> = {};
        if (name) updateData.name = name;
        if (password) updateData.password = password;
        if (bio !== undefined) updateData.bio = bio;
        if (avatar !== undefined) updateData.avatar = avatar;

        const updated = updateUser(info.id, updateData);
        if (!updated) return NextResponse.json({ error: '更新失败' }, { status: 500 });

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: '操作失败' }, { status: 400 });
    }
}
