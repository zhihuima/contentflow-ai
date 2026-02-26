// ============================================================
// 任务路由系统 — 将创作需求智能分配给部门和 AI 员工
// ============================================================

import type { AgentProfile } from './departments';
import { getAgent, getDepartment, getAllAgents, DEPARTMENTS } from './departments';

// ============================================================
// 1. 创作模式 → 工作流映射
// ============================================================

export interface WorkflowStep {
    agentId: string;
    role: string;          // 在本流程中的角色
    action: string;        // 具体做什么
    order: number;         // 执行顺序（相同 order 可并行）
    optional?: boolean;    // 是否可选步骤
}

export interface ModeWorkflow {
    mode: string;
    label: string;
    description: string;
    departments: string[];  // 涉及的部门
    steps: WorkflowStep[];
    meetingSuggestion?: {
        topic: string;
        participants: string[];
        when: string;       // 什么时候建议开会
    };
}

/** 每种创作模式的完整工作流 */
export const MODE_WORKFLOWS: ModeWorkflow[] = [
    {
        mode: 'douyin',
        label: '抖音脚本创作',
        description: '从选题策划到脚本成稿的全流程',
        departments: ['content', 'design', 'marketing', 'data'],
        steps: [
            { agentId: 'topic-planner', role: '选题把关', action: '分析热点趋势，策划高流量选题', order: 1 },
            { agentId: 'market-analyst', role: '市场调研', action: '竞品分析、目标用户画像', order: 1 },
            { agentId: 'copywriter', role: '脚本撰写', action: '创作爆款短视频脚本', order: 2 },
            { agentId: 'video-scripter', role: '分镜设计', action: '将脚本转化为分镜头语言', order: 2 },
            { agentId: 'content-reviewer', role: '质量审核', action: '评分并给出优化建议', order: 3 },
            { agentId: 'seo-specialist', role: 'SEO优化', action: '优化标题、标签和描述', order: 3, optional: true },
            { agentId: 'growth-hacker', role: '传播策略', action: '设计评论区互动和裂变点', order: 4, optional: true },
        ],
        meetingSuggestion: {
            topic: '抖音内容策略讨论',
            participants: ['topic-planner', 'copywriter', 'video-scripter', 'content-reviewer'],
            when: '开始创作前，召集内容部开选题评审会',
        },
    },
    {
        mode: 'video',
        label: '视频号脚本创作',
        description: '微信视频号生态下的内容创作流程',
        departments: ['content', 'design', 'data'],
        steps: [
            { agentId: 'topic-planner', role: '选题策划', action: '针对视频号用户画像策划选题', order: 1 },
            { agentId: 'user-insight', role: '用户洞察', action: '分析视频号用户偏好和行为', order: 1, optional: true },
            { agentId: 'copywriter', role: '脚本创作', action: '撰写符合视频号调性的脚本', order: 2 },
            { agentId: 'video-scripter', role: '分镜编排', action: '设计适合视频号的节奏和转场', order: 2 },
            { agentId: 'content-reviewer', role: '内容审核', action: '质量把关和合规检查', order: 3 },
            { agentId: 'seo-specialist', role: '标签优化', action: '视频号推荐算法优化', order: 3 },
        ],
        meetingSuggestion: {
            topic: '视频号内容方向讨论',
            participants: ['topic-planner', 'copywriter', 'user-insight', 'video-scripter'],
            when: '策划周度内容计划时',
        },
    },
    {
        mode: 'xhs',
        label: '小红书图文创作',
        description: '从笔记策划到配图的一站式创作',
        departments: ['content', 'design', 'data', 'service'],
        steps: [
            { agentId: 'topic-planner', role: '选题策划', action: '分析小红书热搜和用户需求', order: 1 },
            { agentId: 'user-insight', role: '用户研究', action: '研究目标用户的内容消费习惯', order: 1 },
            { agentId: 'copywriter', role: '笔记撰写', action: '创作种草力强的图文笔记', order: 2 },
            { agentId: 'visual-designer', role: '视觉规划', action: '确定配图风格和品牌调性', order: 2 },
            { agentId: 'image-generator', role: 'AI配图', action: '生成高质量配图', order: 3 },
            { agentId: 'content-reviewer', role: '内容审核', action: '检查笔记质量和合规性', order: 3 },
            { agentId: 'seo-specialist', role: '关键词优化', action: '优化标题和标签以提高曝光', order: 4 },
        ],
        meetingSuggestion: {
            topic: '小红书内容策略 & 视觉风格讨论',
            participants: ['topic-planner', 'copywriter', 'visual-designer', 'user-insight'],
            when: '开始新品类笔记创作前',
        },
    },
    {
        mode: 'polish',
        label: '内容润色优化',
        description: '对已有内容进行质量提升和优化',
        departments: ['content', 'data'],
        steps: [
            { agentId: 'content-reviewer', role: '质量评估', action: '全面评估现有内容的优劣', order: 1 },
            { agentId: 'copywriter', role: '润色改写', action: '提升文案质量和感染力', order: 2 },
            { agentId: 'seo-specialist', role: 'SEO加固', action: '补充关键词、优化可发现性', order: 2, optional: true },
            { agentId: 'data-analyst', role: '效果预测', action: '预估优化前后的效果差异', order: 3, optional: true },
        ],
    },
    {
        mode: 'imitate',
        label: '爆款模仿创作',
        description: '分析爆款然后创作同等水准的内容',
        departments: ['content', 'marketing', 'data'],
        steps: [
            { agentId: 'style-imitator', role: '爆款解码', action: '拆解目标内容的结构和风格DNA', order: 1 },
            { agentId: 'data-analyst', role: '数据佐证', action: '分析爆款数据为什么火', order: 1 },
            { agentId: 'copywriter', role: '模仿创作', action: '基于拆解结果创作新内容', order: 2 },
            { agentId: 'content-reviewer', role: '原创度检查', action: '确保模仿不越界、保持原创度', order: 3 },
            { agentId: 'market-analyst', role: '市场验证', action: '评估新内容的市场竞争力', order: 3, optional: true },
        ],
        meetingSuggestion: {
            topic: '爆款拆解与模仿策略讨论',
            participants: ['style-imitator', 'copywriter', 'data-analyst', 'content-reviewer'],
            when: '分析完目标爆款后，讨论模仿方向',
        },
    },
];

