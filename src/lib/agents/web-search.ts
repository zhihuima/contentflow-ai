// ============================================================
// Web Search Agent — 趋势研究 & 竞品分析
// 使用 Serper API (可选) — 无 key 时返回 mock 数据
// ============================================================

const SERPER_API_KEY = process.env.SERPER_API_KEY || '';

export interface SearchResult {
    title: string;
    snippet: string;
    link: string;
    position: number;
}

export interface TrendResearch {
    query: string;
    results: SearchResult[];
    summary: string;
    trendingTopics: string[];
    competitorInsights: string[];
}

/**
 * 基于关键词搜索趋势
 */
export async function searchTrends(query: string): Promise<TrendResearch> {
    // 无 API Key → 返回提示信息
    if (!SERPER_API_KEY) {
        return {
            query,
            results: [],
            summary: '未配置 SERPER_API_KEY，跳过网络搜索。可设置环境变量后开启此功能。',
            trendingTopics: [],
            competitorInsights: [],
        };
    }

    try {
        const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'X-API-KEY': SERPER_API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: query,
                gl: 'cn',
                hl: 'zh-cn',
                num: 8,
            }),
        });

        if (!response.ok) {
            console.warn(`[Serper] API error: ${response.status}`);
            return fallbackResearch(query);
        }

        const data = await response.json();
        const organic = data.organic || [];

        const results: SearchResult[] = organic.map((item: { title: string; snippet: string; link: string; position: number }) => ({
            title: item.title,
            snippet: item.snippet,
            link: item.link,
            position: item.position,
        }));

        // 从搜索结果中提取趋势分析
        const trendingTopics = results.slice(0, 5).map(r => r.title);
        const competitorInsights = results
            .filter(r => r.snippet?.length > 50)
            .slice(0, 3)
            .map(r => `${r.title}：${r.snippet.slice(0, 100)}...`);

        return {
            query,
            results,
            summary: `搜索到 ${results.length} 条相关结果，发现 ${trendingTopics.length} 个热门话题`,
            trendingTopics,
            competitorInsights,
        };
    } catch (error) {
        console.warn('[Serper] Request failed:', error);
        return fallbackResearch(query);
    }
}

function fallbackResearch(query: string): TrendResearch {
    return {
        query,
        results: [],
        summary: '搜索服务暂不可用，将使用 AI 内置知识进行创作',
        trendingTopics: [],
        competitorInsights: [],
    };
}
