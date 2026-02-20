// API: 脚本生成 (with RAG knowledge injection + platform intelligence)
import { NextRequest, NextResponse } from 'next/server';
import { writeScript } from '@/lib/agents/script-writer';
import { retrieveChunks, formatChunksForPrompt } from '@/lib/retriever';
import { sanitizeError } from '@/lib/sanitize-error';
import { VIDEO_PLATFORM_KNOWLEDGE } from '@/lib/platform-prompts';
import type { ParsedRequirement, TopicPlan } from '@/lib/types';

export async function POST(request: NextRequest) {
    try {
        const { requirement, selectedTopic } = await request.json() as {
            requirement: ParsedRequirement;
            selectedTopic: TopicPlan;
        };
        if (!requirement || !selectedTopic) {
            return NextResponse.json({ error: '缺少需求或选题数据' }, { status: 400 });
        }

        // RAG: 根据需求和选题检索相关知识块
        const queryText = [
            requirement.topic || '',
            selectedTopic.title || '',
            selectedTopic.angle || '',
            requirement.industry || '',
            requirement.content_style || '',
        ].join(' ');
        const chunks = retrieveChunks(queryText, 5);
        const ragContext = formatChunksForPrompt(chunks);

        console.log(`[RAG] Retrieved ${chunks.length} chunks for: "${queryText.slice(0, 60)}..."`);

        const enrichedRagContext = `${ragContext}\n\n${VIDEO_PLATFORM_KNOWLEDGE}`;
        const result = await writeScript(requirement, selectedTopic, enrichedRagContext);
        return NextResponse.json({ data: result });
    } catch (err: unknown) {
        console.error('[script] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}
