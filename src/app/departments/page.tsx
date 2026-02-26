'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Building2, Users, ChevronRight, Zap, MessageSquare,
    BarChart3, TrendingUp, Sparkles, ArrowRight,
} from 'lucide-react';
import { DEPARTMENTS, getTotalAgentCount, getOnlineAgentCount } from '@/lib/departments';
import type { Department, AgentProfile } from '@/lib/departments';

export default function DepartmentsPage() {
    const router = useRouter();
    const [expandedDept, setExpandedDept] = useState<string | null>(null);

    const totalAgents = getTotalAgentCount();
    const onlineAgents = getOnlineAgentCount();

    return (
        <>
            <style>{`
                .dept-page { max-width: 1200px; margin: 0 auto; padding: 32px 24px; }
                .dept-header { margin-bottom: 32px; }
                .dept-header h1 { font-size: 1.8rem; font-weight: 800; color: #1e293b; margin: 0 0 8px; display: flex; align-items: center; gap: 10px; }
                .dept-header p { color: #64748b; font-size: 0.95rem; margin: 0; }
                
                .dept-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
                .stat-card { background: white; border-radius: 16px; padding: 20px; border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 14px; }
                .stat-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .stat-value { font-size: 1.5rem; font-weight: 800; color: #1e293b; }
                .stat-label { font-size: 0.8rem; color: #94a3b8; }

                .dept-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
                .dept-card { background: white; border-radius: 20px; border: 1px solid #e2e8f0; overflow: hidden; transition: all 0.3s; cursor: pointer; }
                .dept-card:hover { box-shadow: 0 8px 30px rgba(0,0,0,0.08); transform: translateY(-2px); }
                
                .dept-card-header { padding: 24px; display: flex; align-items: center; justify-content: space-between; }
                .dept-card-left { display: flex; align-items: center; gap: 16px; }
                .dept-icon-wrap { width: 56px; height: 56px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
                .dept-card-info h3 { font-size: 1.15rem; font-weight: 700; color: #1e293b; margin: 0 0 4px; }
                .dept-card-info p { font-size: 0.85rem; color: #64748b; margin: 0; }
                .dept-card-meta { display: flex; align-items: center; gap: 16px; }
                .dept-count { font-size: 0.85rem; color: #94a3b8; display: flex; align-items: center; gap: 4px; }
                .dept-expand-icon { transition: transform 0.3s; color: #94a3b8; }
                .dept-expand-icon.expanded { transform: rotate(90deg); }

                .dept-agents { padding: 0 24px 24px; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; animation: fadeIn 0.3s ease; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
                
                .agent-card { background: #f8fafc; border-radius: 14px; padding: 16px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; }
                .agent-card:hover { background: white; border-color: #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.04); }
                .agent-avatar { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
                .agent-info { flex: 1; min-width: 0; }
                .agent-name { font-size: 0.9rem; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px; }
                .agent-role { font-size: 0.78rem; color: #94a3b8; margin-top: 2px; }
                .agent-status { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
                .agent-status.online { background: #22c55e; }
                .agent-status.busy { background: #f59e0b; }
                .agent-status.offline { background: #94a3b8; }
                .agent-caps { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; }
                .agent-cap { font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background: rgba(99,102,241,0.08); color: #6366f1; }

                .dept-divider { height: 1px; background: #f1f5f9; margin: 0 24px; }

                .quick-actions { display: flex; gap: 12px; margin-bottom: 32px; flex-wrap: wrap; }
                .quick-btn { display: flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 12px; border: 1px solid #e2e8f0; background: white; font-size: 0.9rem; font-weight: 600; color: #334155; cursor: pointer; transition: all 0.2s; }
                .quick-btn:hover { border-color: #6366f1; color: #6366f1; box-shadow: 0 2px 8px rgba(99,102,241,0.1); }
                .quick-btn .icon { color: #6366f1; }
            `}</style>

            <div className="dept-page">
                <div className="dept-header">
                    <h1><Building2 size={28} /> AI 部门管理</h1>
                    <p>管理您的 AI 智能团队，跨部门协作完成各类任务</p>
                </div>

                {/* 快捷操作 */}
                <div className="quick-actions">
                    <button className="quick-btn" onClick={() => router.push('/meeting')}>
                        <MessageSquare size={18} className="icon" /> 发起会议
                    </button>
                    <button className="quick-btn" onClick={() => router.push('/workspace')}>
                        <Sparkles size={18} className="icon" /> 创作工作区
                    </button>
                </div>

                {/* 统计卡片 */}
                <div className="dept-stats">
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.1)' }}>
                            <Building2 size={22} color="#6366f1" />
                        </div>
                        <div>
                            <div className="stat-value">{DEPARTMENTS.length}</div>
                            <div className="stat-label">部门总数</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(34,197,94,0.1)' }}>
                            <Users size={22} color="#22c55e" />
                        </div>
                        <div>
                            <div className="stat-value">{onlineAgents}/{totalAgents}</div>
                            <div className="stat-label">在线员工</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.1)' }}>
                            <Zap size={22} color="#f59e0b" />
                        </div>
                        <div>
                            <div className="stat-value">{DEPARTMENTS.reduce((s, d) => s + d.agents.reduce((a, ag) => a + ag.stats.tasksCompleted, 0), 0)}</div>
                            <div className="stat-label">已完成任务</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon" style={{ background: 'rgba(236,72,153,0.1)' }}>
                            <TrendingUp size={22} color="#ec4899" />
                        </div>
                        <div>
                            <div className="stat-value">{(DEPARTMENTS.reduce((s, d) => s + d.agents.reduce((a, ag) => a + ag.stats.avgScore, 0), 0) / totalAgents).toFixed(0)}</div>
                            <div className="stat-label">平均评分</div>
                        </div>
                    </div>
                </div>

                {/* 部门列表 */}
                <div className="dept-grid">
                    {DEPARTMENTS.map(dept => (
                        <div key={dept.id} className="dept-card">
                            <div
                                className="dept-card-header"
                                onClick={() => setExpandedDept(expandedDept === dept.id ? null : dept.id)}
                            >
                                <div className="dept-card-left">
                                    <div className="dept-icon-wrap" style={{ background: dept.gradient, color: 'white' }}>
                                        {dept.icon}
                                    </div>
                                    <div className="dept-card-info">
                                        <h3>{dept.name}</h3>
                                        <p>{dept.description}</p>
                                    </div>
                                </div>
                                <div className="dept-card-meta">
                                    <span className="dept-count">
                                        <Users size={14} /> {dept.agents.length} 人
                                    </span>
                                    <ChevronRight
                                        size={18}
                                        className={`dept-expand-icon ${expandedDept === dept.id ? 'expanded' : ''}`}
                                    />
                                </div>
                            </div>

                            {expandedDept === dept.id && (
                                <>
                                    <div className="dept-divider" />
                                    <div className="dept-agents">
                                        {dept.agents.map(agent => (
                                            <div key={agent.id} className="agent-card">
                                                <div className="agent-avatar" style={{ background: `${agent.color}15`, color: agent.color }}>
                                                    {agent.avatar}
                                                </div>
                                                <div className="agent-info">
                                                    <div className="agent-name">
                                                        {agent.name}
                                                        <span className={`agent-status ${agent.status}`} />
                                                    </div>
                                                    <div className="agent-role">{agent.role}</div>
                                                    <div className="agent-caps">
                                                        {agent.capabilities.slice(0, 3).map(c => (
                                                            <span key={c} className="agent-cap">{c}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
