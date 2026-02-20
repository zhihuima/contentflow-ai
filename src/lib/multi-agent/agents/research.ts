// ============================================================
// Research Agent — 趋势搜索 + RAG 知识库检索
// ============================================================
import type { AgentConfig, AgentContext, AgentResult } from '../types';
import { retrieveChunks } from '@/lib/retriever';

export const researchAgent: AgentConfig = {
    id: 'research',
    name: '趋势研究',
    description: '搜索实时热门话题，检索 RAG 知识库获取爆款策略和素材',
    capabilities: ['web-search', 'rag-retrieval', 'trend-analysis'],
    retryable: true,
    maxRetries: 1,
    execute: async (ctx: AgentContext): Promise<AgentResult> => {
        ctx.emit({
            type: 'agent_progress',
            agentId: 'research',
            agentName: '趋势研究',
            message: '正在检索知识库和搜索热门趋势...',
            reasoning: '【推理逻辑】\n1. 根据用户输入提取关键词\n2. 检索 RAG 知识库获取爆款方法论\n3. 搜索实时热点趋势\n4. 整合素材供后续 Agent 使用',
            timestamp: Date.now(),
        });

        // RAG retrieval
        const query = ctx.userInput.slice(0, 200);
        const ragChunks = await retrieveChunks(query, 8, ctx.mode);
        const ragContext = ragChunks.length > 0
            ? '\n\n## RAG 知识库参考素材\n' + ragChunks.map(c => `【${c.source}】${c.content}`).join('\n\n')
            : '';

        // Web search (optional, graceful failure)
        let trendContext = '';
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/workflow/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `${query} 爆款` }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data?.trendingTopics?.length > 0) {
                    trendContext = `热门趋势：${data.trendingTopics.join('、')}`;
                }
            }
        } catch {
            // Web search is optional
        }

        ctx.memory.ragContext = ragContext;
        ctx.memory.trendContext = trendContext;

        return {
            status: 'success',
            data: { ragChunksCount: ragChunks.length, trendContext },
            feedback: `知识库检索到 ${ragChunks.length} 条素材${trendContext ? '，' + trendContext : ''}`,
        };
    },
};
