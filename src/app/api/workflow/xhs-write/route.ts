// API: 小红书图文笔记生成 (with RAG knowledge injection)
import { NextRequest, NextResponse } from 'next/server';
import { writeXhsNote } from '@/lib/agents/xhs-writer';
import { retrieveChunks, formatChunksForPrompt } from '@/lib/retriever';
import { sanitizeError } from '@/lib/sanitize-error';
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

        // RAG: 检索知识块（小红书模式）
        const queryText = [
            requirement.topic || '',
            selectedTopic.title || '',
            selectedTopic.angle || '',
            requirement.industry || '',
            requirement.content_style || '',
        ].join(' ');
        const chunks = retrieveChunks(queryText, 5, 'xhs');
        const ragContext = formatChunksForPrompt(chunks, 'xhs');

        console.log(`[RAG-XHS] Retrieved ${chunks.length} chunks for: "${queryText.slice(0, 60)}..."`);

        const result = await writeXhsNote(requirement, selectedTopic, ragContext);
        return NextResponse.json({ data: result });
    } catch (err: unknown) {
        console.error('[xhs-write] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}
