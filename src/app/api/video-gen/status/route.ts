// API: 查询即梦视频生成任务状态
import { NextRequest, NextResponse } from 'next/server';
import { queryVideoGenTask } from '@/lib/jimeng';

export async function POST(request: NextRequest) {
    try {
        const { taskId } = await request.json() as { taskId: string };
        if (!taskId) {
            return NextResponse.json({ error: '缺少任务ID' }, { status: 400 });
        }

        const result = await queryVideoGenTask(taskId);
        return NextResponse.json(result);
    } catch (err: unknown) {
        console.error('[video-gen] Query error:', err);
        const message = err instanceof Error ? err.message : '查询失败';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
