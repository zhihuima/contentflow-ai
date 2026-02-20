// API: 抖音流量优化 (platform-aware)
import { NextRequest, NextResponse } from 'next/server';
import { optimizeTraffic } from '@/lib/agents/traffic-optimizer';
import { sanitizeError } from '@/lib/sanitize-error';
import type { ParsedRequirement, Script } from '@/lib/types';

export async function POST(request: NextRequest) {
    try {
        const { requirement, script } = await request.json() as {
            requirement: ParsedRequirement;
            script: Script;
        };
        if (!requirement || !script) {
            return NextResponse.json({ error: '缺少需求或脚本数据' }, { status: 400 });
        }
        // 标记为抖音平台
        const douyinRequirement = {
            ...requirement,
            topic: `[抖音平台] ${requirement.topic}`,
        };
        const result = await optimizeTraffic(douyinRequirement, script);
        return NextResponse.json({ data: result });
    } catch (err: unknown) {
        console.error('[douyin-optimize] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}
