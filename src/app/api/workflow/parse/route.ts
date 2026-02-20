// API: 需求解析
import { NextRequest, NextResponse } from 'next/server';
import { parseIntent } from '@/lib/agents/intent-parser';
import { sanitizeError } from '@/lib/sanitize-error';

export async function POST(request: NextRequest) {
    try {
        const { userInput } = await request.json();
        if (!userInput || typeof userInput !== 'string') {
            return NextResponse.json({ error: '请输入内容需求' }, { status: 400 });
        }
        const result = await parseIntent(userInput);
        return NextResponse.json({ data: result });
    } catch (err: unknown) {
        console.error('[parse] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}
