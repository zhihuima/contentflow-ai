// ============================================================
// 趋势研究 API Route
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { searchTrends } from '@/lib/agents/web-search';
import { sanitizeError } from '@/lib/sanitize-error';

export async function POST(request: NextRequest) {
    try {
        const { query, topic } = await request.json() as {
            query?: string;
            topic?: string;
        };

        const searchQuery = query || topic || '';
        if (!searchQuery) {
            return NextResponse.json({ error: '缺少搜索关键词' }, { status: 400 });
        }

        console.log(`[Search] Researching trends for: "${searchQuery}"`);
        const research = await searchTrends(searchQuery);

        return NextResponse.json({ data: research });
    } catch (err: unknown) {
        console.error('[search] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}
