// ============================================================
// 轻量 RAG 检索器 — 基于关键词匹配（多知识库支持）
// ============================================================
import originalChunks from './knowledge/chunks.json';
import xhsChunks from './knowledge/xhs-chunks.json';
import growthChunks from './knowledge/growth-chunks.json';

export interface KnowledgeChunk {
    id: string;
    type: 'hook' | 'story' | 'insight' | 'strategy';
    source?: string;
    keywords: string[];
    title: string;
    content: string;
    use_as: string;
}

type CreationMode = 'video' | 'xhs' | 'douyin' | 'polish' | 'imitate';

/**
 * 根据用户输入的文本检索最相关的知识块。
 * 使用简单的关键词命中次数 + 类型多样性策略。
 * @param mode - 'video' 优先《薛兆丰经济学讲义》，'xhs' 优先《爆款小红书》，《增长黑客》通用
 */
export function retrieveChunks(
    query: string,
    maxResults: number = 5,
    mode: CreationMode = 'video',
): KnowledgeChunk[] {
    // 加载所有知识库
    const allChunks: KnowledgeChunk[] = [
        ...(originalChunks as KnowledgeChunk[]),
        ...(xhsChunks as KnowledgeChunk[]),
        ...(growthChunks as KnowledgeChunk[]),
    ];

    // 1. 对 query 进行分词（简单按空格和标点分割）
    const queryTokens = query
        .replace(/[，。！？、；：""''（）\[\]【】《》\s]+/g, ' ')
        .split(' ')
        .filter(t => t.length >= 2);

    // 2. 为每个 chunk 打分
    const scored = allChunks.map(chunk => {
        let score = 0;

        // 关键词命中
        for (const keyword of chunk.keywords) {
            if (query.includes(keyword)) {
                score += 3;
            }
            for (const token of queryTokens) {
                if (keyword.includes(token) || token.includes(keyword)) {
                    score += 1;
                }
            }
        }

        // 标题命中
        for (const token of queryTokens) {
            if (chunk.title.includes(token)) {
                score += 2;
            }
        }

        // 来源加权：根据模式优先匹配对应书籍
        const src = chunk.source || '薛兆丰经济学讲义';
        if (mode === 'polish') {
            // polish 模式：不做来源加权，三个知识库平等
            score += 1;
        } else if (mode === 'xhs') {
            if (src === '爆款小红书') score += 2;
            if (src === '增长黑客') score += 1;
            // 薛兆丰不加分（视频号时用）
        } else {
            if (src === '薛兆丰经济学讲义') score += 2;
            if (src === '增长黑客') score += 1;
        }

        return { chunk, score };
    });

    // 3. 按分数排序
    scored.sort((a, b) => b.score - a.score);

    // 4. 保证类型多样性
    const result: KnowledgeChunk[] = [];
    const typesSeen = new Set<string>();

    for (const item of scored) {
        if (result.length >= maxResults) break;
        if (item.score <= 0) break;
        result.push(item.chunk);
        typesSeen.add(item.chunk.type);
    }

    // 补充遗漏类型
    if (result.length < maxResults) {
        const targetTypes = mode === 'polish'
            ? ['hook', 'story', 'strategy', 'insight']
            : mode === 'xhs'
                ? ['hook', 'strategy', 'insight']
                : ['hook', 'story', 'insight'];
        const missingTypes = targetTypes.filter(t => !typesSeen.has(t));
        for (const type of missingTypes) {
            if (result.length >= maxResults) break;
            const best = scored.find(s => s.chunk.type === type && !result.includes(s.chunk));
            if (best) {
                result.push(best.chunk);
            }
        }
    }

    // 兜底
    if (result.length === 0) {
        if (mode === 'xhs') {
            return (xhsChunks as KnowledgeChunk[]).filter(c =>
                ['xhs001', 'xhs002', 'xhs004'].includes(c.id)
            ).slice(0, 2);
        }
        return (originalChunks as KnowledgeChunk[]).filter(c =>
            ['h001', 'h002', 'i001'].includes(c.id)
        ).slice(0, 2);
    }

    return result;
}

/**
 * 将检索到的知识块格式化为 prompt 可用的文本
 */
export function formatChunksForPrompt(chunks: KnowledgeChunk[], mode: CreationMode = 'video'): string {
    if (!chunks.length) return '';

    const platformLabel = mode === 'polish' ? '内容润色' : mode === 'xhs' ? '小红书图文笔记' : '短视频脚本';

    let text = `\n\n【参考素材库 — 请灵活运用，不要生搬硬套】\n`;
    text += `以下素材可用于增强${platformLabel}的创作质量，请根据主题选择性使用：\n\n`;

    for (const chunk of chunks) {
        const typeLabel = chunk.type === 'hook' ? '[钩子] 钩子/标题素材'
            : chunk.type === 'story' ? '[故事] 案例故事'
                : chunk.type === 'strategy' ? '[策略] 方法策略'
                    : '[金句] 洞见金句';

        const sourceLabel = chunk.source ? `《${chunk.source}》` : '《薛兆丰经济学讲义》';

        text += `${typeLabel}【${chunk.title}】（来源：${sourceLabel}）\n`;
        text += `${chunk.content}\n`;
        text += `应用建议：${chunk.use_as}\n\n`;
    }

    text += `提示：以上素材仅供参考和灵感启发，请根据具体主题灵活化用，`;
    text += `不需要强行引用。如果素材与主题无关，完全可以忽略。\n`;

    return text;
}
