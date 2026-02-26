'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ListChecks, Search, ArrowRight, Users, ChevronRight,
    Music, Video, BookOpen, Sparkles, Wand2, MessageSquare,
    Building2, Zap, Play,
} from 'lucide-react';
import { MODE_WORKFLOWS, TASK_SCENARIOS, getWorkflow, matchScenario } from '@/lib/task-router';
import { DEPARTMENTS, getDepartment, getAgent } from '@/lib/departments';
import type { TaskScenario, ModeWorkflow } from '@/lib/task-router';

const MODE_ICONS: Record<string, React.ReactNode> = {
    douyin: <Music size={18} />,
    video: <Video size={18} />,
    xhs: <BookOpen size={18} />,
    polish: <Sparkles size={18} />,
    imitate: <Wand2 size={18} />,
};

const MODE_COLORS: Record<string, string> = {
    douyin: '#8b5cf6',
    video: '#ec4899',
    xhs: '#ef4444',
    polish: '#10b981',
    imitate: '#f59e0b',
};

export default function TasksPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMode, setSelectedMode] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'workflows' | 'scenarios'>('workflows');

    // 搜索匹配
    const matchedScenarios = searchQuery.trim().length > 1
        ? matchScenario(searchQuery)
        : [];

    const selectedWorkflow = selectedMode ? getWorkflow(selectedMode) : null;

    return (
        <>
            <style>{`
                .tasks-page { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
                .tasks-header { margin-bottom: 28px; }
                .tasks-header h1 { font-size: 1.8rem; font-weight: 800; color: #1e293b; margin: 0 0 6px; display: flex; align-items: center; gap: 10px; }
                .tasks-header p { color: #64748b; font-size: 0.9rem; margin: 0; }

                /* 搜索栏 */
                .task-search { position: relative; margin-bottom: 28px; }
                .task-search input { width: 100%; padding: 16px 16px 16px 48px; border: 2px solid #e2e8f0; border-radius: 16px; font-size: 1rem; outline: none; background: white; color: #1e293b; transition: border-color 0.2s; box-sizing: border-box; }
                .task-search input:focus { border-color: #818cf8; }
                .task-search .search-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
                .search-results { position: absolute; top: calc(100% + 8px); left: 0; right: 0; background: white; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); z-index: 50; overflow: hidden; }
                .search-result-item { padding: 14px 18px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.15s; }
                .search-result-item:last-child { border-bottom: none; }
                .search-result-item:hover { background: #f8fafc; }
                .search-result-q { font-size: 0.9rem; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
                .search-result-action { font-size: 0.78rem; color: #64748b; line-height: 1.4; }
                .search-result-agents { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
                .search-agent-tag { font-size: 0.7rem; padding: 2px 8px; border-radius: 10px; background: rgba(99,102,241,0.08); color: #6366f1; font-weight: 600; }

                /* Tabs */
                .task-tabs { display: flex; gap: 6px; margin-bottom: 24px; }
                .task-tab { padding: 9px 18px; border-radius: 10px; border: 1px solid #e2e8f0; background: white; font-size: 0.85rem; font-weight: 600; color: #64748b; cursor: pointer; transition: all 0.2s; }
                .task-tab.active { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border-color: transparent; }

                /* 创作流程卡片 */
                .workflow-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-bottom: 32px; }
                .workflow-card { background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; cursor: pointer; transition: all 0.2s; }
                .workflow-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.06); transform: translateY(-1px); }
                .workflow-card.selected { border-color: #818cf8; box-shadow: 0 0 0 2px rgba(99,102,241,0.2); }
                .workflow-card-top { padding: 18px; display: flex; align-items: center; gap: 14px; }
                .wf-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
                .wf-info h3 { font-size: 0.95rem; font-weight: 700; color: #1e293b; margin: 0 0 3px; }
                .wf-info p { font-size: 0.78rem; color: #94a3b8; margin: 0; }
                .wf-depts { display: flex; gap: 4px; margin-top: 4px; }
                .wf-dept-tag { font-size: 0.65rem; padding: 1px 6px; border-radius: 4px; background: #f1f5f9; color: #64748b; }

                /* 工作流详情 */
                .workflow-detail { background: white; border-radius: 20px; border: 1px solid #e2e8f0; padding: 28px; margin-bottom: 24px; }
                .workflow-detail h2 { font-size: 1.15rem; font-weight: 700; color: #1e293b; margin: 0 0 6px; display: flex; align-items: center; gap: 8px; }
                .workflow-detail > p { font-size: 0.85rem; color: #64748b; margin: 0 0 20px; }

                .wf-steps { position: relative; }
                .wf-step { display: flex; gap: 16px; padding: 14px 0; position: relative; }
                .wf-step-line { position: absolute; left: 19px; top: 38px; bottom: 0; width: 2px; background: #e2e8f0; }
                .wf-step:last-child .wf-step-line { display: none; }
                .wf-step-num { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700; flex-shrink: 0; position: relative; z-index: 1; }
                .wf-step-body { flex: 1; }
                .wf-step-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
                .wf-step-agent { font-size: 0.88rem; font-weight: 700; color: #1e293b; }
                .wf-step-role { font-size: 0.72rem; padding: 2px 8px; border-radius: 6px; background: rgba(99,102,241,0.08); color: #6366f1; font-weight: 600; }
                .wf-step-action { font-size: 0.82rem; color: #64748b; line-height: 1.4; }
                .wf-step-optional { opacity: 0.6; }
                .wf-step-optional .wf-step-role { background: rgba(148,163,184,0.1); color: #94a3b8; }

                .wf-meeting-tip { background: linear-gradient(135deg, rgba(99,102,241,0.04), rgba(139,92,246,0.04)); border: 1px solid rgba(99,102,241,0.12); border-radius: 14px; padding: 16px; margin-top: 20px; display: flex; align-items: flex-start; gap: 12px; }
                .wf-meeting-tip .icon-wrap { width: 36px; height: 36px; border-radius: 10px; background: rgba(99,102,241,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #6366f1; }
                .wf-meeting-tip .tip-content { flex: 1; }
                .wf-meeting-tip .tip-title { font-size: 0.85rem; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
                .wf-meeting-tip .tip-desc { font-size: 0.78rem; color: #64748b; margin-bottom: 8px; }
                .wf-meeting-btn { padding: 6px 14px; border-radius: 8px; border: none; background: #6366f1; color: white; font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
                .wf-meeting-btn:hover { background: #4f46e5; }

                .wf-actions { display: flex; gap: 10px; margin-top: 20px; }
                .wf-action-btn { padding: 10px 20px; border-radius: 10px; border: 1px solid #e2e8f0; background: white; font-size: 0.85rem; font-weight: 600; color: #334155; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
                .wf-action-btn:hover { border-color: #6366f1; color: #6366f1; }
                .wf-action-btn.primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; }

                /* 场景卡片 */
                .scenario-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
                .scenario-card { background: white; border-radius: 14px; border: 1px solid #e2e8f0; padding: 18px; cursor: pointer; transition: all 0.2s; }
                .scenario-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                .sc-category { font-size: 0.68rem; font-weight: 700; color: white; padding: 3px 8px; border-radius: 6px; display: inline-block; margin-bottom: 8px; }
                .sc-question { font-size: 0.92rem; font-weight: 700; color: #1e293b; margin-bottom: 6px; }
                .sc-action { font-size: 0.8rem; color: #64748b; line-height: 1.4; margin-bottom: 10px; }
                .sc-agents { display: flex; gap: 4px; flex-wrap: wrap; }
                .sc-agent-chip { display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 8px; background: #f8fafc; font-size: 0.72rem; font-weight: 600; color: #475569; }
                .sc-agent-chip.primary { background: rgba(99,102,241,0.08); color: #6366f1; }
            `}</style>

            <div className="tasks-page">
                <div className="tasks-header">
                    <h1><ListChecks size={28} /> 任务中心</h1>
                    <p>告诉我你需要解决什么问题，我来推荐最合适的 AI 团队和工作流程</p>
                </div>

                {/* 智能搜索 */}
                <div className="task-search">
                    <Search size={18} className="search-icon" />
                    <input
                        placeholder="描述你的需求，例如：帮我写一篇小红书笔记、竞品在做什么..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    {matchedScenarios.length > 0 && (
                        <div className="search-results">
                            {matchedScenarios.map(sc => {
                                const primaryA = getAgent(sc.primaryAgent);
                                const dept = getDepartment(sc.department);
                                return (
                                    <div key={sc.id} className="search-result-item">
                                        <div className="search-result-q">{sc.question}</div>
                                        <div className="search-result-action">{sc.suggestedAction}</div>
                                        <div className="search-result-agents">
                                            {dept && <span className="search-agent-tag">{dept.icon} {dept.name}</span>}
                                            {primaryA && <span className="search-agent-tag">{primaryA.avatar} {primaryA.name} 主责</span>}
                                            {sc.supportAgents.slice(0, 2).map(id => {
                                                const a = getAgent(id);
                                                return a ? <span key={id} className="search-agent-tag">{a.avatar} {a.name}</span> : null;
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="task-tabs">
                    <button
                        className={`task-tab ${activeTab === 'workflows' ? 'active' : ''}`}
                        onClick={() => setActiveTab('workflows')}
                    >
                        创作工作流
                    </button>
                    <button
                        className={`task-tab ${activeTab === 'scenarios' ? 'active' : ''}`}
                        onClick={() => setActiveTab('scenarios')}
                    >
                        问题找人
                    </button>
                </div>

                {/* Tab 1: 创作工作流 */}
                {activeTab === 'workflows' && (
                    <>
                        <div className="workflow-grid">
                            {MODE_WORKFLOWS.map(wf => (
                                <div
                                    key={wf.mode}
                                    className={`workflow-card ${selectedMode === wf.mode ? 'selected' : ''}`}
                                    onClick={() => setSelectedMode(selectedMode === wf.mode ? null : wf.mode)}
                                >
                                    <div className="workflow-card-top">
                                        <div className="wf-icon" style={{ background: MODE_COLORS[wf.mode] || '#6366f1' }}>
                                            {MODE_ICONS[wf.mode]}
                                        </div>
                                        <div className="wf-info">
                                            <h3>{wf.label}</h3>
                                            <p>{wf.description}</p>
                                            <div className="wf-depts">
                                                {wf.departments.map(dId => {
                                                    const d = getDepartment(dId);
                                                    return d ? <span key={dId} className="wf-dept-tag">{d.icon} {d.name}</span> : null;
                                                })}
                                            </div>
                                        </div>
                                        <ChevronRight size={16} style={{ color: '#94a3b8', flexShrink: 0 }} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 工作流详情 */}
                        {selectedWorkflow && (
                            <div className="workflow-detail">
                                <h2>
                                    <span style={{ color: MODE_COLORS[selectedWorkflow.mode] }}>{MODE_ICONS[selectedWorkflow.mode]}</span>
                                    {selectedWorkflow.label} — 工作流程
                                </h2>
                                <p>{selectedWorkflow.description}</p>

                                <div className="wf-steps">
                                    {selectedWorkflow.steps.map((step, i) => {
                                        const agent = getAgent(step.agentId);
                                        if (!agent) return null;
                                        const color = MODE_COLORS[selectedWorkflow.mode] || '#6366f1';
                                        return (
                                            <div key={i} className={`wf-step ${step.optional ? 'wf-step-optional' : ''}`}>
                                                <div className="wf-step-num" style={{
                                                    background: step.optional ? '#f1f5f9' : `${color}15`,
                                                    color: step.optional ? '#94a3b8' : color,
                                                }}>
                                                    {agent.avatar}
                                                </div>
                                                <div className="wf-step-line" />
                                                <div className="wf-step-body">
                                                    <div className="wf-step-header">
                                                        <span className="wf-step-agent">{agent.name}</span>
                                                        <span className="wf-step-role">{step.role}</span>
                                                        {step.optional && <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>可选</span>}
                                                    </div>
                                                    <div className="wf-step-action">{step.action}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* 会议建议 */}
                                {selectedWorkflow.meetingSuggestion && (
                                    <div className="wf-meeting-tip">
                                        <div className="icon-wrap"><MessageSquare size={16} /></div>
                                        <div className="tip-content">
                                            <div className="tip-title">建议开会讨论</div>
                                            <div className="tip-desc">
                                                {selectedWorkflow.meetingSuggestion.when}：
                                                「{selectedWorkflow.meetingSuggestion.topic}」
                                            </div>
                                            <button
                                                className="wf-meeting-btn"
                                                onClick={() => router.push('/meeting')}
                                            >
                                                <MessageSquare size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                                                发起会议
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="wf-actions">
                                    <button
                                        className="wf-action-btn primary"
                                        onClick={() => router.push(`/workspace?mode=${selectedWorkflow.mode}`)}
                                    >
                                        <Play size={16} /> 开始创作
                                    </button>
                                    <button
                                        className="wf-action-btn"
                                        onClick={() => router.push('/departments')}
                                    >
                                        <Building2 size={16} /> 查看团队
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Tab 2: 问题找人 */}
                {activeTab === 'scenarios' && (
                    <div className="scenario-grid">
                        {TASK_SCENARIOS.map(sc => {
                            const dept = getDepartment(sc.department);
                            const primary = getAgent(sc.primaryAgent);
                            const catColors: Record<string, string> = {
                                '选题策划': '#6366f1', '选题评估': '#8b5cf6', '竞品分析': '#f59e0b',
                                '内容创作': '#ec4899', '内容优化': '#10b981', '模仿创作': '#f97316',
                                '视觉设计': '#f43f5e', '视频制作': '#fb7185', '数据分析': '#059669',
                                '增长策略': '#ef4444', '投放决策': '#f59e0b', '用户洞察': '#0ea5e9',
                                '知识检索': '#3b82f6',
                            };
                            return (
                                <div key={sc.id} className="scenario-card">
                                    <span className="sc-category" style={{ background: catColors[sc.category] || '#6366f1' }}>
                                        {sc.category}
                                    </span>
                                    <div className="sc-question">"{sc.question}"</div>
                                    <div className="sc-action">{sc.suggestedAction}</div>
                                    <div className="sc-agents">
                                        {primary && (
                                            <span className="sc-agent-chip primary">
                                                {primary.avatar} {primary.name} · 主责
                                            </span>
                                        )}
                                        {sc.supportAgents.map(id => {
                                            const a = getAgent(id);
                                            return a ? (
                                                <span key={id} className="sc-agent-chip">
                                                    {a.avatar} {a.name}
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}
