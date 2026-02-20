// API: 选题策划
import { NextRequest, NextResponse } from 'next/server';
import { planTopics } from '@/lib/agents/topic-planner';
import { sanitizeError } from '@/lib/sanitize-error';
import type { ParsedRequirement } from '@/lib/types';

export async function POST(request: NextRequest) {
    try {
        const { requirement } = await request.json() as { requirement: ParsedRequirement };
        if (!requirement) {
            return NextResponse.json({ error: '缺少需求数据' }, { status: 400 });
        }
        const result = await planTopics(requirement);
        return NextResponse.json({ data: result });
    } catch (err: unknown) {
        console.error('[topics] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}
