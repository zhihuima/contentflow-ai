// API: 小红书流量优化
import { NextRequest, NextResponse } from 'next/server';
import { optimizeXhsNote } from '@/lib/agents/xhs-optimizer';
import { retrieveChunks, formatChunksForPrompt } from '@/lib/retriever';
import { sanitizeError } from '@/lib/sanitize-error';
import type { ParsedRequirement, XhsNote } from '@/lib/types';

export async function POST(request: NextRequest) {
    try {
        const { requirement, note } = await request.json() as {
            requirement: ParsedRequirement;
            note: XhsNote;
        };
        if (!requirement || !note) {
            return NextResponse.json({ error: '缺少需求或笔记数据' }, { status: 400 });
        }

        // RAG: 检索增长相关知识块
        const queryText = [
            requirement.topic || '',
            '增长', '流量', '优化', '小红书',
            requirement.industry || '',
        ].join(' ');
        const chunks = retrieveChunks(queryText, 3, 'xhs');
        const ragContext = formatChunksForPrompt(chunks, 'xhs');

        const result = await optimizeXhsNote(requirement, note, ragContext);
        return NextResponse.json({ data: result });
    } catch (err: unknown) {
        console.error('[xhs-optimize] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}
