// API: 质量审核 + 视频号发布建议
import { NextRequest, NextResponse } from 'next/server';
import { reviewQuality } from '@/lib/agents/quality-reviewer';
import { callClaude } from '@/lib/claude';
import { safeParseJSON } from '@/lib/safe-json';
import { sanitizeError } from '@/lib/sanitize-error';
import { VIDEO_PLATFORM_KNOWLEDGE, PUBLISH_ADVICE_PROMPT, PLATFORM_PUBLISH_TIMES } from '@/lib/platform-prompts';
import type { ParsedRequirement, Script, TrafficReport, PlatformAdvice } from '@/lib/types';

async function generateVideoAdvice(
    requirement: ParsedRequirement,
    script: Script,
): Promise<PlatformAdvice> {
    const result = await callClaude({
        system: `你是视频号平台运营专家。${VIDEO_PLATFORM_KNOWLEDGE}\n\n参考最佳发布时间：${PLATFORM_PUBLISH_TIMES.video.join('、')}\n\n${PUBLISH_ADVICE_PROMPT}\n只输出 JSON，不要输出其他文字。`,
        messages: [{
            role: 'user',
            content: `请根据以下内容生成视频号平台的专业发布建议：\n\n## 创作需求\n${JSON.stringify(requirement, null, 2)}\n\n## 脚本内容\n标题：${script.titles?.join('、')}\n口播稿：${script.full_narration?.slice(0, 300)}...\n金句：${script.golden_quotes?.join('、')}`,
        }],
        temperature: 0.5,
        maxTokens: 2048,
    });
    return safeParseJSON<PlatformAdvice>(result, 'video-publish-advice');
}

export async function POST(request: NextRequest) {
    try {
        const { requirement, script, trafficReport } = await request.json() as {
            requirement: ParsedRequirement;
            script: Script;
            trafficReport: TrafficReport;
        };
        if (!requirement || !script || !trafficReport) {
            return NextResponse.json({ error: '缺少必要数据' }, { status: 400 });
        }

        const [reviewResult, adviceResult] = await Promise.all([
            reviewQuality(requirement, script, trafficReport),
            generateVideoAdvice(requirement, script),
        ]);

        return NextResponse.json({
            data: reviewResult,
            platformAdvice: adviceResult,
        });
    } catch (err: unknown) {
        console.error('[review] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}
