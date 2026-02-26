// API: 内容模仿（链接解析 + 伪原创）
import { NextRequest, NextResponse } from 'next/server';
import { fetchAndParseUrl, imitateContent } from '@/lib/agents/content-imitator';
import { retrieveChunks, formatChunksForPrompt } from '@/lib/retriever';
import { sanitizeError } from '@/lib/sanitize-error';

export async function POST(request: NextRequest) {
    try {
        const { url, content, platform } = await request.json() as {
            url?: string;
            content?: string;
            platform: string;
        };

        let sourceContent: string;

        if (url && url.trim()) {
            // Mode 1: Fetch from URL
            console.log(`[imitate] Fetching URL: ${url}`);
            sourceContent = await fetchAndParseUrl(url.trim());
        } else if (content && content.trim().length >= 10) {
            // Mode 2: Direct text paste
            sourceContent = content.trim();
        } else {
            return NextResponse.json(
                { error: '请提供链接或粘贴内容（至少 10 字）' },
                { status: 400 }
            );
        }

        // RAG: retrieve relevant knowledge chunks
        const chunks = retrieveChunks(sourceContent.slice(0, 500), 4, 'polish');
        const ragContext = formatChunksForPrompt(chunks, 'polish');

        console.log(`[imitate] Source content: ${sourceContent.length} chars, platform: ${platform}, RAG: ${chunks.length} chunks`);

        const result = await imitateContent(sourceContent, platform || '小红书', ragContext);
        return NextResponse.json({ data: result });
    } catch (err: unknown) {
        console.error('[imitate] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}
