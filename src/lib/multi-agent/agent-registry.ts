// ============================================================
// Agent 注册表 — 即插即用的 Agent 管理
// ============================================================
import type { AgentConfig } from './types';

const agents = new Map<string, AgentConfig>();

/** 注册一个 Agent */
export function registerAgent(config: AgentConfig): void {
    if (agents.has(config.id)) {
        console.warn(`[AgentRegistry] Agent "${config.id}" already registered, overwriting.`);
    }
    agents.set(config.id, config);
    console.log(`[AgentRegistry] [OK] Registered: ${config.name} (${config.id})`);
}

/** 批量注册 */
export function registerAgents(configs: AgentConfig[]): void {
    for (const c of configs) registerAgent(c);
}

/** 获取单个 Agent */
export function getAgent(id: string): AgentConfig | undefined {
    return agents.get(id);
}

/** 获取所有已注册 Agent */
export function getAllAgents(): AgentConfig[] {
    return Array.from(agents.values());
}

/** 按能力标签查找可用 Agent */
export function findAgentsByCapability(capability: string): AgentConfig[] {
    return getAllAgents().filter(a => a.capabilities.includes(capability));
}

/** 生成 Agent 能力清单（给 Orchestrator 用） */
export function getAgentManifest(): string {
    return getAllAgents()
        .map(a => `- ${a.id} (${a.name}): ${a.description} [能力: ${a.capabilities.join(', ')}]`)
        .join('\n');
}
