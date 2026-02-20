// API: 抖音脚本生成 (with platform intelligence)
import { NextRequest, NextResponse } from 'next/server';
import { writeScript } from '@/lib/agents/script-writer';
import { retrieveChunks, formatChunksForPrompt } from '@/lib/retriever';
import { sanitizeError } from '@/lib/sanitize-error';
import { DOUYIN_PLATFORM_KNOWLEDGE } from '@/lib/platform-prompts';
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

        // 注入抖音平台算法知识到需求中
        const douyinRequirement = {
            ...requirement,
            topic: `[抖音平台] ${requirement.topic}`,
        };

        console.log(`[douyin-script] RAG ${chunks.length} chunks, topic: "${requirement.topic}"`);

        // 将平台知识注入 RAG 上下文
        const enrichedRagContext = `${ragContext}\n\n${DOUYIN_PLATFORM_KNOWLEDGE}`;
        const result = await writeScript(douyinRequirement, selectedTopic, enrichedRagContext);
        return NextResponse.json({ data: result });
    } catch (err: unknown) {
        console.error('[douyin-script] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}
