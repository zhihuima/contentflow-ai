// ============================================================
// 用户隔离存储 — 每个用户拥有独立的 localStorage 命名空间
// 所有客户端数据存储都应通过此模块进行
// ============================================================

let _currentUserId: string | null = null;
let _fetchPromise: Promise<string | null> | null = null;

/**
 * 获取当前登录用户的 ID（缓存 + 异步加载）
 */
export async function fetchCurrentUserId(): Promise<string | null> {
    if (_currentUserId) return _currentUserId;
    if (_fetchPromise) return _fetchPromise;
    _fetchPromise = fetch('/api/auth/me')
        .then(r => r.json())
        .then(d => {
            _currentUserId = d.user?.username || d.user?.id || null;
            return _currentUserId;
        })
        .catch(() => null);
    return _fetchPromise;
}

/**
 * 同步获取缓存的用户 ID（必须先调用 fetchCurrentUserId）
 */
export function getCachedUserId(): string | null {
    return _currentUserId;
}

/**
 * 手动设置用户 ID（登录后调用）
 */
export function setCurrentUserId(userId: string) {
    _currentUserId = userId;
}

/**
 * 获取用户隔离的 localStorage key
 */
export function userKey(key: string, userId?: string): string {
    const uid = userId || _currentUserId || 'anonymous';
    return `u_${uid}_${key}`;
}

/**
 * 用户隔离版 localStorage.getItem
 */
export function userGetItem(key: string, userId?: string): string | null {
    try {
        return localStorage.getItem(userKey(key, userId));
    } catch { return null; }
}

/**
 * 用户隔离版 localStorage.setItem
 */
export function userSetItem(key: string, value: string, userId?: string): void {
    try {
        localStorage.setItem(userKey(key, userId), value);
    } catch { /* quota exceeded etc. */ }
}

/**
 * 用户隔离版 localStorage.removeItem
 */
export function userRemoveItem(key: string, userId?: string): void {
    try {
        localStorage.removeItem(userKey(key, userId));
    } catch { /* ignore */ }
}

/**
 * 用户隔离版 JSON 读取
 */
export function userGetJSON<T>(key: string, fallback: T, userId?: string): T {
    try {
        const raw = userGetItem(key, userId);
        return raw ? JSON.parse(raw) as T : fallback;
    } catch { return fallback; }
}

/**
 * 用户隔离版 JSON 写入
 */
export function userSetJSON(key: string, value: unknown, userId?: string): void {
    try {
        userSetItem(key, JSON.stringify(value), userId);
    } catch { /* ignore */ }
}

/**
 * 迁移旧的全局数据到用户命名空间（一次性迁移）
 */
export function migrateGlobalToUser(key: string, userId?: string): void {
    const uid = userId || _currentUserId;
    if (!uid) return;

    const globalData = localStorage.getItem(key);
    const userScopedKey = userKey(key, uid);
    const userDataExists = localStorage.getItem(userScopedKey);

    // 只有在用户空间没有数据且全局空间有数据时迁移
    if (globalData && !userDataExists) {
        localStorage.setItem(userScopedKey, globalData);
        console.log(`[UserStorage] Migrated "${key}" to user "${uid}"`);
    }
}

/**
 * 初始化用户存储：获取用户 ID + 迁移旧数据
 */
export async function initUserStorage(): Promise<string | null> {
    const userId = await fetchCurrentUserId();
    if (userId) {
        // 迁移常用的全局 key 到用户命名空间
        const keysToMigrate = [
            'workflow_history',
            'workflow_result_history',
            'workflow_running_task',
            'breakdown_history',
            'meeting_history',
            'ai_contact_sessions',
        ];
        for (const key of keysToMigrate) {
            migrateGlobalToUser(key, userId);
        }
    }
    return userId;
}
