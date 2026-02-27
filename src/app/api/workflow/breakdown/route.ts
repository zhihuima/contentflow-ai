// ============================================================
// 爆款拆解 API — 输入链接，联网抓取内容，AI 分析拆解
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/claude';
import { sanitizeError } from '@/lib/sanitize-error';

const SERPER_API_KEY = process.env.SERPER_API_KEY || '';

async function fetchUrlContent(url: string): Promise<string> {
    // 方式 1: 用 Serper scrape API 获取网页内容
    if (SERPER_API_KEY) {
        try {
            const res = await fetch('https://scrape.serper.dev', {
                method: 'POST',
                headers: {
                    'X-API-KEY': SERPER_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });
            if (res.ok) {
                const data = await res.json();
                // Serper scrape 返回 { text, markdown, metadata }
                const content = data.text || data.markdown || '';
                if (content.length > 100) {
                    return content.slice(0, 15000); // 限制长度
                }
            }
        } catch (e) {
            console.warn('[Breakdown] Serper scrape failed:', e);
        }
    }

    // 方式 2: 直接 fetch 网页 HTML 并提取文本
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            },
            signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
            const html = await res.text();
            // 简单提取文本内容（去掉 HTML 标签、脚本、样式）
            const text = html
                .replace(/<script[\s\S]*?<\/script>/gi, '')
                .replace(/<style[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            return text.slice(0, 15000);
        }
    } catch (e) {
        console.warn('[Breakdown] Direct fetch failed:', e);
    }

    // 方式 3: 用 Serper 搜索该 URL 获取摘要信息
    if (SERPER_API_KEY) {
        try {
            const res = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: {
                    'X-API-KEY': SERPER_API_KEY,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ q: url, gl: 'cn', hl: 'zh-cn', num: 5 }),
            });
            if (res.ok) {
                const data = await res.json();
                const snippets = (data.organic || [])
                    .map((r: { title: string; snippet: string }) => `${r.title}\n${r.snippet}`)
                    .join('\n\n');
                if (snippets.length > 50) {
                    return `[搜索引擎摘要]\n${snippets}`;
                }
            }
        } catch (e) {
            console.warn('[Breakdown] Serper search fallback failed:', e);
        }
    }

    return '';
}

export async function POST(request: NextRequest) {
    try {
        const { url, extraContext } = await request.json() as {
            url: string;
            extraContext?: string;
        };

        if (!url || !url.startsWith('http')) {
            return NextResponse.json({ error: '请输入有效的链接地址' }, { status: 400 });
        }

        console.log(`[Breakdown] Fetching content from: ${url}`);

        // 1. 抓取内容
        const content = await fetchUrlContent(url);

        if (!content || content.length < 30) {
            return NextResponse.json({
                error: '无法获取该链接的内容，可能需要登录或内容受限。请尝试手动复制内容到"补充信息"中。'
            }, { status: 422 });
        }

        console.log(`[Breakdown] Fetched ${content.length} chars, sending to Claude...`);

        // 2. Claude 爆款拆解分析
        const system = `你是一位资深自媒体爆款内容分析师，擅长拆解各平台（抖音、小红书、微信公众号、B站、微博等）的爆款内容。

你的任务是对用户提供的内容进行深度拆解分析。请按以下维度输出：

## 📊 基本信息
- 平台判断（根据URL或内容特征）
- 内容类型（视频/图文/文章/短视频）
- 目标受众

## 🔥 爆款指数评估
（满分10分，给出你的评估）
- 标题/封面吸引力：x/10
- 内容质量：x/10  
- 情绪价值：x/10
- 传播潜力：x/10
- 总评：x/10

## 🎯 标题拆解
- 标题使用了什么技巧（悬念/数字/痛点/对比/权威背书等）
- 标题的关键词分析
- 标题改进建议

## 📝 内容结构拆解
- 开头hook（前3秒/前两行如何抓住注意力）
- 内容框架（总分总/递进/故事线/清单体等）
- 高潮设计
- 结尾引导（关注/收藏/互动话术）

## 💡 爆款要素分析
- 选题为什么能火？（踩中了什么热点/痛点/需求）
- 用了哪些情绪触发器？（焦虑/好奇/共鸣/优越感/实用性）
- 传播动机（为什么用户会转发/收藏/评论）

## 🛠 可复用的爆款公式
- 提炼出 2-3 个可直接复用的创作模版
- 每个模版给出填空式的公式

## 📋 操作建议
- 如果要模仿这篇内容，应该怎么做？
- 给出 3 个同类选题建议

请用专业但易懂的语言，多用emoji让分析更直观。`;

        const userMessage = `请深度拆解以下爆款内容：

来源链接：${url}
${extraContext ? `\n用户补充信息：${extraContext}\n` : ''}
---内容原文---
${content}
---内容结束---`;

        const result = await callClaude({
            system,
            messages: [{ role: 'user', content: userMessage }],
            maxTokens: 6000,
            temperature: 0.5,
        });

        return NextResponse.json({ data: result, contentLength: content.length });
    } catch (err: unknown) {
        console.error('[Breakdown] Error:', err);
        return NextResponse.json({ error: sanitizeError(err) }, { status: 500 });
    }
}
