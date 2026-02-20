// ============================================================
// Multi-Agent 类型定义
// ============================================================
import type { CreationMode } from '@/lib/types';

/* ---- Agent 事件（SSE 推送） ---- */
export type AgentEventType =
    | 'agent_start'
    | 'agent_progress'
    | 'agent_done'
    | 'agent_error'
    | 'orchestrator_decision'
    | 'revision_loop'
    | 'task_complete'
    | 'task_error';

export interface AgentEvent {
    type: AgentEventType;
    agentId: string;
    agentName: string;
    message: string;
    data?: unknown;
    reasoning?: string;
    timestamp: number;
}

/* ---- Agent 上下文（共享记忆） ---- */
export interface AgentContext {
    taskId: string;
    mode: CreationMode;
    userInput: string;
    /** 每个 Agent 将结果写入 memory，后续 Agent 可读取 */
    memory: Record<string, unknown>;
    /** 推送 SSE 事件 */
    emit: (event: AgentEvent) => void;
    /** 回写循环计数 */
    revisionCount: number;
    /** Critic 反馈（回写时有值） */
    revisionFeedback?: string;
}

/* ---- Agent 执行结果 ---- */
export interface AgentResult {
    status: 'success' | 'needs_revision' | 'failed' | 'skipped';
    data: unknown;
    /** 给 Orchestrator 的反馈/建议 */
    feedback?: string;
    /** 评分（Critic Agent 使用） */
    score?: number;
}

/* ---- Agent 配置（注册表条目） ---- */
export interface AgentConfig {
    id: string;
    name: string;
    /** 给 Orchestrator 看的能力描述 */
    description: string;
    /** 能力标签，Orchestrator 据此决定调度 */
    capabilities: string[];
    /** 执行函数 */
    execute: (ctx: AgentContext) => Promise<AgentResult>;
    /** 失败是否可重试 */
    retryable: boolean;
    maxRetries: number;
}

/* ---- Orchestrator 决策 ---- */
export interface OrchestratorStep {
    agents: string[];          // 本轮调度的 Agent ID 列表
    parallel: boolean;         // 是否并行
    reason: string;            // 决策理由
    inputOverrides?: Record<string, Record<string, unknown>>;
}

export interface OrchestratorPlan {
    steps: OrchestratorStep[];
    revisionPolicy: {
        scoreThreshold: number;
        maxRevisions: number;
    };
}