// ============================================================
// 2. 问题类型 → 部门/人员推荐
// ============================================================

export interface TaskScenario {
    id: string;
    question: string;       // 用户可能问的问题
    category: string;       // 问题类别
    department: string;     // 推荐部门
    primaryAgent: string;   // 主要负责人
    supportAgents: string[];// 辅助人员
    suggestedAction: string;// 建议的行动
}

export const TASK_SCENARIOS: TaskScenario[] = [
    // ---- 选题方向 ----
    {
        id: 'sc-1', question: '下周发什么内容？', category: '选题策划',
        department: 'content', primaryAgent: 'topic-planner', supportAgents: ['market-analyst', 'user-insight'],
        suggestedAction: '让小策根据热点数据推荐选题，小析提供市场视角，小察补充用户需求',
    },
    {
        id: 'sc-2', question: '这个选题有没有流量？', category: '选题评估',
        department: 'content', primaryAgent: 'topic-planner', supportAgents: ['data-analyst', 'seo-specialist'],
        suggestedAction: '小策评估流量潜力，小数提供数据佐证，小搜分析搜索热度',
    },
    {
        id: 'sc-3', question: '竞品在做什么内容？', category: '竞品分析',
        department: 'marketing', primaryAgent: 'market-analyst', supportAgents: ['style-imitator', 'data-analyst'],
        suggestedAction: '小析做全面竞品分析，小仿拆解竞品爆款结构，小数对比数据差异',
    },
    // ---- 内容创作 ----
    {
        id: 'sc-4', question: '帮我写一篇抖音脚本', category: '内容创作',
        department: 'content', primaryAgent: 'copywriter', supportAgents: ['video-scripter', 'content-reviewer'],
        suggestedAction: '小文负责文案创作，小导设计分镜，小审把关质量',
    },
    {
        id: 'sc-5', question: '小红书笔记怎么写才种草？', category: '内容创作',
        department: 'content', primaryAgent: 'copywriter', supportAgents: ['visual-designer', 'user-insight'],
        suggestedAction: '小文撰写种草文案，小美规划视觉风格，小察分析用户偏好',
    },
    {
        id: 'sc-6', question: '这篇文案不够好，帮我改', category: '内容优化',
        department: 'content', primaryAgent: 'content-reviewer', supportAgents: ['copywriter', 'seo-specialist'],
        suggestedAction: '小审先评估问题，小文进行润色改写，小搜补充SEO优化',
    },
    {
        id: 'sc-7', question: '帮我模仿这个爆款', category: '模仿创作',
        department: 'content', primaryAgent: 'style-imitator', supportAgents: ['copywriter', 'data-analyst'],
        suggestedAction: '小仿拆解爆款DNA，小文进行二次创作，小数验证数据逻辑',
    },
    // ---- 视觉设计 ----
    {
        id: 'sc-8', question: '帮我配几张好看的图', category: '视觉设计',
        department: 'design', primaryAgent: 'image-generator', supportAgents: ['visual-designer'],
        suggestedAction: '小画生成配图，小美把关品牌调性和视觉品质',
    },
    {
        id: 'sc-9', question: '视频怎么拍？分镜怎么设计？', category: '视频制作',
        department: 'design', primaryAgent: 'video-scripter', supportAgents: ['copywriter'],
        suggestedAction: '小导设计分镜脚本和节奏，小文提供文案配合',
    },
    // ---- 数据与增长 ----
    {
        id: 'sc-10', question: '我的内容数据为什么下降了？', category: '数据分析',
        department: 'data', primaryAgent: 'data-analyst', supportAgents: ['seo-specialist', 'content-reviewer'],
        suggestedAction: '小数进行数据归因分析，小搜检查SEO问题，小审评估内容质量',
    },
    {
        id: 'sc-11', question: '怎么涨粉？怎么做私域？', category: '增长策略',
        department: 'marketing', primaryAgent: 'growth-hacker', supportAgents: ['ad-optimizer', 'user-insight'],
        suggestedAction: '小增设计增长裂变策略，小投计算投放ROI，小察分析用户留存',
    },
    {
        id: 'sc-12', question: '这个内容要不要投广告？', category: '投放决策',
        department: 'marketing', primaryAgent: 'ad-optimizer', supportAgents: ['data-analyst', 'market-analyst'],
        suggestedAction: '小投评估投放ROI，小数提供基期数据，小析判断市场时机',
    },
    // ---- 用户与知识 ----
    {
        id: 'sc-13', question: '用户到底想看什么？', category: '用户洞察',
        department: 'service', primaryAgent: 'user-insight', supportAgents: ['data-analyst', 'topic-planner'],
        suggestedAction: '小察分析用户反馈和需求，小数提供数据画像，小策转化为选题方向',
    },
    {
        id: 'sc-14', question: '之前做过类似的内容吗？有什么经验？', category: '知识检索',
        department: 'service', primaryAgent: 'knowledge-manager', supportAgents: ['data-analyst'],
        suggestedAction: '小知检索历史案例和经验沉淀，小数提供效果数据参考',
    },
];

