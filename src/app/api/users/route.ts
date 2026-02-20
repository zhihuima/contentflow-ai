import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, addUser, deleteUser, updateUser } from '@/lib/user-store';

function getRole(request: NextRequest): string | null {
    const auth = request.cookies.get('workflow_auth')?.value;
    if (!auth) return null;
    const [, role] = auth.split(':');
    return role || null;
}

// GET /api/users — list all users (admin only)
export async function GET(request: NextRequest) {
    if (getRole(request) !== 'admin') {
        return NextResponse.json({ error: '无权限' }, { status: 403 });
    }
    const users = getAllUsers();
    return NextResponse.json({ users });
}

// POST /api/users — add a user (admin only)
export async function POST(request: NextRequest) {
    if (getRole(request) !== 'admin') {
        return NextResponse.json({ error: '无权限' }, { status: 403 });
    }
    try {
        const body = await request.json();
        const { name, username, password, role } = body;
        if (!name || !username || !password) {
            return NextResponse.json({ error: '请填写完整信息' }, { status: 400 });
        }
        const user = addUser({ name, username, password, role: role || 'user' });
        return NextResponse.json({ ok: true, user: { id: user.id, name: user.name, username: user.username, role: user.role, createdAt: user.createdAt } });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : '操作失败' }, { status: 400 });
    }
}

// DELETE /api/users?id=xxx — delete a user (admin only)
export async function DELETE(request: NextRequest) {
    if (getRole(request) !== 'admin') {
        return NextResponse.json({ error: '无权限' }, { status: 403 });
    }
    try {
        const id = request.nextUrl.searchParams.get('id');
        if (!id) return NextResponse.json({ error: '缺少用户 ID' }, { status: 400 });
        const ok = deleteUser(id);
        if (!ok) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : '操作失败' }, { status: 400 });
    }
}

// PATCH /api/users — update a user (admin only)
export async function PATCH(request: NextRequest) {
    if (getRole(request) !== 'admin') {
        return NextResponse.json({ error: '无权限' }, { status: 403 });
    }
    try {
        const body = await request.json();
        const { id, ...data } = body;
        if (!id) return NextResponse.json({ error: '缺少用户 ID' }, { status: 400 });
        const user = updateUser(id, data);
        if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : '操作失败' }, { status: 400 });
    }
}
