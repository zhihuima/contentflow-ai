// ============================================================
// Agent 注册入口 — 注册所有 Agent
// ============================================================
import { registerAgents } from '../agent-registry';
import { researchAgent } from './research';
import { plannerAgent } from './planner';
import { writerAgent } from './writer';
import { criticAgent } from './critic';
import { imageAgent } from './image';

/** 注册全部 Agent（应在 API 启动时调用一次） */
export function registerAllAgents(): void {
    registerAgents([
        researchAgent,
        plannerAgent,
        writerAgent,
        criticAgent,
        imageAgent,
    ]);
}

export { researchAgent, plannerAgent, writerAgent, criticAgent, imageAgent };
