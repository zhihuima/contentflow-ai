// ============================================================
// JSON 安全解析工具
// Claude 返回的 JSON 可能包含：
//   1. 尾部逗号 (trailing commas)
//   2. 未转义的换行符
//   3. 被 markdown 代码块包裹
//   4. 前后有多余文本
// 本工具自动清理这些问题后再解析
// ============================================================

/**
 * 从可能包含额外文本的 Claude 响应中提取 JSON 对象
 */
export function extractJSON(raw: string): string {
    // 1. 去除 markdown 代码块包裹
    let cleaned = raw.replace(/```(?:json)?\s*/g, '').replace(/```\s*$/g, '');

    // 2. 尝试找到 JSON 对象或数组
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);

    if (objMatch && arrMatch) {
        // 取更早出现的那个
        cleaned = objMatch.index! < arrMatch.index! ? objMatch[0] : arrMatch[0];
    } else if (objMatch) {
        cleaned = objMatch[0];
    } else if (arrMatch) {
        cleaned = arrMatch[0];
    }

    return cleaned;
}

/**
 * 清理常见的 JSON 格式问题
 */
function sanitizeJSON(jsonStr: string): string {
    let s = jsonStr;

    // 移除 trailing commas (在 } 或 ] 前的逗号)
    s = s.replace(/,\s*([\]}])/g, '$1');

    // 替换中文引号为英文引号
    s = s.replace(/[\u201c\u201d]/g, '"');
    s = s.replace(/[\u2018\u2019]/g, "'");

    // 修复字符串值内的未转义换行符（保留 JSON 结构的换行）
    // 匹配引号内的内容，替换其中的真实换行为 \n
    s = s.replace(/"([^"]*?)"/g, (match) => {
        return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    });

    return s;
}

/**
 * 安全解析 Claude 返回的 JSON 文本
 * 自动提取、清理并解析
 * @param raw Claude 的原始输出
 * @param fallbackLabel 错误提示标签
 */
export function safeParseJSON<T>(raw: string, fallbackLabel = 'response'): T {
    const extracted = extractJSON(raw);

    // 第一次尝试：直接解析
    try {
        return JSON.parse(extracted) as T;
    } catch {
        // 继续清理
    }

    // 第二次尝试：清理后解析
    const sanitized = sanitizeJSON(extracted);
    try {
        return JSON.parse(sanitized) as T;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[safeParseJSON] Failed to parse ${fallbackLabel}:`, msg);
        console.error('[safeParseJSON] Raw text (first 500 chars):', raw.slice(0, 500));
        throw new Error(`Failed to parse ${fallbackLabel}: ${msg}`);
    }
}
