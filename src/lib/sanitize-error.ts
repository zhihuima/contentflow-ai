/**
 * 将内部错误信息清理后返回给前端，
 * 隐藏文件路径、模块名、数据库文件名等敏感信息。
 */
export function sanitizeError(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err);

    // 去除绝对/相对文件路径  (e.g. /Users/.../knowledge/chunks.json)
    let cleaned = raw.replace(/(?:\/[\w.\-~]+)+(?:\.[\w]+)?/g, '[internal]');

    // 去除 Windows 路径  (e.g. C:\Users\...)
    cleaned = cleaned.replace(/[A-Z]:\\[\w.\-\\]+/gi, '[internal]');

    // 去除 node_modules 引用
    cleaned = cleaned.replace(/node_modules[\\/][\w@.\-\\/]+/g, '[internal]');

    // 去除含 .json / .ts / .js / .db 的文件名
    cleaned = cleaned.replace(/[\w\-]+\.(json|ts|js|tsx|jsx|db|sqlite)/gi, '[internal]');

    // 去除 import/require 路径
    cleaned = cleaned.replace(/(?:from|require\()\s*['"][^'"]+['"]\)?/g, '[internal]');

    // 去除 "at ..." 堆栈行
    cleaned = cleaned.replace(/\bat\s+[\w.<>]+\s*\(.*?\)/g, '');

    // 折叠连续 [internal] 标记
    cleaned = cleaned.replace(/(\[internal\]\s*[/\\:,;]*\s*)+/g, '[internal] ');

    // 如果清理后没有有意义内容则返回通用消息
    const meaningful = cleaned.replace(/\[internal\]/g, '').trim();
    if (!meaningful || meaningful.length < 5) {
        return '服务内部错误，请稍后重试';
    }

    return cleaned.trim();
}
