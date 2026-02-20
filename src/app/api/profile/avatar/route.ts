import { NextRequest, NextResponse } from 'next/server';
import { findByUsername, updateUser } from '@/lib/user-store';
import fs from 'fs';
import path from 'path';

function getUserId(request: NextRequest): { id: string; username: string } | null {
    const auth = request.cookies.get('workflow_auth')?.value;
    if (!auth) return null;
    const [username] = auth.split(':');
    const user = findByUsername(username);
    if (!user) return null;
    return { id: user.id, username: user.username };
}

// POST /api/profile/avatar — upload avatar image
export async function POST(request: NextRequest) {
    const info = getUserId(request);
    if (!info) return NextResponse.json({ error: '未登录' }, { status: 401 });

    try {
        const formData = await request.formData();
        const file = formData.get('avatar') as File | null;
        if (!file) return NextResponse.json({ error: '请选择头像文件' }, { status: 400 });

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: '仅支持 JPG/PNG/WebP/GIF 格式' }, { status: 400 });
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            return NextResponse.json({ error: '头像大小不能超过 2MB' }, { status: 400 });
        }

        const ext = file.name.split('.').pop() || 'png';
        const filename = `${info.id}.${ext}`;
        const avatarDir = path.join(process.cwd(), 'public/avatars');

        // Ensure directory exists
        if (!fs.existsSync(avatarDir)) {
            fs.mkdirSync(avatarDir, { recursive: true });
        }

        // Remove old avatar if different extension
        const existingFiles = fs.readdirSync(avatarDir).filter(f => f.startsWith(info.id));
        for (const f of existingFiles) {
            fs.unlinkSync(path.join(avatarDir, f));
        }

        // Write new avatar
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(path.join(avatarDir, filename), buffer);

        const avatarPath = `/avatars/${filename}`;
        updateUser(info.id, { avatar: avatarPath });

        return NextResponse.json({ ok: true, avatar: avatarPath });
    } catch {
        return NextResponse.json({ error: '上传失败' }, { status: 500 });
    }
}
