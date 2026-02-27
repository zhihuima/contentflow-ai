// ============================================================
// 公众号文章撰写 API — 一键生成符合公众号流量机制的优质文章
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/claude';
import { sanitizeError } from '@/lib/sanitize-error';

const SYSTEM_PROMPT = `你是一位资深公众号运营专家，精通微信生态流量机制、公众号SEO、社交裂变，操盘过多个百万粉丝大号。

你需要根据用户给的主题/需求，撰写一篇完整的公众号爆款文章。

## 微信公众号流量核心机制（你必须融入写作中）

### 1. 推荐流量（占70%+）
- 标题要包含 **热搜关键词** + **情绪触发词**
- 前200字决定推荐权重 → 开头必须极度抓人
- 完读率 > 50% 才能进入推荐池 → 全文节奏紧凑不冗长
- 互动率决定二次推荐 → 多设互动点

### 2. 社交裂变（占20%）
- 文章要有 **金句** 可供分享到朋友圈
- 设置 **转发钩子**（如"转给你身边需要的人"）
- 内容要有 **社交货币属性**（让读者显得有品位/有见解/有温度）

### 3. 搜一搜SEO（占10%）
- 标题和摘要包含搜索长尾关键词
- 文章结构化，使用H2/H3标题
- 内容专业且有深度

## 输出格式要求（严格按此JSON格式输出）

\`\`\`json
{
  "titles": ["标题1（主推推荐流）", "标题2（朋友圈传播向）", "标题3（搜一搜SEO向）"],
  "cover_text": "封面文案（适合做封面图上的文字）",
  "abstract": "文章摘要（显示在转发卡片和公众号列表，120字以内，要有悬念感）",
  "article": "完整文章正文（使用markdown格式，包含H2/H3标题、粗体、引用等排版）",
  "golden_quotes": ["金句1（适合截图分享到朋友圈）", "金句2", "金句3"],
  "seo_keywords": ["关键词1", "关键词2", "关键词3", "关键词4", "关键词5"],
  "word_count": 2500,
  "estimated_read_time": "8分钟",
  "traffic_strategy": {
    "best_publish_time": "推荐发布时间及理由",
    "title_analysis": "标题的流量策略解读",
    "viral_hooks": ["裂变钩子1", "裂变钩子2"],
    "interaction_design": ["互动设计1（提升完读率）", "互动设计2（引导评论）", "互动设计3（引导转发）"],
    "algorithm_tips": ["公众号算法优化建议1", "建议2", "建议3"]
  },
  "article_structure": {
    "hook": "开头钩子（前200字策略说明）",
    "sections": ["段落1主题", "段落2主题", "段落3主题"],
    "cta": "结尾行动号召"
  }
}
\`\`\`

## 写作风格要求
1. **前200字** 必须极度抓人 → 用故事/数据/反常识/痛点开头
2. **中间段落** 信息密度高，每段都有价值点，避免废话水文
3. **节奏感** 长短段交替，重要结论加粗，关键数据突出
4. **口语化** 但不低俗，像一个聪明朋友在跟你分享干货
5. **设悬念** 文中设置2-3个"接下来的内容更炸"式的过渡
6. **金句** 每篇至少3个可截图分享的金句
7. **结尾** 引导关注+收藏+在看+转发

## 文章字数
- 正文 2000-3500 字（太长完读率低，太短推荐权重低）
- 这是公众号算法的甜区`;

export async function POST(request: NextRequest) {
    try {
        const { topic, style, targetAudience } = await request.json() as {
            topic: string;
            style?: string;
            targetAudience?: string;
        };

        if (!topic?.trim()) {
            return NextResponse.json({ error: '请输入文章主题或需求' }, { status: 400 });
        }

        console.log(`[WeChat] Writing article for: "${topic.slice(0, 60)}..."`);

        const userMsg = `请为我撰写一篇公众号爆款文章：

主题/需求：${topic}
${style ? `风格要求：${style}` : ''}
${targetAudience ? `目标读者：${targetAudience}` : ''}

请严格按JSON格式输出完整文章。`;

        const result = await callClaude({
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userMsg }],
            maxTokens: 8000,
            temperature: 0.7,
        });

        // Try to parse JSON from result
        let parsed = null;
        try {
            // Extract JSON from markdown code block if present
            const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/) || result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const jsonStr = jsonMatch[1] || jsonMatch[0];
                parsed = JSON.parse(jsonStr);
            }
        } catch {
            console.warn('[WeChat] Failed to parse JSON, returning raw text');
        }

        return NextResponse.json({
            data: parsed || { article: result, titles: [], golden_quotes: [], seo_keywords: [] },
            raw: result,
        });
    } catch (err: unknown) {
        console.error('[wechat-write] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}
