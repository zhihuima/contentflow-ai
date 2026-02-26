// ============================================================
// Content Imitator Agent — 链接内容模仿（伪原创）
// ============================================================
import { callClaude } from '@/lib/claude';
import { safeParseJSON } from '@/lib/safe-json';

export interface ImitateResult {
    original_summary: string;
    original_title: string;
    titles: string[];
    content: string;
    hashtags: string[];
    keywords: string[];
    platform_tips: string;
    originality_score: number;
}

/**
 * Fetch content from a URL and generate original content inspired by it
 */
export async function fetchAndParseUrl(url: string): Promise<string> {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();

        // Extract meaningful text from HTML
        // Remove scripts, styles, and HTML tags
        let text = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();

        // Also try to extract JSON-LD or meta description for richer context
        const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/) ||
            html.match(/<meta[^>]*name="title"[^>]*content="([^"]*)"/) ||
            html.match(/<title[^>]*>([^<]*)<\/title>/);
        const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/) ||
            html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/);

        let enriched = '';
        if (ogTitle?.[1]) enriched += `标题: ${ogTitle[1]}\n`;
        if (ogDesc?.[1]) enriched += `描述: ${ogDesc[1]}\n`;

        // Try to extract XHS note data from __INITIAL_STATE__
        const xhsMatch = html.match(/"desc"\s*:\s*"([^"]{10,})"/);
        if (xhsMatch?.[1]) {
            enriched += `笔记正文: ${decodeURIComponent(xhsMatch[1].replace(/\\u[\dA-Fa-f]{4}/g, (m) => String.fromCharCode(parseInt(m.slice(2), 16))))}\n`;
        }

        // Limit text length
        if (text.length > 5000) text = text.slice(0, 5000);

        return enriched + '\n---\n' + text;
    } catch (err) {
        console.error('[imitate] Failed to fetch URL:', err);
        throw new Error('无法访问该链接，请检查链接是否正确，或尝试手动粘贴内容');
    }
}

/**
 * Generate original content inspired by the source content
 */
export async function imitateContent(
    sourceContent: string,
    targetPlatform: string,
    ragContext: string = '',
): Promise<ImitateResult> {
    const platformGuidance: Record<string, string> = {
        '小红书': `小红书风格要求：
- 标题：使用数字+痛点+解决方案，加emoji
- 正文：分段清晰，每段不超过3行，多用emoji分隔
- 开头：直击痛点或制造好奇
- 标签：5-10个精准标签，混合热门+长尾
- 字数：500-800字最佳`,
        '抖音': `抖音脚本风格要求：
- 标题：强烈好奇心缺口，7秒黄金开场
- 正文：口语化表达，短句为主
- 节奏：信息密度高，每15秒一个记忆点
- 引导：结尾设置互动话术
- 时长：建议1-3分钟`,
        '视频号': `视频号脚本风格要求：
- 标题：实用价值导向，突出干货
- 正文：逻辑清晰，深度分析
- 受众：偏向30+年龄段，专业可信
- 节奏：娓娓道来，建立信任
- 时长：建议3-5分钟`,
    };

    const systemPrompt = `你是一位顶级内容创作专家，精通各大自媒体平台的内容创作。
你的任务是根据用户提供的参考内容，创作一篇全新的伪原创内容。

## 核心原则
1. **绝对不能抄袭** — 只借鉴选题角度和框架，所有文字表达必须全新原创
2. **规避风险** — 不使用敏感词、违禁词，不做虚假宣传
3. **有流量** — 按照平台算法偏好优化标题、结构、互动设计
4. **差异化** — 必须提供与原文不同的观点角度、案例、表达方式
5. **高质量** — 内容有深度、有价值，不是简单的同义词替换

## 目标平台
${platformGuidance[targetPlatform] || platformGuidance['小红书']}

${ragContext ? `## 参考知识库\n${ragContext}` : ''}`;

    const userPrompt = `## 参考内容（仅借鉴选题和角度，不可复制）
${sourceContent}

## 要求
请基于以上参考内容，创作一篇全新的伪原创内容。要求：
1. 选题角度可以相同，但表达、案例、结构必须完全不同
2. 加入你自己的见解和独特切入点
3. 按照目标平台的风格规范创作

请严格按照以下 JSON 格式返回：
\`\`\`json
{
  "original_summary": "用一段话总结参考内容的核心要点（50字以内）",
  "original_title": "参考内容的原始标题",
  "titles": ["伪原创标题1", "伪原创标题2", "伪原创标题3"],
  "content": "完整的伪原创正文内容",
  "hashtags": ["#标签1", "#标签2", "#标签3", "#标签4", "#标签5"],
  "keywords": ["配图关键词1", "配图关键词2", "配图关键词3"],
  "platform_tips": "一句话给出该内容在目标平台发布的关键建议",
  "originality_score": 85
}
\`\`\`

请确保：
1. titles 提供 3 个差异化标题
2. content 是完整可发布的文案（不少于 300 字）
3. originality_score 在 75-95 之间，客观评估原创度
4. hashtags 提供 5-8 个精准标签`;

    const raw = await callClaude({
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.8,
        maxTokens: 4096,
    });

    const result = safeParseJSON<ImitateResult>(raw, 'imitate');

    if (!result || !result.content) {
        throw new Error('AI 返回格式异常，请重试');
    }

    return result;
}
