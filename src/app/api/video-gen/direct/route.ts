// API: 直接根据用户描述生成视频（不需要先生成脚本）
import { NextRequest, NextResponse } from 'next/server';
import { submitVideoGenTask } from '@/lib/jimeng';

export async function POST(request: NextRequest) {
    try {
        const { prompt, ratio } = await request.json() as {
            prompt: string;
            ratio?: '16:9' | '9:16' | '1:1';
        };

        if (!prompt?.trim()) {
            return NextResponse.json({ error: '请输入视频描述' }, { status: 400 });
        }

        // 根据描述长度自动判断时长
        const duration: 5 | 10 = prompt.length < 50 ? 5 : 10;

        const result = await submitVideoGenTask({
            prompt: prompt.trim(),
            duration,
            ratio: ratio || '16:9',
        });

        return NextResponse.json({
            taskId: result.taskId,
            prompt: prompt.trim(),
            status: 'submitted',
        });
    } catch (err: unknown) {
        console.error('[video-gen/direct] Error:', err);
        const message = err instanceof Error ? err.message : '视频生成失败';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
