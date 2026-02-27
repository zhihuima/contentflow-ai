// ============================================================
// JSON 安全解析工具 (v2 — 更强健)
// Claude 返回的 JSON 可能包含：
//   1. 尾部逗号 (trailing commas)
//   2. 未转义的换行符 / 控制字符
//   3. 被 markdown 代码块包裹
//   4. 前后有多余文本
//   5. 长文本中的特殊Unicode字符
// 本工具自动清理这些问题后再解析
// ============================================================

/**
 * 从可能包含额外文本的 Claude 响应中提取 JSON 对象
 */
export function extractJSON(raw: string): string {
    // 1. 去除 markdown 代码块包裹（支持多种格式）
    let cleaned = raw
        .replace(/```(?:json|JSON)?\s*\n?/g, '')
        .replace(/\n?\s*```\s*$/g, '')
        .trim();

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

    // 移除零宽字符和不可见控制字符（保留 \n \r \t）
    s = s.replace(/[\u200B-\u200F\u2028\u2029\uFEFF]/g, '');

    return s;
}

/**
 * 逐字符扫描修复 JSON 字符串值中的无效控制字符
 * 比正则更可靠，能正确处理转义引号
 */
function fixControlCharsInStrings(jsonStr: string): string {
    const chars: string[] = [];
    let inString = false;
    let escaped = false;

    for (let i = 0; i < jsonStr.length; i++) {
        const ch = jsonStr[i];

        if (escaped) {
            chars.push(ch);
            escaped = false;
            continue;
        }

        if (ch === '\\' && inString) {
            chars.push(ch);
            escaped = true;
            continue;
        }

        if (ch === '"') {
            inString = !inString;
            chars.push(ch);
            continue;
        }

        if (inString) {
            // 替换真实换行/回车/制表符为转义形式
            if (ch === '\n') { chars.push('\\n'); continue; }
            if (ch === '\r') { chars.push('\\r'); continue; }
            if (ch === '\t') { chars.push('\\t'); continue; }
            // 移除其他控制字符
            const code = ch.charCodeAt(0);
            if (code < 0x20) { continue; }
        }

        chars.push(ch);
    }

    return chars.join('');
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

    // 第二次尝试：基本清理后解析
    const sanitized = sanitizeJSON(extracted);
    try {
        return JSON.parse(sanitized) as T;
    } catch {
        // 继续深度清理
    }

    // 第三次尝试：逐字符修复控制字符
    const fixed = fixControlCharsInStrings(sanitized);
    try {
        return JSON.parse(fixed) as T;
    } catch {
        // 继续更激进的修复
    }

    // 第四次尝试：移除所有不在引号外的换行，然后重试
    const aggressive = sanitized
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    try {
        return JSON.parse(aggressive) as T;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[safeParseJSON] Failed to parse ${fallbackLabel}:`, msg);
        console.error('[safeParseJSON] Raw text (first 800 chars):', raw.slice(0, 800));
        throw new Error(`Failed to parse ${fallbackLabel}: ${msg}`);
    }
}
