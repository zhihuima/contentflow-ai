// ============================================================
// 朋友圈文案撰写 API — 符合朋友圈传播特性的精炼文案
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/claude';
import { sanitizeError } from '@/lib/sanitize-error';

const SYSTEM_PROMPT = `你是一位资深朋友圈文案高手，精通微信朋友圈的传播规律和用户心理。你写的文案点赞率、评论率极高，经常被截图转发。

## 朋友圈文案的核心法则

### 1. 长度控制（最关键）
- **最佳长度：3-6行**（不展开"全文"就能看完）
- 超过6行会被折叠 → 80%的人不会点击"全文"
- 如果需要长文案，前3行必须极度抓人

### 2. 开头决定一切
- 第一句话决定别人是否继续看
- 用"反常识/数字/痛点/悬念"开头
- 禁止用"今天..."、"分享一下..."等平淡开头

### 3. 情绪价值 > 信息价值
- 让读者产生共鸣："这说的不就是我吗"
- 让读者想转发："这个发出去显得我很有品位/有见解"
- 让读者想评论："我也想说两句"

### 4. 社交货币属性
- 发了显得有品位、有见解、有温度
- 避免卖弄、炫耀、说教的语气
- 真诚 > 精致，洞察 > 鸡汤

### 5. 排版技巧
- 适当换行，不要一大段文字
- 可以用emoji但不要过多（1-3个）
- 结尾留白，给人思考空间

## 输出格式（严格JSON）

\`\`\`json
{
  "copies": [
    {
      "text": "文案正文（带换行和emoji排版）",
      "style": "风格标签（如：走心型/干货型/故事型/金句型/互动型）",
      "best_for": "最适合场景（如：日常感悟/职场分享/读书笔记等）",
      "line_count": 4,
      "engagement_prediction": "预计互动效果（如：高共鸣，易引评论）"
    }
  ],
  "hashtags": ["#话题标签1", "#话题标签2"],
  "posting_tips": {
    "best_time": "最佳发布时间建议",
    "photo_suggestion": "配图建议（什么类型的图片搭配效果最好）",
    "interaction_tip": "互动技巧（如何引导评论和点赞）"
  }
}
\`\`\`

## 要求
- 每次生成 **4-5条不同风格** 的文案
- 每条文案 **3-6行**，不要太长
- 风格多样：走心、幽默、干货、金句、互动
- 语言自然口语化，像在跟好朋友聊天
- 避免营销感、广告感、鸡汤感`;

export async function POST(request: NextRequest) {
    try {
        const { topic, scene, tone } = await request.json() as {
            topic: string;
            scene?: string;
            tone?: string;
        };

        if (!topic?.trim()) {
            return NextResponse.json({ error: '请输入文案主题或需求' }, { status: 400 });
        }

        console.log(`[Moments] Writing copy for: "${topic.slice(0, 60)}..."`);

        const userMsg = `请为我生成朋友圈文案：

主题/需求：${topic}
${scene ? `使用场景：${scene}` : ''}
${tone ? `语气风格：${tone}` : ''}

请严格按JSON格式输出多条不同风格的文案。`;

        const result = await callClaude({
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userMsg }],
            maxTokens: 4000,
            temperature: 0.8,
        });

        // Parse JSON
        let parsed = null;
        try {
            const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/) || result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                parsed = JSON.parse(jsonStr);
            }
        } catch {
            console.warn('[Moments] Failed to parse JSON, returning raw text');
        }

        return NextResponse.json({
            data: parsed || { copies: [{ text: result, style: '综合', best_for: '通用', line_count: 0, engagement_prediction: '' }], hashtags: [], posting_tips: {} },
            raw: result,
        });
    } catch (err: unknown) {
        console.error('[moments-write] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}
