// API: 小红书质量审核 + 发布建议
import { NextRequest, NextResponse } from 'next/server';
import { reviewXhsNote } from '@/lib/agents/xhs-reviewer';
import { callClaude } from '@/lib/claude';
import { safeParseJSON } from '@/lib/safe-json';
import { sanitizeError } from '@/lib/sanitize-error';
import { XHS_PLATFORM_KNOWLEDGE, PUBLISH_ADVICE_PROMPT, PLATFORM_PUBLISH_TIMES } from '@/lib/platform-prompts';
import type { ParsedRequirement, XhsNote, TrafficReport, PlatformAdvice } from '@/lib/types';

async function generateXhsAdvice(
    requirement: ParsedRequirement,
    note: XhsNote,
): Promise<PlatformAdvice> {
    const result = await callClaude({
        system: `你是小红书平台运营专家。${XHS_PLATFORM_KNOWLEDGE}\n\n参考最佳发布时间：${PLATFORM_PUBLISH_TIMES.xhs.join('、')}\n\n${PUBLISH_ADVICE_PROMPT}\n只输出 JSON，不要输出其他文字。`,
        messages: [{
            role: 'user',
            content: `请根据以下内容生成小红书平台的专业发布建议：\n\n## 创作需求\n${JSON.stringify(requirement, null, 2)}\n\n## 笔记内容\n标题：${note.titles?.join('、')}\n正文：${note.caption?.slice(0, 300)}...\nSEO关键词：${note.seo_keywords?.join('、')}\n话题标签：${note.hashtags?.join(' ')}`,
        }],
        temperature: 0.5,
        maxTokens: 2048,
    });
    return safeParseJSON<PlatformAdvice>(result, 'xhs-publish-advice');
}

export async function POST(request: NextRequest) {
    try {
        const { requirement, note, report } = await request.json() as {
            requirement: ParsedRequirement;
            note: XhsNote;
            report: TrafficReport;
        };
        if (!requirement || !note || !report) {
            return NextResponse.json({ error: '缺少审核数据' }, { status: 400 });
        }

        const [reviewResult, adviceResult] = await Promise.all([
            reviewXhsNote(requirement, note, report),
            generateXhsAdvice(requirement, note),
        ]);

        return NextResponse.json({
            data: reviewResult,
            platformAdvice: adviceResult,
        });
    } catch (err: unknown) {
        console.error('[xhs-review] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}