// ============================================================
// 3. 智能路由函数
// ============================================================

/** 根据创作模式获取工作流 */
export function getWorkflow(mode: string): ModeWorkflow | undefined {
    return MODE_WORKFLOWS.find(w => w.mode === mode);
}

/** 根据创作模式获取参与的 AI 员工列表（按执行顺序） */
export function getWorkflowAgents(mode: string): (AgentProfile & { role: string; action: string; order: number })[] {
    const workflow = getWorkflow(mode);
    if (!workflow) return [];

    return workflow.steps
        .filter(step => !step.optional) // 默认只返回必要步骤
        .map(step => {
            const agent = getAgent(step.agentId);
            if (!agent) return null;
            return { ...agent, role: step.role, action: step.action, order: step.order };
        })
        .filter((a): a is NonNullable<typeof a> => a !== null)
        .sort((a, b) => a.order - b.order);
}

/** 根据问题关键词智能推荐场景 */
export function matchScenario(query: string): TaskScenario[] {
    const keywords = query.toLowerCase();
    return TASK_SCENARIOS.filter(sc => {
        const targets = [sc.question, sc.category, sc.suggestedAction].join(' ').toLowerCase();
        // 简单的关键词匹配
        const words = keywords.split(/\s+/);
        return words.some(w => w.length > 1 && targets.includes(w));
    }).slice(0, 3);
}

/** 获取某个 AI 员工擅长的任务场景 */
export function getAgentExpertise(agentId: string): {
    workflows: { mode: string; label: string; role: string; action: string }[];
    scenarios: TaskScenario[];
} {
    const workflows = MODE_WORKFLOWS
        .filter(w => w.steps.some(s => s.agentId === agentId))
        .map(w => {
            const step = w.steps.find(s => s.agentId === agentId)!;
            return { mode: w.mode, label: w.label, role: step.role, action: step.action };
        });

    const scenarios = TASK_SCENARIOS.filter(
        sc => sc.primaryAgent === agentId || sc.supportAgents.includes(agentId)
    );

    return { workflows, scenarios };
}

/** 获取某个部门负责的任务场景 */
export function getDepartmentScenarios(deptId: string): TaskScenario[] {
    return TASK_SCENARIOS.filter(sc => sc.department === deptId);
}

/** 获取某个部门参与的创作流程 */
export function getDepartmentWorkflows(deptId: string): ModeWorkflow[] {
    return MODE_WORKFLOWS.filter(w => w.departments.includes(deptId));
}
