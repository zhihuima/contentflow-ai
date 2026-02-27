// ============================================================
// 伪原创 API — 基于爆款拆解结果生成全新原创内容
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/claude';
import { sanitizeError } from '@/lib/sanitize-error';

export async function POST(request: NextRequest) {
    try {
        const { breakdownResult, platform, topic, tone } = await request.json() as {
            breakdownResult: string;   // 拆解分析文本
            platform: string;          // 目标平台：douyin / video / xhs
            topic?: string;            // 用户指定的新主题（可选）
            tone?: string;             // 语气风格（可选）
        };

        if (!breakdownResult || !platform) {
            return NextResponse.json({ error: '缺少拆解结果或目标平台' }, { status: 400 });
        }

        console.log(`[PseudoOriginal] Generating for platform: ${platform}, topic: ${topic || '(auto)'}`);

        const platformNames: Record<string, string> = {
            douyin: '抖音短视频',
            video: '微信视频号',
            xhs: '小红书图文笔记',
        };

        const platformGuidelines: Record<string, string> = {
            douyin: `【抖音短视频要求】
- 开头 3 秒必须有强 hook，制造悬念/冲突/好奇心
- 节奏紧凑，每 10-15 秒一个信息密度高的段落
- 多用口语化表达、网络热词、情绪词
- 结尾设置互动引导（点赞/评论/关注）
- 总时长建议 30-60 秒的脚本`,
            video: `【视频号要求】
- 开头用故事切入或数据震撼开场
- 内容有深度，信息量大，适当引用数据/案例
- 语言风格可以偏正式但不失温度
- 结尾有金句总结 + 互动引导
- 总时长建议 1-3 分钟的脚本`,
            xhs: `【小红书图文要求】
- 标题用 emoji + 数字 + 痛点公式
- 正文分段清晰，每段配一个小标题
- 多用 emoji 增强视觉效果
- 个人化真实体验感的语言
- 结尾带话题标签和互动问题
- 生成 3 个备选标题`,
        };

        const system = `你是一位资深自媒体创作专家，擅长基于爆款内容分析结果创作全新原创内容。

## 核心原则
你要做的是 **"学方法，不抄内容"**：
1. 学习原文的结构框架、标题公式、情绪节奏
2. 但内容、案例、数据、观点必须全部原创
3. 用新的主题/角度重新演绎同样的爆款公式
4. 确保原创度 > 90%，不能有抄袭感

## 输出格式
根据目标平台输出完整的创作内容：

${platform === 'xhs' ? `
### 输出内容
1. **标题**（3 个备选，带 emoji）
2. **正文**（完整图文笔记，1000-1500 字）
3. **配图建议**（每段对应的配图描述）
4. **话题标签**（5-8 个相关标签）
` : `
### 输出内容
1. **标题**（3 个备选，每个 < 20 字）
2. **开场 Hook**（前 3 秒/前两行）
3. **完整脚本**（分段落，标注时间和画面提示）
4. **金句集锦**（3-5 句可传播的精华语句）
5. **封面建议**（标题文案 + 画面描述）
`}

${platformGuidelines[platform] || platformGuidelines['video']}

## 注意事项
- 用中文输出
- 内容必须原创，严禁照搬原文任何段落
- 保持爆款特质但换全新主题和案例
- 语言自然流畅，像真人创作者写的`;

        const userMessage = `## 爆款拆解分析结果
${breakdownResult}

---

## 创作要求
- 目标平台：${platformNames[platform] || platform}
${topic ? `- 创作主题：${topic}` : '- 创作主题：请基于拆解分析，选择一个类似但不同的原创主题'}
${tone ? `- 语气风格：${tone}` : ''}

请基于以上拆解分析中提炼的爆款公式和结构逻辑，创作一篇**全新原创**的 ${platformNames[platform] || platform} 内容。`;

        const result = await callClaude({
            system,
            messages: [{ role: 'user', content: userMessage }],
            maxTokens: 6000,
            temperature: 0.75,
        });

        return NextResponse.json({ data: result });
    } catch (err: unknown) {
        console.error('[PseudoOriginal] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}
