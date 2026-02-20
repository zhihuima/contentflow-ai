// API: 内容润色（融合全部知识库标准）
import { NextRequest, NextResponse } from 'next/server';
import { polishContent } from '@/lib/agents/content-polisher';
import { retrieveChunks, formatChunksForPrompt } from '@/lib/retriever';
import { sanitizeError } from '@/lib/sanitize-error';

export async function POST(request: NextRequest) {
    try {
        const { content, platform } = await request.json() as {
            content: string;
            platform?: string;
        };
        if (!content || typeof content !== 'string' || content.trim().length < 10) {
            return NextResponse.json({ error: '请输入至少 10 个字的内容' }, { status: 400 });
        }

        // RAG: 使用 polish 模式，平等检索所有知识库
        const chunks = retrieveChunks(content, 6, 'polish');
        const ragContext = formatChunksForPrompt(chunks, 'polish');

        console.log(`[Polish] RAG retrieved ${chunks.length} chunks for content (${content.length} chars)`);

        const result = await polishContent(content, ragContext, platform || '通用');
        return NextResponse.json({ data: result });
    } catch (err: unknown) {
        console.error('[polish] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}
