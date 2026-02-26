// API: 提交即梦视频生成任务
import { NextRequest, NextResponse } from 'next/server';
import { submitVideoGenTask, scriptToVideoPrompt } from '@/lib/jimeng';
import { callClaude } from '@/lib/claude';

export async function POST(request: NextRequest) {
    try {
        const { scriptContent, scriptType, ratio } = await request.json() as {
            scriptContent: string;
            scriptType: string;
            ratio?: '16:9' | '9:16' | '1:1';
        };

        if (!scriptContent) {
            return NextResponse.json({ error: '缺少脚本内容' }, { status: 400 });
        }

        // 用 AI 将脚本翻译为高质量视频描述提示词
        const promptRaw = await callClaude({
            system: `你是一位顶尖的 AI 视频导演。你的任务是将文字脚本翻译成精确的视频画面描述，用于 AI 视频生成。

## 你的翻译规则
1. 提取脚本中最具画面感的核心场景（不超过3个）
2. 用电影导演的语言描述画面：镜头运动、光影、人物动作、场景氛围
3. 加入技术参数提示：如"浅景深"、"黄金时刻光线"、"手持跟拍"
4. 输出纯中文描述，控制在150字以内
5. 画面要有情感张力，让人看了就想看完整视频

## 脚本类型对画面风格的影响
- 口播脚本 → 这类脚本需要真人出镜，不适合AI视频生成，直接回复"NOT_SUITABLE"
- 画外音解说 → 注重场景画面、空镜头、意境，适合配合旁白
- 画面故事 → 注重叙事镜头、人物动态、场景切换
- 情景再现 → 注重生活化场景、自然光线、真实感
- 产品展示 → 注重产品特写、使用场景、光影质感

只输出视频描述文字，不要输出其他内容。`,
            messages: [{ role: 'user', content: `脚本类型：${scriptType}\n\n脚本内容：\n${scriptContent}` }],
            temperature: 0.7,
            maxTokens: 400,
        });

        const prompt = promptRaw.trim();

        if (prompt === 'NOT_SUITABLE' || prompt.includes('NOT_SUITABLE')) {
            return NextResponse.json({
                error: '口播脚本需要真人出镜拍摄，不适合 AI 视频生成。建议选择"画外音解说"或"画面故事"类型的脚本再生成视频。',
                notSuitable: true,
            }, { status: 400 });
        }

        // 提交即梦视频生成任务
        const result = await submitVideoGenTask({
            prompt,
            duration: 5,
            ratio: ratio || '16:9',
        });

        return NextResponse.json({
            taskId: result.taskId,
            prompt,
            status: 'submitted',
        });
    } catch (err: unknown) {
        console.error('[video-gen] Submit error:', err);
        const message = err instanceof Error ? err.message : '视频生成失败';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
