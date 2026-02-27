// ============================================================
// 创作分享 API — 生成分享链接 / 获取分享内容
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface ShareEntry {
    id: string;
    userId: string;
    userName: string;
    mode: string;
    title: string;
    content: string;
    score: number | null;
    platform: string;
    createdAt: string;
    viewCount: number;
}

const SHARES_PATH = path.join(process.cwd(), 'src/data/shares.json');

function readShares(): ShareEntry[] {
    try {
        if (!fs.existsSync(SHARES_PATH)) return [];
        const raw = fs.readFileSync(SHARES_PATH, 'utf-8');
        return JSON.parse(raw) as ShareEntry[];
    } catch {
        return [];
    }
}

function writeShares(shares: ShareEntry[]): void {
    const dir = path.dirname(SHARES_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SHARES_PATH, JSON.stringify(shares, null, 2), 'utf-8');
}

function generateId(): string {
    return `share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// POST — 创建分享
export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as {
            userId?: string;
            userName?: string;
            mode: string;
            title: string;
            content: string;
            score?: number | null;
        };

        if (!body.content || !body.title) {
            return NextResponse.json({ error: '缺少标题或内容' }, { status: 400 });
        }

        const modeLabels: Record<string, string> = {
            video: '视频号', xhs: '小红书', douyin: '抖音',
            polish: '润色', imitate: '模仿', wechat: '公众号', moments: '朋友圈',
        };

        const entry: ShareEntry = {
            id: generateId(),
            userId: body.userId || 'anonymous',
            userName: body.userName || '匿名用户',
            mode: body.mode || 'video',
            title: body.title,
            content: body.content,
            score: body.score ?? null,
            platform: modeLabels[body.mode] || body.mode,
            createdAt: new Date().toISOString(),
            viewCount: 0,
        };

        const shares = readShares();
        shares.unshift(entry);
        // Keep max 200 shares
        if (shares.length > 200) shares.length = 200;
        writeShares(shares);

        console.log(`[Share] Created share: ${entry.id} — "${entry.title}"`);

        return NextResponse.json({
            ok: true,
            shareId: entry.id,
            shareUrl: `/share/${entry.id}`,
        });
    } catch (err) {
        console.error('[Share] Error creating share:', err);
        return NextResponse.json({ error: '分享失败' }, { status: 500 });
    }
}

// GET — 获取分享内容
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        // Return list of recent shares
        const shares = readShares();
        return NextResponse.json({
            shares: shares.slice(0, 20).map(s => ({
                id: s.id,
                userName: s.userName,
                title: s.title,
                platform: s.platform,
                score: s.score,
                createdAt: s.createdAt,
                viewCount: s.viewCount,
            })),
        });
    }

    const shares = readShares();
    const share = shares.find(s => s.id === id);
    if (!share) {
        return NextResponse.json({ error: '分享不存在或已过期' }, { status: 404 });
    }

    // Increment view count
    share.viewCount++;
    writeShares(shares);

    return NextResponse.json({ share });
}
