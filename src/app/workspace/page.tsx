'use client';
import { Share2, Star, Paperclip, Send, Settings, Check, X, Zap, Lightbulb, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';

import { useState, useCallback, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
    WorkflowState,
    WorkflowStage,
    ParsedRequirement,
    TopicPlan,
    Script,
    TrafficReport,
    QualityReview,
    ContentStyle,
    CoverSuggestion,
    VideoDuration,
    Tone,
    CreationMode,
    XhsNote,
    XhsQualityReview,
    PolishResult,
    PlatformAdvice,
} from '@/lib/types';
import { exportToWord } from '@/lib/export-word';

/* ============ CONSTANTS ============ */
const TEMPLATES: { label: string; value: ContentStyle }[] = [
    { label: '知识科普', value: '知识科普' },
    { label: '情感共鸣', value: '情感共鸣' },
    { label: '实用教程', value: '实用教程' },
    { label: '热点跟踪', value: '热点跟踪' },
    { label: '种草带货', value: '种草带货' },
];

const STAGES: { key: WorkflowStage; label: string; step: number }[] = [
    { key: 'parsing', label: '需求解析', step: 1 },
    { key: 'planning', label: '选题策划', step: 2 },
    { key: 'writing', label: '内容生成', step: 3 },
    { key: 'optimizing', label: '流量优化', step: 4 },
    { key: 'reviewing', label: '质量审核', step: 5 },
];

const STAGE_ORDER: WorkflowStage[] = ['parsing', 'planning', 'writing', 'optimizing', 'reviewing', 'done'];

const AUDIENCE_AGE_OPTIONS = ['不限', '18-24岁', '25-34岁', '35-44岁', '45-54岁', '55岁以上'];

const SCRIPT_TYPE_OPTIONS = ['口播脚本', '画外音解说', '画面故事', '情景再现', '产品展示'];
const SCRIPT_TYPE_DESC: Record<string, string> = {
    '口播脚本': '真人面对镜头说话，适合知识类/情感类',
    '画外音解说': '画面+配音旁白，适合风景/产品/教程',
    '画面故事': '纯画面叙事，AI可生成视频',
    '情景再现': '生活化场景演绎，适合剧情类',
    '产品展示': '产品特写+使用场景，适合带货',
};
const AUDIENCE_GENDER_OPTIONS = ['不限', '偏男性', '偏女性'];
const DURATION_OPTIONS: VideoDuration[] = ['超短(15-30s)', '短(30-60s)', '中(1-3min)', '长(3-5min)'];
const TONE_OPTIONS: Tone[] = ['专业权威', '轻松幽默', '认真走心', '情绪张力', '口语化'];
const INDUSTRY_OPTIONS = ['不限', '科技互联网', '教育培训', '金融财经', '健康医疗', '生活方式', '电商零售', '职场管理', '文化娱乐', '法律移民', '其他'];

const TONE_PROMPT_MAP: Record<Tone, string> = {
    '专业权威': '语气风格：专业权威 — 用数据和事实驱动论述，引用可查证来源。语言精准凝练避免口水话，使用专业术语配合通俗类比。句式完整逻辑清晰，给人真专家信任感。严禁网络流行语和过度口语化。',
    '轻松幽默': '语气风格：轻松幽默 — 像跟好朋友聊天，多用比喻夸张反转制造笑点。善用自嘲调侃，穿插段子生活梗。语气词丰富（绝了、真会谢、你敢信）。节奏明快短句为主，禁止说教感。',
    '认真走心': '语气风格：认真走心 — 带真实情感温度，多用我你建立亲密连接。分享真实经历心路历程，温暖不矫情真诚不煽情。用细节场景感官描写打动人，留白给读者共鸣空间。结尾有余韵不把话说满。',
    '情绪张力': '语气风格：情绪张力 — 用强烈情感起伏抓注意力。善用对比冲突制造戏剧感（期望vs现实）。开头高情绪密度。句式节奏突变长句铺垫后短句爆发。多用反问排比省略号。让读者情绪起伏有被击中的感觉。',
    '口语化': '语气风格：口语化 — 完全按说话方式写字，面对面聊天感。大量语气词（你说是不是、就很离谱、我跟你讲）。短句碎句为主允许不完整句式。停顿转折自然。禁止书面语：然而、因此、综上所述一个不要。像脱口秀或vlog旁白。',
};

const LOADING_MESSAGES: Record<string, string> = {
    parsing: '正在理解你的创作意图...',
    planning: '正在策划 3 个差异化选题...',
    writing: '正在创作内容，精心打磨每一个细节...',
    optimizing: '正在进行流量规则审查...',
    reviewing: '正在做最终质量把关...',
};

interface WorkflowLog {
    id: number;
    time: string;
    agent: string;
    message: string;
    status: 'running' | 'done' | 'info';
    reasoning?: string;
}

/** 多任务实例 */
interface TaskInstance {
    id: string;
    label: string;
    mode: CreationMode;
    state: WorkflowState;
    logs: WorkflowLog[];
    createdAt: number;
}

/** 浏览历史记录 */
interface ResultHistoryEntry {
    id: string;
    mode: CreationMode;
    title: string;
    summary: string;
    score: number | null;
    state: WorkflowState;
    createdAt: number;
}

const RESULT_HISTORY_KEY = 'workflow_result_history';
const RUNNING_TASK_KEY = 'workflow_running_task';
const MAX_RESULT_HISTORY = 50;

let taskIdCounter = 0;
function genTaskId() { return `task-${++taskIdCounter}-${Date.now()}`; }

function initialState(mode: CreationMode = 'video'): WorkflowState {
    return {
        mode,
        stage: 'idle',
        userInput: '',
        parsedRequirement: null,
        topicPlans: null,
        selectedTopicId: null,
        script: null,
        trafficReport: null,
        qualityReview: null,
        xhsNote: null,
        xhsReview: null,
        polishResult: null,
        platformAdvice: null,
        error: null,
        streamingText: '',
        imitateResult: null,
    };
}

const POLISH_PLATFORMS = ['通用', '视频号', '小红书'];

/* ============ MAIN PAGE ============ */
function WorkspaceInner() {
    const searchParams = useSearchParams();
    const urlMode = searchParams.get('mode') as CreationMode | null;
    const validModes: CreationMode[] = ['video', 'xhs', 'douyin', 'polish', 'imitate'];
    const startMode = (urlMode && validModes.includes(urlMode)) ? urlMode : 'video';

    const [state, setState] = useState<WorkflowState>(initialState(startMode));
    const [selectedTemplate, setSelectedTemplate] = useState<ContentStyle | null>(null);
    const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['hook', 'golden_quotes', 'main_body', 'full_narration', 'covers']));
    const [toast, setToast] = useState('');
    const [workflowLogs, setWorkflowLogs] = useState<WorkflowLog[]>([]);
    const logIdRef = useRef(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [logPanelOpen, setLogPanelOpen] = useState(true);
    const [expandedReasonings, setExpandedReasonings] = useState<Set<number>>(new Set());
    const [history, setHistory] = useState<{ text: string; time: string }[]>([]);

    // Selector states
    const [selAudienceAge, setSelAudienceAge] = useState('不限');
    const [selAudienceGender, setSelAudienceGender] = useState('不限');
    const [selDuration, setSelDuration] = useState<VideoDuration>('短(30-60s)');
    const [selTone, setSelTone] = useState<Tone>('轻松幽默');
    const [selIndustry, setSelIndustry] = useState('不限');
    const [selScriptType, setSelScriptType] = useState('口播脚本');

    // Video generation states
    const [videoGenStatus, setVideoGenStatus] = useState<'idle' | 'submitting' | 'processing' | 'done' | 'error'>('idle');
    const [videoGenTaskId, setVideoGenTaskId] = useState('');
    const [videoGenPrompt, setVideoGenPrompt] = useState('');
    const [videoGenResult, setVideoGenResult] = useState<{ videoUrl: string; coverUrl?: string } | null>(null);
    const [videoGenError, setVideoGenError] = useState('');
    const videoGenPollRef = useRef<NodeJS.Timeout | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const historyRef = useRef<HTMLDivElement>(null);

    // Polish mode states
    const [polishPlatform, setPolishPlatform] = useState('通用');
    const [imitatePlatform, setImitatePlatform] = useState('小红书');

    // Multi-task states
    const [taskList, setTaskList] = useState<TaskInstance[]>([]);
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

    // Result history states
    const [resultHistory, setResultHistory] = useState<ResultHistoryEntry[]>([]);
    const [showResultHistory, setShowResultHistory] = useState(false);

    // Multi-Agent mode
    const [useMultiAgent, setUseMultiAgent] = useState(true);

    // File upload
    interface UploadedFile { id: string; filename: string; type: string; content: string; preview: string; }
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Advanced config states
    const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
    const [advBrandInfo, setAdvBrandInfo] = useState('');
    const [advSellingPoint, setAdvSellingPoint] = useState('');
    const [advPainPoint, setAdvPainPoint] = useState('');
    const [advReferenceLinks, setAdvReferenceLinks] = useState('');
    const [advPersonalStyle, setAdvPersonalStyle] = useState('');

    // Load history from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem('workflow_history');
            if (saved) setHistory(JSON.parse(saved));
        } catch { /* ignore */ }
        try {
            const savedResults = localStorage.getItem(RESULT_HISTORY_KEY);
            if (savedResults) setResultHistory(JSON.parse(savedResults));
        } catch { /* ignore */ }
    }, []);

    // Auto-scroll to bottom when new content appears (ChatGPT-style)
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        // Small delay to let DOM update
        const timer = setTimeout(() => {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        }, 100);
        return () => clearTimeout(timer);
    }, [workflowLogs, state.stage, state.topicPlans, state.script, state.xhsNote, state.polishResult, state.imitateResult]);

    // Auto-save to result history when a task completes
    useEffect(() => {
        if (state.stage !== 'done') return;
        const modeLabels: Record<CreationMode, string> = { video: '视频号脚本', xhs: '小红书笔记', douyin: '抖音脚本', polish: '内容润色', imitate: '内容模仿' };
        let title = '';
        let summary = '';
        let score: number | null = null;

        if (state.mode === 'polish' && state.polishResult) {
            title = state.userInput.slice(0, 30) + (state.userInput.length > 30 ? '...' : '');
            summary = state.polishResult.summary;
            score = state.polishResult.score.after;
        } else if (state.mode === 'xhs' && state.xhsReview) {
            title = state.parsedRequirement?.topic || state.userInput.slice(0, 30);
            summary = state.xhsReview.summary;
            score = state.xhsReview.overall_score;
        } else if ((state.mode === 'video' || state.mode === 'douyin') && state.qualityReview) {
            title = state.parsedRequirement?.topic || state.userInput.slice(0, 30);
            summary = state.qualityReview.summary;
            score = state.qualityReview.overall_score;
        } else if (state.mode === 'imitate' && state.imitateResult) {
            title = state.imitateResult.original_title || state.userInput.slice(0, 30);
            summary = state.imitateResult.original_summary;
            score = state.imitateResult.originality_score;
        } else {
            return; // No valid result
        }

        const entry: ResultHistoryEntry = {
            id: `rh-${Date.now()}`,
            mode: state.mode,
            title: `[${modeLabels[state.mode]}] ${title}`,
            summary,
            score,
            state: { ...state },
            createdAt: Date.now(),
        };

        setResultHistory(prev => {
            const updated = [entry, ...prev].slice(0, MAX_RESULT_HISTORY);
            try {
                localStorage.setItem(RESULT_HISTORY_KEY, JSON.stringify(updated));
                window.dispatchEvent(new CustomEvent('resultHistoryUpdated'));
            } catch { /* ignore */ }
            return updated;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.stage]);

    // Sync running task to localStorage so sidebar can show it
    useEffect(() => {
        const modeLabels: Record<CreationMode, string> = { video: '视频号', xhs: '小红书', douyin: '抖音', polish: '润色', imitate: '模仿' };
        if (state.stage !== 'idle' && state.stage !== 'done') {
            // Task is running — save to localStorage
            const runningTask = {
                id: `running-${Date.now()}`,
                title: state.userInput.slice(0, 30) || '创作任务',
                mode: state.mode,
                modeLabel: modeLabels[state.mode],
                stage: state.stage,
                state: { ...state },
                logs: workflowLogs,
                createdAt: Date.now(),
            };
            try {
                localStorage.setItem(RUNNING_TASK_KEY, JSON.stringify(runningTask));
                window.dispatchEvent(new CustomEvent('runningTaskUpdated'));
            } catch { /* ignore */ }
        } else {
            // Task is idle or done — clear running task
            try {
                localStorage.removeItem(RUNNING_TASK_KEY);
                window.dispatchEvent(new CustomEvent('runningTaskUpdated'));
            } catch { /* ignore */ }
        }
    }, [state.stage, state.mode, state.userInput, workflowLogs.length]);

    // On mount: restore running task if saved from previous navigation
    useEffect(() => {
        try {
            const saved = localStorage.getItem(RUNNING_TASK_KEY);
            if (saved) {
                const task = JSON.parse(saved);
                if (task?.state) {
                    setState(task.state);
                    if (task.logs) setWorkflowLogs(task.logs);
                    // Clear the saved running task since we've restored it
                    localStorage.removeItem(RUNNING_TASK_KEY);
                    window.dispatchEvent(new CustomEvent('runningTaskUpdated'));
                }
            }
        } catch { /* ignore */ }
    }, []);

    // Close history dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
                setShowHistory(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Listen for sidebar events (load history entry, new session)
    useEffect(() => {
        const handleLoadHistory = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.id) {
                // Read from localStorage directly to avoid stale closure
                let entries: ResultHistoryEntry[] = resultHistory;
                try {
                    const stored = localStorage.getItem(RESULT_HISTORY_KEY);
                    if (stored) entries = JSON.parse(stored);
                } catch { /* use state fallback */ }
                const entry = entries.find(r => r.id === detail.id);
                if (entry) {
                    setState(entry.state);
                    setWorkflowLogs([]);
                    setShowResultHistory(false);
                    setActiveTaskId(null);
                }
            }
        };
        const handleNewSession = () => {
            setState(initialState(state.mode));
            setWorkflowLogs([]);
            setActiveTaskId(null);
        };
        window.addEventListener('loadHistoryEntry', handleLoadHistory);
        window.addEventListener('newWorkspaceSession', handleNewSession);
        return () => {
            window.removeEventListener('loadHistoryEntry', handleLoadHistory);
            window.removeEventListener('newWorkspaceSession', handleNewSession);
        };
    });

    const saveToHistory = (text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const entry = {
            text: trimmed,
            time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        };
        const updated = [entry, ...history.filter(h => h.text !== trimmed)].slice(0, 20);
        setHistory(updated);
        try { localStorage.setItem('workflow_history', JSON.stringify(updated)); } catch { /* ignore */ }
    };

    const deleteHistory = (index: number) => {
        const updated = history.filter((_, i) => i !== index);
        setHistory(updated);
        try { localStorage.setItem('workflow_history', JSON.stringify(updated)); } catch { /* ignore */ }
    };

    const clearAllHistory = () => {
        setHistory([]);
        try { localStorage.removeItem('workflow_history'); } catch { /* ignore */ }
    };

    const addLog = (agent: string, message: string, status: 'running' | 'done' | 'info' = 'running', reasoning?: string) => {
        const id = ++logIdRef.current;
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        setWorkflowLogs(prev => [...prev, { id, time, agent, message, status, reasoning }]);
        return id;
    };

    const updateLog = (id: number, updates: Partial<WorkflowLog>) => {
        setWorkflowLogs(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    };

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2000);
    };

    const copyText = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast('已复制到剪贴板');
    };

    const shareResult = () => {
        const modeLabels: Record<string, string> = { video: '视频号', xhs: '小红书', douyin: '抖音', polish: '润色', imitate: '模仿' };
        let text = `【${modeLabels[state.mode]}】${state.userInput.slice(0, 50)}\n\n`;
        if (state.mode === 'polish' && state.polishResult) {
            text += state.polishResult.polished || '';
        } else if (state.mode === 'xhs' && state.xhsReview?.final_note) {
            const note = state.xhsReview.final_note;
            text += (note.titles?.[0] || '') + '\n\n' + (note.caption || '');
        } else if (state.mode === 'imitate' && state.imitateResult) {
            text += (state.imitateResult.titles?.[0] || '') + '\n\n' + (state.imitateResult.content || '');
        } else {
            const script = state.qualityReview?.final_script || state.script;
            text += script?.full_narration || '';
        }
        navigator.clipboard.writeText(text).then(() => showToast('内容已复制，可分享给好友'));
    };

    const toggleResultFavorite = () => {
        try {
            const favKey = 'workflow_favorites';
            const historyKey = 'workflow_result_history';
            const stored = localStorage.getItem(historyKey);
            if (!stored) return;
            const entries = JSON.parse(stored);
            const latest = entries[0]; // Most recent entry
            if (!latest) return;
            const favs: string[] = JSON.parse(localStorage.getItem(favKey) || '[]');
            if (favs.includes(latest.id)) {
                localStorage.setItem(favKey, JSON.stringify(favs.filter((f: string) => f !== latest.id)));
                showToast('已取消收藏');
            } else {
                localStorage.setItem(favKey, JSON.stringify([...favs, latest.id]));
                showToast('已收藏到个人中心');
            }
        } catch { /* ignore */ }
    };

    const toggleModule = (key: string) => {
        setExpandedModules(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const setError = (msg: string) => {
        setState(prev => ({ ...prev, stage: 'error', error: msg }));
    };

    const reset = () => {
        setState(initialState(state.mode));
        setSelectedTemplate(null);
        setWorkflowLogs([]);
        logIdRef.current = 0;
    };

    /* ---- Multi-task: save current to list & open new ---- */
    const saveCurrentAndNew = () => {
        // Only save if there is meaningful progress
        if (state.stage !== 'idle') {
            const modeLabels: Record<CreationMode, string> = { video: '视频号', xhs: '小红书', douyin: '抖音', polish: '润色', imitate: '模仿' };
            const label = `${modeLabels[state.mode]} - ${state.userInput.slice(0, 20) || '任务'}...`;
            const task: TaskInstance = {
                id: genTaskId(),
                label,
                mode: state.mode,
                state: { ...state },
                logs: [...workflowLogs],
                createdAt: Date.now(),
            };
            setTaskList(prev => [...prev, task]);
        }
        reset();
    };

    const switchToTask = (taskId: string) => {
        // Save current first
        if (state.stage !== 'idle') {
            const modeLabels: Record<CreationMode, string> = { video: '视频号', xhs: '小红书', douyin: '抖音', polish: '润色', imitate: '模仿' };
            const label = `${modeLabels[state.mode]} - ${state.userInput.slice(0, 20) || '任务'}...`;
            const updatedCurrent: TaskInstance = {
                id: activeTaskId || genTaskId(),
                label,
                mode: state.mode,
                state: { ...state },
                logs: [...workflowLogs],
                createdAt: Date.now(),
            };
            setTaskList(prev => {
                const existing = prev.findIndex(t => t.id === activeTaskId);
                if (existing >= 0) {
                    const copy = [...prev];
                    copy[existing] = updatedCurrent;
                    return copy;
                }
                return [...prev, updatedCurrent];
            });
        }
        // Restore target task
        const target = taskList.find(t => t.id === taskId);
        if (target) {
            setState(target.state);
            setWorkflowLogs(target.logs);
            setActiveTaskId(taskId);
            setTaskList(prev => prev.filter(t => t.id !== taskId));
        }
    };

    const removeTask = (taskId: string) => {
        setTaskList(prev => prev.filter(t => t.id !== taskId));
    };

    /* ---- Result History: load / delete ---- */
    const loadResultFromHistory = (entry: ResultHistoryEntry) => {
        setState(entry.state);
        setWorkflowLogs([]);
        setShowResultHistory(false);
        setActiveTaskId(null);
    };

    const deleteResultHistory = (id: string) => {
        setResultHistory(prev => {
            const updated = prev.filter(e => e.id !== id);
            try { localStorage.setItem(RESULT_HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
            return updated;
        });
    };

    const clearAllResultHistory = () => {
        setResultHistory([]);
        try { localStorage.removeItem(RESULT_HISTORY_KEY); } catch { /* ignore */ }
    };

    /* ---- Multi-Agent SSE Handler ---- */
    const handleMultiAgentSubmit = async (selectedTopicId?: number) => {
        setWorkflowLogs([]);
        logIdRef.current = 0;

        const body: Record<string, unknown> = {
            mode: state.mode,
            userInput: state.userInput,
            taskId: `task-${Date.now()}`,
        };
        if (selectedTopicId != null) {
            body.selectedTopicId = selectedTopicId;
        }

        // Map agent events to log entries
        const agentLogMap = new Map<string, number>();

        try {
            const res = await fetch('/api/agent/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok || !res.body) {
                throw new Error(`API 错误: ${res.status}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const event = JSON.parse(line.slice(6));
                        handleAgentEvent(event, agentLogMap);
                    } catch { /* skip non-JSON */ }
                }
            }
        } catch (err: unknown) {
            addLog('系统', `出错：${err instanceof Error ? err.message : String(err)}`, 'info');
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    const handleAgentEvent = (event: { type: string; agentId: string; agentName: string; message: string; data?: Record<string, unknown>; reasoning?: string }, agentLogMap: Map<string, number>) => {
        switch (event.type) {
            case 'agent_start': {
                const logId = addLog(event.agentName, event.message, 'running', event.reasoning);
                agentLogMap.set(event.agentId, logId);
                break;
            }
            case 'agent_progress': {
                // Update existing or create new log
                const existingId = agentLogMap.get(event.agentId);
                if (existingId) {
                    updateLog(existingId, { message: event.message });
                } else {
                    const logId = addLog(event.agentName, event.message, 'running', event.reasoning);
                    agentLogMap.set(event.agentId, logId);
                }
                break;
            }
            case 'agent_done': {
                const doneId = agentLogMap.get(event.agentId);
                if (doneId) {
                    updateLog(doneId, { status: 'done', message: event.message });
                } else {
                    addLog(event.agentName, event.message, 'done');
                }
                // Map agent results to state
                if (event.data) mapAgentDataToState(event.agentId, event.data);
                break;
            }
            case 'agent_error': {
                const errId = agentLogMap.get(event.agentId);
                if (errId) updateLog(errId, { status: 'done', message: `[Error] ${event.message}` });
                else addLog(event.agentName, `[Error] ${event.message}`, 'info');
                break;
            }
            case 'orchestrator_decision': {
                addLog('编排器', event.message, 'info', event.reasoning);
                break;
            }
            case 'revision_loop': {
                addLog('回写', event.message, 'info');
                break;
            }
            case 'task_complete': {
                addLog('系统', `[Done] ${event.message}`, 'info');
                setState(prev => ({ ...prev, stage: 'done' }));
                break;
            }
            case 'task_error': {
                addLog('系统', `[Error] ${event.message}`, 'info');
                setError(event.message);
                break;
            }
        }
    };

    const mapAgentDataToState = (agentId: string, data: Record<string, unknown>) => {
        switch (agentId) {
            case 'planner': {
                const d = data as { parsed?: unknown; topics?: unknown[] };
                setState(prev => ({
                    ...prev,
                    parsedRequirement: d.parsed as WorkflowState['parsedRequirement'],
                    topicPlans: d.topics as WorkflowState['topicPlans'],
                    // Don't reset to 'planning' if user already selected a topic
                    stage: prev.selectedTopicId !== null ? prev.stage : 'planning',
                }));
                break;
            }
            case 'writer': {
                if (state.mode === 'xhs') {
                    setState(prev => ({ ...prev, xhsNote: data as unknown as WorkflowState['xhsNote'], stage: 'optimizing' }));
                } else if (state.mode === 'polish') {
                    setState(prev => ({ ...prev, polishResult: data as unknown as WorkflowState['polishResult'], stage: 'done' }));
                } else {
                    setState(prev => ({ ...prev, script: data as unknown as WorkflowState['script'], stage: 'optimizing' }));
                }
                break;
            }
            case 'critic': {
                const c = data as { report?: unknown; review?: unknown };
                if (state.mode === 'xhs') {
                    setState(prev => ({
                        ...prev,
                        trafficReport: c.report as WorkflowState['trafficReport'],
                        xhsReview: c.review as WorkflowState['xhsReview'],
                        stage: 'reviewing',
                    }));
                } else {
                    setState(prev => ({
                        ...prev,
                        trafficReport: c.report as WorkflowState['trafficReport'],
                        qualityReview: c.review as WorkflowState['qualityReview'],
                        stage: 'reviewing',
                    }));
                }
                break;
            }
        }
    };

    /* ---- API Call Helpers ---- */
    const apiCall = useCallback(async <T,>(url: string, body: object): Promise<T> => {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
            throw new Error(json.error || `API error: ${res.status}`);
        }
        return json.data as T;
    }, []);

    /* ---- Stage 1: Parse Intent ---- */
    const handleSubmit = async () => {
        if (!state.userInput.trim()) return;

        // Build enriched input with selected options
        let enrichedInput = state.userInput.trim();
        const extras: string[] = [];
        if (selAudienceAge !== '不限') extras.push(`目标受众年龄：${selAudienceAge}`);
        if (selAudienceGender !== '不限') extras.push(`受众性别：${selAudienceGender}`);
        extras.push(`视频时长：${selDuration}`);
        extras.push(TONE_PROMPT_MAP[selTone]);
        if (selIndustry !== '不限') extras.push(`行业：${selIndustry}`);
        if ((state.mode === 'douyin' || state.mode === 'video') && selScriptType !== '口播脚本') {
            extras.push(`脚本类型：${selScriptType}（不是口播，需要侧重画面描述和场景切换）`);
        }
        if (extras.length > 0) enrichedInput += '\n' + extras.join('，');

        // Append advanced config if provided
        const advExtras: string[] = [];
        if (advBrandInfo.trim()) advExtras.push(`品牌/产品：${advBrandInfo.trim()}`);
        if (advSellingPoint.trim()) advExtras.push(`核心卖点：${advSellingPoint.trim()}`);
        if (advPainPoint.trim()) advExtras.push(`目标痛点：${advPainPoint.trim()}`);
        if (advReferenceLinks.trim()) advExtras.push(`参考链接：${advReferenceLinks.trim()}`);
        if (advPersonalStyle.trim()) advExtras.push(`个人IP风格：${advPersonalStyle.trim()}`);
        if (advExtras.length > 0) enrichedInput += '\n【高级配置】' + advExtras.join('；');

        // Append uploaded file contexts
        if (uploadedFiles.length > 0) {
            const fileContexts = uploadedFiles
                .filter(f => f.type !== 'image')
                .map(f => `【附件: ${f.filename}】\n${f.content}`);
            if (fileContexts.length > 0) {
                enrichedInput += '\n\n【用户上传的参考资料】\n' + fileContexts.join('\n\n');
            }
        }

        saveToHistory(state.userInput);
        setShowHistory(false);
        setWorkflowLogs([]);
        logIdRef.current = 0;
        setLogPanelOpen(true);
        setState(prev => ({ ...prev, stage: 'parsing', error: null }));

        try {
            if (useMultiAgent) {
                // Multi-Agent 模式：SSE 流式编排
                setState(prev => ({ ...prev, stage: 'parsing' }));
                await handleMultiAgentSubmit();
                return;
            }

            // Step 1: Parse (legacy workflow)
            const logParse = addLog('意图解析', '正在分析创作需求，提取主题、受众、风格等关键信息...', 'running',
                '【推理逻辑】\n1. 从用户原始输入中提取核心主题关键词\n2. 通过语义分析判断内容风格（知识科普/情感共鸣/实用教程等）\n3. 根据表述方式推断目标受众画像（年龄、性别、兴趣标签）\n4. 结合结构化选项（时长、语气、行业）生成完整需求文档\n5. 确保所有字段都有合理默认值，避免后续 Agent 缺少上下文');
            const parsed = await apiCall<ParsedRequirement>('/api/workflow/parse', {
                userInput: enrichedInput,
            });
            updateLog(logParse, { status: 'done', message: `解析完成 — 主题「${parsed.topic}」· ${parsed.content_style} · ${parsed.video_duration}` });
            setState(prev => ({ ...prev, stage: 'planning', parsedRequirement: parsed }));

            // Step 1.5: Trend Research (optional - skips gracefully if no API key)
            let trendContext = '';
            const logTrend = addLog('趋势研究', '正在搜索实时热门话题与竞品动态...', 'running',
                '【推理逻辑】\n1. 将主题 + 内容风格组合为搜索查询条件\n2. 调用 Serper API 获取 Google 实时搜索结果\n3. 从搜索摘要中提取热门话题趋势\n4. 分析竞品内容策略，总结流量密码\n5. 将趋势洞察传递给选题策划 Agent 参考\n注意：无 API Key 时会跳过此步骤，使用 AI 内置知识');
            try {
                const trendResult = await apiCall<{ summary: string; trendingTopics: string[]; competitorInsights: string[] }>('/api/workflow/search', {
                    query: `${parsed.topic} ${parsed.content_style} 小红书`,
                });
                if (trendResult?.trendingTopics?.length > 0) {
                    trendContext = `热门趋势参考：${trendResult.trendingTopics.join('、')}`;
                    updateLog(logTrend, { status: 'done', message: `发现 ${trendResult.trendingTopics.length} 个热门话题` });
                } else {
                    updateLog(logTrend, { status: 'done', message: trendResult?.summary || '趋势研究完成（使用 AI 内置知识）' });
                }
            } catch {
                updateLog(logTrend, { status: 'done', message: '趋势研究跳过（将使用 AI 内置知识）' });
            }

            // Step 2: Topic Planning
            const logTopic = addLog('选题策划', '正在基于需求生成 3 个差异化选题方案，评估流量潜力...', 'running',
                '【推理逻辑】\n1. 基于结构化需求文档 + 趋势研究结果进行选题策划\n2. 使用流量预测模型对每个选题打分（10分制）\n3. 确保 3 个选题从不同角度切入：\n   - 选题 A：高流量潜力（追热点/蹭流量）\n   - 选题 B：高价值深度（专业可信/长尾搜索）\n   - 选题 C：强互动设计（争议性/参与感）\n4. 输出每个选题的角度说明和流量评分理由');
            const topics = await apiCall<TopicPlan[]>('/api/workflow/topics', {
                requirement: parsed,
            });
            updateLog(logTopic, { status: 'done', message: `策划完成 — 生成了 ${topics.length} 个选题方案` });
            setState(prev => ({ ...prev, stage: 'planning', topicPlans: topics }));
        } catch (err: unknown) {
            addLog('系统', `出错：${err instanceof Error ? err.message : String(err)}`, 'info');
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    /* ---- Stage 2: Select Topic & Continue ---- */
    const handleSelectTopic = async (topicId: number) => {
        setState(prev => ({ ...prev, selectedTopicId: topicId }));
    };

    const handleContinueWithTopic = async () => {
        if (state.selectedTopicId === null || !state.topicPlans || !state.parsedRequirement) return;
        const selectedTopic = state.topicPlans.find(t => t.id === state.selectedTopicId)!;

        addLog('用户', `选定选题「${selectedTopic.title}」，流量评分 ${selectedTopic.traffic_score}`, 'info');
        setState(prev => ({ ...prev, stage: 'writing' }));

        if (useMultiAgent) {
            // Multi-Agent 模式：带选题继续
            await handleMultiAgentSubmit(selectedTopic.id);
            return;
        }

        try {
            if (state.mode === 'xhs') {
                // === 小红书图文工作流 ===
                const logWrite = addLog('图文创作', '正在创作小红书图文笔记：设计封面 → 编排图文卡片 → 撰写文案 → 打磨金句...', 'running',
                    '【推理逻辑】\n1. 根据选题策划结果确定内容结构（6-8 张图文卡片）\n2. 设计高吸引力封面：对比色 + 大字标题 + 悬念钩子\n3. 每张卡片遵循「一张一个核心信息点」原则编排\n4. 撰写正文文案：开头钩子 → 痛点共鸣 → 干货输出 → 互动引导\n5. 从 RAG 知识库检索爆款策略，打磨金句和话题标签\n6. 为每张卡片生成英文配图关键词，用于后续自动配图');
                addLog('RAG 知识库', '正在检索《爆款小红书》《增长黑客》中的相关策略...', 'info');
                const note = await apiCall<XhsNote>('/api/workflow/xhs-write', {
                    requirement: state.parsedRequirement,
                    selectedTopic,
                });
                updateLog(logWrite, { status: 'done', message: `笔记创作完成 — ${note.content_slides?.length || 0} 张图文卡片 · ${note.hashtags?.length || 0} 个话题标签` });

                // AI Image Generation
                const logImages = addLog('AI 绘图', '正在使用 Gemini AI 为每张卡片生成专属配图...', 'running',
                    '【推理逻辑】\n1. 从每张卡片的 image_keywords 提取语义关键词\n2. 结合卡片标题、正文内容、整体主题构建精细化 Prompt\n3. 调用 Gemini 3 Pro Image Preview API 生成 AI 原创插图\n4. 使用 3:4 竖版比例适配小红书卡片格式\n5. 生成失败时自动降级为占位图，确保流程不中断');
                try {
                    const imgResult = await apiCall<{ slides: typeof note.content_slides }>('/api/workflow/xhs-images', {
                        slides: note.content_slides,
                        topic: selectedTopic?.title || state.parsedRequirement?.topic || '',
                    });
                    if (imgResult?.slides) {
                        note.content_slides = imgResult.slides;
                    }
                    updateLog(logImages, { status: 'done', message: `AI 绘图完成 — ${note.content_slides?.length || 0} 张原创配图已生成` });
                } catch {
                    updateLog(logImages, { status: 'done', message: '绘图跳过（API 暂不可用，使用占位图）' });
                }

                setState(prev => ({ ...prev, xhsNote: note, stage: 'optimizing' }));

                const logOptimize = addLog('流量优化', '正在用 AARRR 增长模型审查笔记：封面吸引力 → 标题 SEO → 互动引导 → 传播基因...', 'running',
                    '【推理逻辑】\n1. 使用 AARRR 增长模型逐维度评分：\n   - Acquisition（获客）：封面点击率预测\n   - Activation（激活）：前 3 秒是否留住用户\n   - Retention（留存）：内容深度是否值得收藏\n   - Referral（推荐）：是否具备分享传播性\n   - Revenue（转化）：商业目标是否达成\n2. 检查标题是否含有平台 SEO 关键词\n3. 分析互动引导设计是否合理（评论引导/收藏引导）\n4. 输出综合流量潜力评分和各维度改进建议');
                const report = await apiCall<TrafficReport>('/api/workflow/xhs-optimize', {
                    requirement: state.parsedRequirement,
                    note,
                });
                updateLog(logOptimize, { status: 'done', message: `优化完成 — 综合评分 ${report.overall_score}/100 · ${report.dimensions?.length || 0} 个维度` });
                setState(prev => ({ ...prev, trafficReport: report, stage: 'reviewing' }));

                const logReview = addLog('质量审核', '正在做最终质量把关：平台合规性 → 排版美感 → 互动设计 → 生成终稿...', 'running',
                    '【推理逻辑】\n1. 敏感词和平台违规检查（广告法合规）\n2. 检查图文排版的美感和一致性\n3. 验证互动设计完整性（是否有评论引导、收藏引导）\n4. 综合流量优化建议进行终稿润色\n5. 生成最终版本笔记 + 质量评分');
                const review = await apiCall<XhsQualityReview>('/api/workflow/xhs-review', {
                    requirement: state.parsedRequirement,
                    note,
                    report,
                });
                updateLog(logReview, { status: 'done', message: `审核通过 — 最终评分 ${review.overall_score}/100 · 终稿已生成` });
                addLog('系统', '全部 Agent 工作完成，图文笔记交付成功', 'info');
                setState(prev => ({ ...prev, xhsReview: review, stage: 'done' }));
            } else if (state.mode === 'douyin') {
                // === 抖音脚本工作流 ===
                const logScript = addLog('抖音脚本创作', '正在创作抖音脚本：设计强钩子(前3秒权重40%) → 分镜口播 → 金句 → 封面方案...', 'running',
                    '【推理逻辑】\n1. 注入抖音算法知识：前3秒留存率权重40%，完播率≥40%才能升池\n2. 强钩子设计：悬念/冲突/反常识，比视频号更极端\n3. 信息密度均匀分布，每15-20秒一个兴趣锚点\n4. 口播节奏200-240字/分钟，保持紧凑\n5. 适配竖屏9:16，视觉焦点在中上部\n6. 评论引导设计（评论权重高于点赞）');
                addLog('平台智能', '已注入抖音推荐算法知识：三级标签机制、流量池晋级制度、搜推联动...', 'info');
                const script = await apiCall<Script>('/api/workflow/douyin-script', {
                    requirement: state.parsedRequirement,
                    selectedTopic,
                });
                updateLog(logScript, { status: 'done', message: `脚本创作完成 — ${script.word_count} 字 · ${script.estimated_duration} · ${script.main_body?.length || 0} 个分镜` });
                setState(prev => ({ ...prev, script, stage: 'optimizing' }));

                const logOptimize = addLog('抖音流量优化', '正在用抖音流量池模型审查：冷启动突破 → 标签精度 → 完播率 → 互动权重...', 'running',
                    '【推理逻辑】\n1. 冷启动突破评估：前3秒钩子+完播率是否达到升池标准\n2. 三级标签精度：核心标签(50%)+辅助标签(30%)+潜力标签(20%)\n3. 行为权重分析：关注>收藏>评论>分享>点赞\n4. 搜推联动检查：标题是否包含搜索高频词\n5. 内容质量评分：是否避免"开头套路+内容注水"');
                const report = await apiCall<TrafficReport>('/api/workflow/douyin-optimize', {
                    requirement: state.parsedRequirement,
                    script,
                });
                updateLog(logOptimize, { status: 'done', message: `优化完成 — 综合评分 ${report.overall_score}/100 · ${report.dimensions?.length || 0} 个维度` });
                setState(prev => ({ ...prev, trafficReport: report, stage: 'reviewing' }));

                const logReview = addLog('质量审核', '正在做最终质量把关 + 生成抖音发布建议...', 'running',
                    '【推理逻辑】\n1. 脚本终审：内容合规+口播流畅度+可执行性\n2. 生成抖音专属发布建议：最佳发布时间、话题标签策略、互动引导话术\n3. 基于抖音算法给出分发策略建议');
                const reviewRes = await fetch('/api/workflow/douyin-review', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requirement: state.parsedRequirement,
                        script,
                        trafficReport: report,
                    }),
                });
                const reviewJson = await reviewRes.json();
                if (!reviewRes.ok || reviewJson.error) throw new Error(reviewJson.error || 'review failed');
                const review = reviewJson.data as QualityReview;
                const advice = reviewJson.platformAdvice as PlatformAdvice | undefined;
                updateLog(logReview, { status: 'done', message: `审核通过 — 最终评分 ${review.overall_score}/100 · 发布建议已生成` });
                addLog('系统', '全部 Agent 工作完成，抖音脚本交付成功', 'info');
                setState(prev => ({ ...prev, qualityReview: review, platformAdvice: advice || null, stage: 'done' }));
            } else {
                // === 视频号脚本工作流 ===
                const logScript = addLog('脚本创作', '正在创作视频号脚本：设计 3 秒钩子 → 撰写分镜口播 → 打磨金句 → 构思封面方案...', 'running',
                    '【推理逻辑】\n1. 注入视频号算法知识：社交推荐55% + 兴趣推荐45%\n2. 设计适合社交分享的钩子（不需要像抖音那样极端刺激）\n3. 深度内容优先：1-3分钟知识分享优于纯娱乐\n4. 引导转发设计（转发权重高于点赞）\n5. 从 RAG 知识库检索相关金句和素材\n6. 构思 3 套封面设计方案');
                addLog('平台智能', '已注入视频号算法知识：社交裂变推荐、正能量偏好、深度内容优势...', 'info');
                const script = await apiCall<Script>('/api/workflow/script', {
                    requirement: state.parsedRequirement,
                    selectedTopic,
                });
                updateLog(logScript, { status: 'done', message: `脚本创作完成 — ${script.word_count} 字 · ${script.estimated_duration} · ${script.main_body?.length || 0} 个分镜` });
                setState(prev => ({ ...prev, script, stage: 'optimizing' }));

                const logOptimize = addLog('流量优化', '正在用视频号算法规则审查脚本：社交传播潜力 → 完播率预测 → 互动设计...', 'running',
                    '【推理逻辑】\n1. 社交传播潜力：内容是否具备"社交货币"属性\n2. 完播率预测：分析脚本节奏是否有效维持注意力\n3. 互动因子分析：是否有引导转发/评论的设计\n4. 正能量评估：是否符合视频号生态调性\n5. 输出综合评分和各维度改进建议');
                const report = await apiCall<TrafficReport>('/api/workflow/optimize', {
                    requirement: state.parsedRequirement,
                    script,
                });
                updateLog(logOptimize, { status: 'done', message: `优化完成 — 综合评分 ${report.overall_score}/100 · ${report.dimensions?.length || 0} 个维度` });
                setState(prev => ({ ...prev, trafficReport: report, stage: 'reviewing' }));

                const logReview = addLog('质量审核', '正在做最终质量把关 + 生成视频号发布建议...', 'running',
                    '【推理逻辑】\n1. 内容准确性：核实数据和论据是否可靠\n2. 敏感词检查：扫描广告法违禁词和平台敏感内容\n3. 口播流畅度：检查口语化程度和朗读节奏\n4. 生成视频号专属发布建议：最佳时间、社群分发策略\n5. 生成最终版脚本 + 质量评分报告');
                const reviewRes = await fetch('/api/workflow/review', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requirement: state.parsedRequirement,
                        script,
                        trafficReport: report,
                    }),
                });
                const reviewJson = await reviewRes.json();
                if (!reviewRes.ok || reviewJson.error) throw new Error(reviewJson.error || 'review failed');
                const review = reviewJson.data as QualityReview;
                const advice = reviewJson.platformAdvice as PlatformAdvice | undefined;
                updateLog(logReview, { status: 'done', message: `审核通过 — 最终评分 ${review.overall_score}/100 · 发布建议已生成` });
                addLog('系统', '全部 Agent 工作完成，脚本交付成功', 'info');
                setState(prev => ({ ...prev, qualityReview: review, platformAdvice: advice || null, stage: 'done' }));
            }
        } catch (err: unknown) {
            addLog('系统', `出错：${err instanceof Error ? err.message : String(err)}`, 'info');
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    /* ---- Template selection ---- */
    const handleTemplateClick = (tpl: ContentStyle) => {
        setSelectedTemplate(tpl);

        // Auto-recommend selectors based on content style
        const toneMap: Record<ContentStyle, Tone> = {
            '知识科普': '专业权威',
            '情感共鸣': '认真走心',
            '实用教程': '口语化',
            '热点跟踪': '情绪张力',
            '种草带货': '轻松幽默',
        };
        const industryMap: Record<ContentStyle, string> = {
            '知识科普': '不限',
            '情感共鸣': '生活方式',
            '实用教程': '不限',
            '热点跟踪': '科技互联网',
            '种草带货': '电商零售',
        };
        const ageMap: Record<ContentStyle, string> = {
            '知识科普': '25-34岁',
            '情感共鸣': '25-34岁',
            '实用教程': '18-24岁',
            '热点跟踪': '18-24岁',
            '种草带货': '18-24岁',
        };
        const genderMap: Record<ContentStyle, string> = {
            '知识科普': '不限',
            '情感共鸣': '偏女性',
            '实用教程': '不限',
            '热点跟踪': '不限',
            '种草带货': '偏女性',
        };
        setSelTone(toneMap[tpl]);
        setSelIndustry(industryMap[tpl]);
        setSelAudienceAge(ageMap[tpl]);
        setSelAudienceGender(genderMap[tpl]);

        if (state.mode === 'xhs') {
            const prefixes: Record<ContentStyle, string> = {
                '知识科普': '写一篇小红书图文笔记：为什么你交的社保可能白交了？用大白话拆解五险一金的隐藏规则，帮打工人避坑省钱',
                '情感共鸣': '写一篇小红书图文笔记：30岁裸辞去大理开花店的第87天，从月薪3万到月入3千，我后悔了吗？',
                '实用教程': '写一篇小红书图文笔记：手把手教你用AI工具10分钟做出电影级Vlog，零基础也能学会，附详细步骤和工具推荐',
                '热点跟踪': '写一篇小红书图文笔记：2026年最新AI Agent工具测评，我花了一周时间把市面上的全试了一遍，结论出乎意料',
                '种草带货': '写一篇小红书图文笔记：用了三个月的戴森新款吹风机，说几个博主不会告诉你的真实感受，附使用前后对比',
            };
            setState(prev => ({ ...prev, userInput: prefixes[tpl] }));
        } else {
            const prefixes: Record<ContentStyle, string> = {
                '知识科普': '写一个短视频脚本：为什么越努力越穷？用经济学原理解释普通人最容易踩的3个"勤奋陷阱"，颠覆你的认知',
                '情感共鸣': '写一个短视频脚本：北漂10年，终于在老家买了房，搬家那天我妈说了一句话，我在车里哭了很久',
                '实用教程': '写一个短视频脚本：教你3步写出让老板秒批的方案，我靠这个方法从专员升到了总监，模板直接套用',
                '热点跟踪': '写一个短视频脚本：GPT-5刚发布就炸了，我第一时间深度体验，这3个能力彻底改变了我的工作方式',
                '种草带货': '写一个短视频脚本：这款不到200块的国产耳机，音质吊打某大牌，我戴了半年给你们说说真实体验',
            };
            setState(prev => ({ ...prev, userInput: prefixes[tpl] }));
        }
    };

    /* ---- Polish: Content rewrite ---- */
    const handlePolish = async () => {
        if (!state.userInput.trim() || state.userInput.trim().length < 10) return;
        saveToHistory(state.userInput);
        setShowHistory(false);
        setWorkflowLogs([]);
        logIdRef.current = 0;
        setLogPanelOpen(true);
        setState(prev => ({ ...prev, stage: 'writing', error: null, polishResult: null }));

        try {
            const logPolish = addLog('内容润色', '正在用全部知识库标准分析并优化你的文案...', 'running',
                '【推理逻辑】\n1. 加载三大知识库（薛兆丰经济学讲义 + 爆款小红书 + 增长黑客）\n2. 平等检索所有知识库，找到与用户内容最相关的素材\n3. 从标题/钩子、结构、表达、互动、流量、情感六个维度分析\n4. 逐条改写并记录改动原因\n5. 给出优化前后评分对比');

            const result = await apiCall<PolishResult>('/api/workflow/polish', {
                content: state.userInput.trim(),
                platform: polishPlatform,
            });

            updateLog(logPolish, {
                status: 'done',
                message: `润色完成 — 评分 ${result.score.before} → ${result.score.after}（+${result.score.after - result.score.before}分）`,
            });

            setState(prev => ({ ...prev, stage: 'done', polishResult: result }));
        } catch (err: unknown) {
            addLog('系统', `出错：${err instanceof Error ? err.message : String(err)}`, 'info');
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    /* ---- Imitate handler ---- */
    const handleImitate = async () => {
        const input = state.userInput.trim();
        if (!input) return;
        saveToHistory(input);
        setShowHistory(false);
        setWorkflowLogs([]);
        logIdRef.current = 0;
        setLogPanelOpen(true);
        setState(prev => ({ ...prev, stage: 'writing', error: null, imitateResult: null }));

        try {
            const isUrl = /^https?:\/\//i.test(input);
            const logFetch = addLog('内容解析', isUrl ? '正在抓取链接内容并解析...' : '正在分析输入内容...', 'running',
                '【推理逻辑】\n1. ' + (isUrl ? '发送 HTTP 请求抓取页面内容' : '分析粘贴的文本内容') + '\n2. 提取标题、正文、标签等核心信息\n3. 分析内容结构和写作手法');

            const logRewrite = addLog('AI 创作', '正在基于参考内容生成伪原创...', 'running',
                '【推理逻辑】\n1. 借鉴选题角度，但完全重新组织表达\n2. 加入差异化观点和独特案例\n3. 按目标平台风格规范优化\n4. 确保原创度 > 75%，规避违规风险');

            const result = await apiCall<import('@/lib/agents/content-imitator').ImitateResult>('/api/workflow/imitate', {
                ...(isUrl ? { url: input } : { content: input }),
                platform: imitatePlatform,
            });

            updateLog(logFetch, { status: 'done', message: `内容解析完成 — ${result.original_summary.slice(0, 30)}...` });
            updateLog(logRewrite, { status: 'done', message: `伪原创生成完成 — 原创度 ${result.originality_score}%` });

            setState(prev => ({ ...prev, stage: 'done', imitateResult: result }));
        } catch (err: unknown) {
            addLog('系统', `出错：${err instanceof Error ? err.message : String(err)}`, 'info');
            setError(err instanceof Error ? err.message : String(err));
        }
    };

    /* ---- Helper: Check stage progress ---- */
    const stageIndex = (s: WorkflowStage) => STAGE_ORDER.indexOf(s);
    const currentIdx = stageIndex(state.stage);
    const isStageActive = (s: WorkflowStage) => state.stage === s;
    const isStageDone = (s: WorkflowStage) => {
        if (state.stage === 'error') return false;
        return stageIndex(s) < currentIdx;
    };

    /* ---- Export (Word) ---- */
    const exportScript = async () => {
        const script = state.qualityReview?.final_script || state.script;
        if (!script) return;
        try {
            await exportToWord(script);
            showToast('脚本已导出为 Word 文档');
        } catch (err) {
            console.error('Export failed:', err);
            showToast('导出失败，请重试');
        }
    };

    /* ============ RENDER ============ */
    return (
        <div className="app-container">
            {/* Scrollable content area — takes full height above input */}
            <div className="workspace-scroll-container" ref={scrollContainerRef}>

                {/* Idle state — centered greeting + suggestions */}
                {(state.stage === 'idle' || state.stage === 'error') && state.mode !== 'polish' && state.mode !== 'imitate' && (
                    <div className="workspace-greeting">
                        <h1 className="greeting-title">
                            {state.mode === 'xhs' ? '小红书图文创作' : state.mode === 'douyin' ? '抖音脚本创作' : '视频号脚本创作'}
                        </h1>
                        <p className="greeting-subtitle">
                            {state.mode === 'xhs' ? '搜索 SEO + CES 评分优化，打造爆款笔记' : state.mode === 'douyin' ? '完播率 + 流量池晋级优化' : '社交裂变 + 深度内容优化'}
                        </p>
                        <div className="greeting-suggestions">
                            {TEMPLATES.map(tpl => (
                                <button
                                    key={tpl.value}
                                    className="suggestion-chip"
                                    onClick={() => handleTemplateClick(tpl.value)}
                                >
                                    {tpl.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {(state.stage === 'idle' || state.stage === 'error') && state.mode === 'polish' && (
                    <div className="workspace-greeting">
                        <h1 className="greeting-title">内容润色</h1>
                        <p className="greeting-subtitle">融合全部知识库，按爆款标准全面改写优化</p>
                    </div>
                )}

                {(state.stage === 'idle' || state.stage === 'error') && state.mode === 'imitate' && (
                    <div className="workspace-greeting">
                        <h1 className="greeting-title">内容模仿</h1>
                        <p className="greeting-subtitle">链接解析 + AI 伪原创，支持小红书、抖音、视频号</p>
                    </div>
                )}

                {state.error && (
                    <div className="error-box">
                        <span className="error-icon">!</span>
                        <div>
                            <div className="error-message">{state.error}</div>
                            <button className="btn btn-ghost" onClick={reset} style={{ marginTop: 8 }}>重新开始</button>
                        </div>
                    </div>
                )}

                {/* Workflow Progress */}
                {state.stage !== 'idle' && (
                    <div className="workflow-progress">
                        {STAGES.map((s, i) => (
                            <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
                                <div className="progress-step">
                                    <div className={`step-indicator ${isStageActive(s.key) ? 'active' : ''} ${isStageDone(s.key) ? 'done' : ''}`}>
                                        {isStageDone(s.key) ? <Check size={14} /> : s.step}
                                    </div>
                                    <span className={`step-label ${isStageActive(s.key) ? 'active' : ''} ${isStageDone(s.key) ? 'done' : ''}`}>
                                        {s.label}
                                    </span>
                                </div>
                                {i < STAGES.length - 1 && (
                                    <div className={`step-connector ${isStageDone(STAGES[i + 1].key) || isStageActive(STAGES[i + 1].key) ? 'done' : ''}`} />
                                )}
                            </div>
                        ))}
                    </div>
                )}



                {/* Imitate Result Display */}
                {state.mode === 'imitate' && state.imitateResult && state.stage === 'done' && (
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title">
                                伪原创完成
                            </div>
                            <span className="score-circle" style={{ width: 48, height: 48, fontSize: '1.1rem', borderWidth: 2 }}>
                                {state.imitateResult.originality_score}
                            </span>
                        </div>

                        {/* Original summary */}
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <strong>原始内容摘要：</strong>{state.imitateResult.original_summary}
                        </div>

                        {/* Titles */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--fg)' }}>备选标题</div>
                            {state.imitateResult.titles.map((t, i) => (
                                <div key={i} className="title-option" style={{ cursor: 'pointer' }} onClick={() => copyText(t)}>
                                    <span className="number">{i + 1}.</span>
                                    <span>{t}</span>
                                </div>
                            ))}
                        </div>

                        {/* Content */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <div style={{ fontWeight: 600, color: 'var(--fg)' }}>伪原创正文</div>
                                <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => copyText(state.imitateResult!.content)}>复制</button>
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '0.92rem', color: 'var(--fg-secondary)' }}>
                                {state.imitateResult.content}
                            </div>
                        </div>

                        {/* Hashtags */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--fg)' }}>推荐标签</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {state.imitateResult.hashtags.map((tag, i) => (
                                    <span key={i} className="template-tag" style={{ fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => copyText(tag)}>{tag}</span>
                                ))}
                            </div>
                        </div>

                        {/* Platform tips */}
                        {state.imitateResult.platform_tips && (
                            <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.05), rgba(168,85,247,0.05))', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: '0.85rem' }}>
                                <strong><Lightbulb size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 发布建议：</strong>{state.imitateResult.platform_tips}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="final-actions">
                            <button className="btn btn-primary" onClick={() => copyText(state.imitateResult!.content)}>
                                复制正文
                            </button>
                            <button className="btn btn-secondary" onClick={() => copyText(state.imitateResult!.titles.join('\n'))}>
                                复制标题
                            </button>
                            <button className="btn btn-secondary" onClick={shareResult} title="分享内容">
                                <Share2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 分享
                            </button>
                            <button className="btn btn-secondary" onClick={toggleResultFavorite} title="收藏">
                                <Star size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 收藏
                            </button>
                            <button className="btn btn-secondary" onClick={reset}>
                                新建模仿
                            </button>
                        </div>
                    </div>
                )}

                {/* Live Workflow Log Panel */}
                {workflowLogs.length > 0 && state.stage !== 'idle' && (
                    <div className="section-card workflow-log-panel">
                        <div className="section-header" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setLogPanelOpen(!logPanelOpen)}>
                            <div className="section-title">
                                Agent 工作进度
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginLeft: 8 }}>({workflowLogs.filter(l => l.status === 'done').length}/{workflowLogs.length})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {state.stage === 'done' && (
                                    <span style={{ fontSize: '0.78rem', color: 'var(--success)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>全部完成 <Check size={14} /></span>
                                )}
                                <span className={`module-toggle ${logPanelOpen ? 'open' : ''}`} style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}><ChevronDown size={14} /></span>
                            </div>
                        </div>
                        {logPanelOpen && (
                            <div className="workflow-log-list">
                                {workflowLogs.map(log => (
                                    <div key={log.id} className={`workflow-log-item ${log.status}${log.agent === '编排器' ? ' orchestrator-log' : ''}`}>
                                        <div className="log-indicator">
                                            {log.status === 'running' ? (
                                                <div className="log-spinner" />
                                            ) : log.status === 'done' ? (
                                                <span className="log-check"><Check size={14} /></span>
                                            ) : log.agent === '编排器' ? (
                                                <span className="log-info-dot" style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', fontSize: '0.75rem', fontStyle: 'normal', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={12} /></span>
                                            ) : (
                                                <span className="log-info-dot">i</span>
                                            )}
                                        </div>
                                        <div className="log-content">
                                            <div className="log-header">
                                                <span className="log-agent">{log.agent}</span>
                                                <span className="log-time">{log.time}</span>
                                            </div>
                                            <div className="log-message">{log.message}</div>
                                            {log.reasoning && (
                                                <div className="log-reasoning-wrapper">
                                                    <button
                                                        className={`log-reasoning-toggle ${expandedReasonings.has(log.id) ? 'open' : ''}`}
                                                        onClick={() => setExpandedReasonings(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(log.id)) next.delete(log.id);
                                                            else next.add(log.id);
                                                            return next;
                                                        })}
                                                    >
                                                        <span className="reasoning-icon"><ChevronRight size={14} /></span>
                                                        推理过程
                                                    </button>
                                                    {expandedReasonings.has(log.id) && (
                                                        <div className="log-reasoning-content">
                                                            {log.reasoning}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {['parsing', 'writing', 'optimizing', 'reviewing'].includes(state.stage) && (
                                    <div className="workflow-log-item running">
                                        <div className="log-indicator"><div className="log-spinner" /></div>
                                        <div className="log-content">
                                            <div className="log-message" style={{ color: 'var(--primary)' }}>{LOADING_MESSAGES[state.stage]}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Parsed Result */}
                {state.parsedRequirement && isStageDone('parsing') && (
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title">
                                需求解析
                            </div>
                        </div>
                        <div className="parsed-grid">
                            <div className="parsed-item">
                                <div className="parsed-label">主题</div>
                                <div className="parsed-value">{state.parsedRequirement.topic}</div>
                            </div>
                            <div className="parsed-item">
                                <div className="parsed-label">行业</div>
                                <div className="parsed-value">{state.parsedRequirement.industry}</div>
                            </div>
                            <div className="parsed-item">
                                <div className="parsed-label">风格</div>
                                <div className="parsed-value">{state.parsedRequirement.content_style}</div>
                            </div>
                            <div className="parsed-item">
                                <div className="parsed-label">时长</div>
                                <div className="parsed-value">{state.parsedRequirement.video_duration}</div>
                            </div>
                            <div className="parsed-item">
                                <div className="parsed-label">语气</div>
                                <div className="parsed-value">{state.parsedRequirement.tone}</div>
                            </div>
                            <div className="parsed-item">
                                <div className="parsed-label">受众</div>
                                <div className="parsed-value">
                                    {state.parsedRequirement.target_audience?.age_range} · {state.parsedRequirement.target_audience?.gender}
                                </div>
                            </div>
                            {state.parsedRequirement.business_goal && (
                                <div className="parsed-item">
                                    <div className="parsed-label">目标</div>
                                    <div className="parsed-value">{state.parsedRequirement.business_goal}</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Topic Cards */}
                {state.topicPlans && state.stage === 'planning' && (
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title">
                                选题方案
                            </div>
                        </div>
                        <div className="topic-cards">
                            {state.topicPlans.map(topic => (
                                <div
                                    key={topic.id}
                                    className={`topic-card ${state.selectedTopicId === topic.id ? 'selected' : ''}`}
                                    onClick={() => handleSelectTopic(topic.id)}
                                >
                                    <span className="topic-number">方案 {topic.id}</span>
                                    <div className="topic-title">{topic.title}</div>
                                    <div className="topic-angle">{topic.angle}</div>
                                    <div className="topic-score">
                                        <div className="score-bar">
                                            <div className="score-fill" style={{ width: `${topic.traffic_score}%` }} />
                                        </div>
                                        <span className="score-value">{topic.traffic_score}</span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }}>
                                        {topic.score_reason}
                                    </div>
                                    <div className="topic-metrics">
                                        <span className="metric-chip">完播 {topic.metrics_estimate?.completion_rate}</span>
                                        <span className="metric-chip">互动 {topic.metrics_estimate?.interaction_rate}</span>
                                        <span className="metric-chip">转发 {topic.metrics_estimate?.share_rate}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {state.selectedTopicId !== null && (
                            <div style={{ textAlign: 'center', marginTop: 'var(--space-xl)' }}>
                                <button className="btn btn-primary" onClick={handleContinueWithTopic}>
                                    基于选中方案生成脚本
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Script Display */}
                {state.script && isStageDone('writing') && (
                    <ScriptDisplay
                        script={state.qualityReview?.final_script || state.script}
                        expandedModules={expandedModules}
                        toggleModule={toggleModule}
                        copyText={copyText}
                    />
                )}

                {/* AI Video Generation — 非口播脚本生成视频 */}
                {state.script && isStageDone('writing') && selScriptType !== '口播脚本' && (state.mode === 'douyin' || state.mode === 'video') && (
                    <div className="section-card" style={{ borderColor: 'rgba(139,92,246,0.3)', background: 'linear-gradient(135deg, rgba(139,92,246,0.03), rgba(99,102,241,0.03))' }}>
                        <div className="section-header">
                            <div className="section-title" style={{ color: '#8b5cf6' }}>🎬 AI 视频生成</div>
                        </div>
                        {videoGenStatus === 'idle' && (
                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
                                    当前脚本类型为「{selScriptType}」，可以用 AI 将脚本自动转化为视频。<br />
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>即梦 AI 将根据脚本内容智能生成 5 秒高质量短视频画面</span>
                                </p>
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                                    {(['16:9', '9:16', '1:1'] as const).map(r => (
                                        <button key={r} className="btn btn-ghost" style={{ padding: '8px 18px' }}
                                            onClick={async () => {
                                                const scriptData = state.qualityReview?.final_script || state.script;
                                                if (!scriptData) return;
                                                setVideoGenStatus('submitting');
                                                setVideoGenError('');
                                                setVideoGenResult(null);
                                                try {
                                                    const res = await fetch('/api/video-gen/submit', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            scriptContent: scriptData.full_narration || scriptData.main_body?.map(s => s.narration).join('\n') || '',
                                                            scriptType: selScriptType,
                                                            ratio: r,
                                                        }),
                                                    });
                                                    const data = await res.json();
                                                    if (!res.ok) {
                                                        setVideoGenStatus('error');
                                                        setVideoGenError(data.error || '提交失败');
                                                        return;
                                                    }
                                                    setVideoGenTaskId(data.taskId);
                                                    setVideoGenPrompt(data.prompt);
                                                    setVideoGenStatus('processing');
                                                    const poll = setInterval(async () => {
                                                        try {
                                                            const sr = await fetch('/api/video-gen/status', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ taskId: data.taskId }),
                                                            });
                                                            const sd = await sr.json();
                                                            if (sd.status === 'done') {
                                                                clearInterval(poll);
                                                                setVideoGenResult({ videoUrl: sd.videoUrl, coverUrl: sd.coverUrl });
                                                                setVideoGenStatus('done');
                                                            } else if (sd.status === 'failed') {
                                                                clearInterval(poll);
                                                                setVideoGenStatus('error');
                                                                setVideoGenError(sd.error || '生成失败');
                                                            }
                                                        } catch { /* continue polling */ }
                                                    }, 5000);
                                                    videoGenPollRef.current = poll;
                                                } catch (e: unknown) {
                                                    setVideoGenStatus('error');
                                                    setVideoGenError(e instanceof Error ? e.message : '请求失败');
                                                }
                                            }}
                                        >
                                            生成 {r} 视频
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {videoGenStatus === 'submitting' && (
                            <div style={{ textAlign: 'center', padding: '24px 0', color: '#64748b' }}>
                                <div style={{ marginBottom: 8, fontSize: '1.5rem' }}>🎬</div>
                                正在将脚本转化为电影级视频描述...
                            </div>
                        )}
                        {videoGenStatus === 'processing' && (
                            <div style={{ textAlign: 'center', padding: '24px 0' }}>
                                <div style={{ marginBottom: 8, fontSize: '1.5rem' }}>⏳</div>
                                <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#1e293b', marginBottom: 8 }}>即梦 AI 正在生成视频...</div>
                                <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: 14 }}>通常需要 30-60 秒，请耐心等待</div>
                                {videoGenPrompt && (
                                    <div style={{ fontSize: '0.78rem', color: '#64748b', background: '#f8fafc', padding: '10px 14px', borderRadius: 10, textAlign: 'left', lineHeight: 1.6 }}>
                                        <strong>视频描述：</strong>{videoGenPrompt}
                                    </div>
                                )}
                            </div>
                        )}
                        {videoGenStatus === 'done' && videoGenResult && (
                            <div style={{ textAlign: 'center', padding: '16px 0' }}>
                                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#16a34a', marginBottom: 14 }}>✅ 视频生成完成！</div>
                                {videoGenResult.videoUrl && (
                                    <video src={videoGenResult.videoUrl} controls
                                        style={{ width: '100%', maxWidth: 520, borderRadius: 14, margin: '0 auto', display: 'block' }} />
                                )}
                                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
                                    {videoGenResult.videoUrl && (
                                        <a href={videoGenResult.videoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ textDecoration: 'none' }}>
                                            下载视频
                                        </a>
                                    )}
                                    <button className="btn btn-ghost" onClick={() => { setVideoGenStatus('idle'); setVideoGenResult(null); }}>
                                        重新生成
                                    </button>
                                </div>
                            </div>
                        )}
                        {videoGenStatus === 'error' && (
                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                <div style={{ fontSize: '0.88rem', color: '#ef4444', marginBottom: 10 }}>❌ {videoGenError}</div>
                                <button className="btn btn-ghost" onClick={() => setVideoGenStatus('idle')}>重试</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Traffic Optimize Report */}
                {state.trafficReport && isStageDone('optimizing') && (
                    <TrafficReportDisplay report={state.trafficReport} />
                )}

                {/* Final Output — Video Mode */}
                {state.mode === 'video' && state.qualityReview && state.stage === 'done' && (
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title">
                                交付完成
                            </div>
                            <span className="score-circle" style={{ width: 48, height: 48, fontSize: '1.1rem', borderWidth: 2 }}>
                                {state.qualityReview.overall_score}
                            </span>
                        </div>

                        <div className="final-summary">{state.qualityReview.summary}</div>

                        <div className="review-checklist">
                            {state.qualityReview.checklist?.map((item, i) => (
                                <div key={i} className="checklist-item">
                                    <span className={`checklist-icon ${item.passed ? 'pass' : 'fail'}`}>
                                        {item.passed ? <Check size={14} /> : <X size={14} />}
                                    </span>
                                    <span>{item.item}：{item.note}</span>
                                </div>
                            ))}
                        </div>

                        <div className="final-actions">
                            <button className="btn btn-primary" onClick={exportScript}>
                                导出脚本
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    const script = state.qualityReview?.final_script || state.script;
                                    if (script?.full_narration) copyText(script.full_narration);
                                }}
                            >
                                复制口播稿
                            </button>
                            <button className="btn btn-secondary" onClick={shareResult} title="分享内容">
                                <Share2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 分享
                            </button>
                            <button className="btn btn-secondary" onClick={toggleResultFavorite} title="收藏">
                                <Star size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 收藏
                            </button>
                            <button className="btn btn-secondary" onClick={reset}>
                                新建脚本
                            </button>
                        </div>
                    </div>
                )}

                {/* Final Output — XHS Mode */}
                {state.mode === 'xhs' && state.xhsReview && state.stage === 'done' && (
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title">
                                图文笔记交付完成
                            </div>
                            <span className="score-circle" style={{ width: 48, height: 48, fontSize: '1.1rem', borderWidth: 2 }}>
                                {state.xhsReview.overall_score}
                            </span>
                        </div>

                        <div className="final-summary">{state.xhsReview.summary}</div>

                        <div className="review-checklist">
                            {state.xhsReview.checklist?.map((item, i) => (
                                <div key={i} className="checklist-item">
                                    <span className={`checklist-icon ${item.passed ? 'pass' : 'fail'}`}>
                                        {item.passed ? <Check size={14} /> : <X size={14} />}
                                    </span>
                                    <span>{item.item}：{item.note}</span>
                                </div>
                            ))}
                        </div>

                        {/* XHS Note Display */}
                        <XhsNoteDisplay note={state.xhsReview.final_note} />

                        <div className="final-actions">
                            <button className="btn btn-primary" onClick={() => {
                                const note = state.xhsReview?.final_note;
                                if (note?.caption) copyText(note.caption);
                            }}>
                                复制文案
                            </button>
                            <button className="btn btn-secondary" onClick={() => {
                                const note = state.xhsReview?.final_note;
                                if (note?.titles) copyText(note.titles.join('\n'));
                            }}>
                                复制标题
                            </button>
                            <button className="btn btn-secondary" onClick={shareResult} title="分享内容">
                                <Share2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 分享
                            </button>
                            <button className="btn btn-secondary" onClick={toggleResultFavorite} title="收藏">
                                <Star size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 收藏
                            </button>
                            <button className="btn btn-secondary" onClick={reset}>
                                新建笔记
                            </button>
                        </div>
                    </div>
                )}

                {/* Polish Result Display */}
                {state.mode === 'polish' && state.polishResult && state.stage === 'done' && (
                    <PolishResultDisplay result={state.polishResult} copyText={copyText} reset={reset} shareResult={shareResult} toggleFavorite={toggleResultFavorite} />
                )}

                {/* Platform Publishing Advice Panel */}
                {state.platformAdvice && state.stage === 'done' && (
                    <div className="result-card" style={{ marginTop: 16, borderLeft: '3px solid var(--accent)' }}>
                        <div className="section-header">
                            <div className="section-title">
                                {state.platformAdvice.platform} 发布建议
                            </div>
                        </div>
                        <div style={{ display: 'grid', gap: 16 }}>
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--fg)' }}>最佳发布时间</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {state.platformAdvice.best_publish_time?.map((t, i) => (
                                        <span key={i} style={{ background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: 6, fontSize: '0.82rem' }}>{t}</span>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--fg)' }}>标签策略</div>
                                <div style={{ fontSize: '0.88rem', color: 'var(--fg-secondary)', marginBottom: 6 }}>{state.platformAdvice.hashtag_strategy}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {state.platformAdvice.recommended_hashtags?.map((tag, i) => (
                                        <span key={i} className="template-tag" style={{ fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => copyText(tag)}>{tag}</span>
                                    ))}
                                </div>
                            </div>
                            {state.platformAdvice.interaction_guide?.length > 0 && (
                                <div>
                                    <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--fg)' }}>互动引导话术</div>
                                    {state.platformAdvice.interaction_guide.map((tip, i) => (
                                        <div key={i} style={{ fontSize: '0.85rem', color: 'var(--fg-secondary)', padding: '3px 0', cursor: 'pointer' }} onClick={() => copyText(tip)}>
                                            {i + 1}. {tip}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {state.platformAdvice.algorithm_tips?.length > 0 && (
                                <div>
                                    <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--fg)' }}>算法优化建议</div>
                                    {state.platformAdvice.algorithm_tips.map((tip, i) => (
                                        <div key={i} style={{ fontSize: '0.85rem', color: 'var(--fg-secondary)', padding: '3px 0' }}>
                                            {i + 1}. {tip}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {state.platformAdvice.content_warnings?.length > 0 && (
                                <div>
                                    <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--error)' }}>注意事项</div>
                                    {state.platformAdvice.content_warnings.map((w, i) => (
                                        <div key={i} style={{ fontSize: '0.85rem', color: 'var(--fg-secondary)', padding: '3px 0' }}>
                                            {i + 1}. {w}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {state.platformAdvice.distribution_strategy && (
                                <div>
                                    <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--fg)' }}>分发策略</div>
                                    <div style={{ fontSize: '0.88rem', color: 'var(--fg-secondary)' }}>{state.platformAdvice.distribution_strategy}</div>
                                </div>
                            )}
                        </div>
                    </div>
                )}



            </div>{/* end workspace-scroll-container */}

            {/* Fixed top-right Multi-Agent toggle */}
            <div className="workspace-agent-toggle">
                <label className="toggle-switch">
                    <input type="checkbox" checked={useMultiAgent} onChange={e => setUseMultiAgent(e.target.checked)} />
                    <span className="toggle-slider" />
                </label>
                <span className={`toggle-label ${useMultiAgent ? 'active' : ''}`}>
                    {useMultiAgent ? 'Multi-Agent' : 'Workflow'}
                </span>
            </div>

            {/* Bottom Input Bar — Doubao style */}
            <div className="bottom-input-bar">
                <div className="bottom-input-wrapper">
                    <textarea
                        className="bottom-textarea"
                        value={state.userInput}
                        onChange={e => setState(prev => ({ ...prev, userInput: e.target.value }))}
                        placeholder={
                            state.mode === 'polish' ? '粘贴你要润色的内容...' :
                                state.mode === 'imitate' ? '粘贴链接或要模仿的内容...' :
                                    '描述你的创作需求...'
                        }
                        rows={3}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey && state.userInput.trim()) {
                                e.preventDefault();
                                if (state.mode === 'polish') handlePolish();
                                else if (state.mode === 'imitate') handleImitate();
                                else handleSubmit();
                            }
                        }}
                    />
                    {/* Attach & Send — bottom-right of textarea area */}
                    <div className="textarea-actions">
                        <button
                            className="input-attach-btn"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                        >
                            <Paperclip size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> {uploading ? '解析中...' : '添加文件'}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.docx,.xlsx,.xls,.pptx,.ppt,.png,.jpg,.jpeg,.webp,.gif"
                            style={{ display: 'none' }}
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploading(true);
                                try {
                                    const formData = new FormData();
                                    formData.append('file', file);
                                    const res = await fetch('/api/upload', { method: 'POST', body: formData });
                                    const data = await res.json();
                                    if (res.ok) {
                                        setUploadedFiles(prev => [...prev, {
                                            id: `file-${Date.now()}`,
                                            filename: data.filename,
                                            type: data.type,
                                            content: data.content,
                                            preview: data.preview,
                                        }]);
                                    } else {
                                        alert(data.error || '文件解析失败');
                                    }
                                } catch {
                                    alert('文件上传失败');
                                } finally {
                                    setUploading(false);
                                    e.target.value = '';
                                }
                            }}
                        />
                        {uploadedFiles.length > 0 && (
                            <div className="input-file-tags">
                                {uploadedFiles.map(f => (
                                    <span key={f.id} className="file-tag" title={f.preview}>
                                        <span className="file-tag-name">{f.filename}</span>
                                        <button className="file-tag-remove" onClick={() => setUploadedFiles(prev => prev.filter(x => x.id !== f.id))}>&#x2715;</button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <button
                            className="bottom-send-btn"
                            onClick={() => {
                                if (state.mode === 'polish') handlePolish();
                                else if (state.mode === 'imitate') handleImitate();
                                else handleSubmit();
                            }}
                            disabled={state.mode === 'polish' ? state.userInput.trim().length < 10 : !state.userInput.trim()}
                        >
                            <Send size={16} />
                        </button>
                    </div>
                    <div className="bottom-input-footer">
                        <div className="bottom-input-row">
                            {state.mode !== 'polish' && state.mode !== 'imitate' && (
                                <>
                                    <button
                                        className={`input-attach-btn ${showAdvancedConfig ? 'active' : ''}`}
                                        onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                                    >
                                        <Settings size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 高级
                                    </button>
                                    <select className="input-mini-select" value={selAudienceAge} onChange={e => setSelAudienceAge(e.target.value)} title="受众年龄">
                                        {AUDIENCE_AGE_OPTIONS.map(o => <option key={o} value={o}>{o === '不限' ? '年龄' : o}</option>)}
                                    </select>
                                    <select className="input-mini-select" value={selAudienceGender} onChange={e => setSelAudienceGender(e.target.value)} title="受众性别">
                                        {AUDIENCE_GENDER_OPTIONS.map(o => <option key={o} value={o}>{o === '不限' ? '性别' : o}</option>)}
                                    </select>
                                    {state.mode !== 'xhs' && (
                                        <select className="input-mini-select" value={selDuration} onChange={e => setSelDuration(e.target.value as VideoDuration)} title="视频时长">
                                            {DURATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    )}
                                    {(state.mode === 'douyin' || state.mode === 'video') && (
                                        <select className="input-mini-select" value={selScriptType} onChange={e => setSelScriptType(e.target.value)} title="脚本类型" style={{ minWidth: 100 }}>
                                            {SCRIPT_TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    )}
                                    <select className="input-mini-select" value={selTone} onChange={e => setSelTone(e.target.value as Tone)} title="语气风格">
                                        {TONE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                    <select className="input-mini-select" value={selIndustry} onChange={e => setSelIndustry(e.target.value)} title="所属行业">
                                        {INDUSTRY_OPTIONS.map(o => <option key={o} value={o}>{o === '不限' ? '行业' : o}</option>)}
                                    </select>
                                </>
                            )}
                            {state.mode === 'polish' && (
                                <>
                                    {POLISH_PLATFORMS.map(p => (
                                        <button
                                            key={p}
                                            className={`input-mini-chip ${polishPlatform === p ? 'active' : ''}`}
                                            onClick={() => setPolishPlatform(p)}
                                        >{p}</button>
                                    ))}
                                </>
                            )}
                            {state.mode === 'imitate' && (
                                <>
                                    {['小红书', '抖音', '视频号'].map(p => (
                                        <button
                                            key={p}
                                            className={`input-mini-chip ${imitatePlatform === p ? 'active' : ''}`}
                                            onClick={() => setImitatePlatform(p)}
                                        >{p}</button>
                                    ))}
                                </>
                            )}
                        </div>
                        {/* Advanced config - full width panel */}
                        {showAdvancedConfig && state.mode !== 'polish' && state.mode !== 'imitate' && (
                            <div className="input-advanced-panel">
                                <div className="config-row">
                                    <div className="config-field-compact">
                                        <label>品牌/产品信息</label>
                                        <input type="text" value={advBrandInfo} onChange={e => setAdvBrandInfo(e.target.value)} placeholder="例如：XX 护肤品" />
                                    </div>
                                    <div className="config-field-compact">
                                        <label>核心卖点</label>
                                        <input type="text" value={advSellingPoint} onChange={e => setAdvSellingPoint(e.target.value)} placeholder="产品最独特的价值点" />
                                    </div>
                                </div>
                                <div className="config-row">
                                    <div className="config-field-compact">
                                        <label>目标痛点</label>
                                        <input type="text" value={advPainPoint} onChange={e => setAdvPainPoint(e.target.value)} placeholder="用户最关心的问题" />
                                    </div>
                                    <div className="config-field-compact">
                                        <label>参考链接</label>
                                        <input type="text" value={advReferenceLinks} onChange={e => setAdvReferenceLinks(e.target.value)} placeholder="竞品或灵感来源 URL" />
                                    </div>
                                </div>
                                <div className="config-row">
                                    <div className="config-field-compact full-width">
                                        <label>个人 IP 风格</label>
                                        <input type="text" value={advPersonalStyle} onChange={e => setAdvPersonalStyle(e.target.value)} placeholder="例如：温柔知性风、毒舌吐槽风" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="bottom-toolbar">
                    {([
                        ['douyin', '抖音'],
                        ['video', '视频号'],
                        ['xhs', '小红书'],
                        ['polish', '润色'],
                        ['imitate', '模仿'],
                    ] as [string, string][]).map(([key, label]) => (
                        <button
                            key={key}
                            className={`bottom-tool-btn ${state.mode === key ? 'active' : ''}`}
                            onClick={() => { setState(initialState(key as CreationMode)); setWorkflowLogs([]); setActiveTaskId(null); }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Toast */}
            <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
        </div>
    );
}

/* ============ SUB-COMPONENTS ============ */

function ScriptDisplay({
    script,
    expandedModules,
    toggleModule,
    copyText,
}: {
    script: Script;
    expandedModules: Set<string>;
    toggleModule: (key: string) => void;
    copyText: (text: string) => void;
}) {
    return (
        <div className="section-card">
            <div className="section-header">
                <div className="section-title">
                    脚本内容
                </div>
                <button className="btn btn-ghost" onClick={() => copyText(script.full_narration)}>
                    复制全文
                </button>
            </div>

            {/* Titles */}
            <div className="script-module">
                <div className="script-module-header" onClick={() => toggleModule('titles')}>
                    <span className="module-title">视频标题（备选）</span>
                    <span className={`module-toggle ${expandedModules.has('titles') ? 'open' : ''}`}><ChevronDown size={14} /></span>
                </div>
                {expandedModules.has('titles') && (
                    <div className="script-module-body">
                        {script.titles?.map((t, i) => (
                            <div key={i} className="title-option">
                                <span className="number">{i + 1}.</span>
                                <span>{t}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Cover texts */}
            <div className="script-module">
                <div className="script-module-header" onClick={() => toggleModule('cover')}>
                    <span className="module-title">封面文案</span>
                    <span className={`module-toggle ${expandedModules.has('cover') ? 'open' : ''}`}><ChevronDown size={14} /></span>
                </div>
                {expandedModules.has('cover') && (
                    <div className="script-module-body">
                        {script.cover_texts?.map((t, i) => (
                            <div key={i} className="title-option">
                                <span className="number">{i + 1}.</span>
                                <span>{t}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 3-Second Hook - Highlighted */}
            <div className="hook-highlight">
                <span className="hook-badge">开播三秒钩子 · {script.hook?.type}</span>
                <div className="hook-content">{script.hook?.content}</div>
                <div className="hook-visual">画面 {script.hook?.visual}</div>
            </div>

            {/* Golden Quotes */}
            {script.golden_quotes && script.golden_quotes.length > 0 && (
                <div className="script-module">
                    <div className="script-module-header" onClick={() => toggleModule('golden_quotes')}>
                        <span className="module-title">金句</span>
                        <span className={`module-toggle ${expandedModules.has('golden_quotes') ? 'open' : ''}`}><ChevronDown size={14} /></span>
                    </div>
                    {expandedModules.has('golden_quotes') && (
                        <div className="script-module-body">
                            {script.golden_quotes.map((q, i) => (
                                <div key={i} className="golden-quote">{q}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Main Body */}
            <div className="script-module">
                <div className="script-module-header" onClick={() => toggleModule('main_body')}>
                    <span className="module-title">内容分镜</span>
                    <span className={`module-toggle ${expandedModules.has('main_body') ? 'open' : ''}`}><ChevronDown size={14} /></span>
                </div>
                {expandedModules.has('main_body') && (
                    <div className="script-module-body">
                        {script.main_body?.map((seg, i) => (
                            <div key={i} className="segment-item">
                                <div className="segment-time">{seg.time_range}</div>
                                <div className="segment-narration">{seg.narration}</div>
                                <div className="segment-visual">画面 {seg.visual}</div>
                                {seg.note && <div className="segment-visual">备注 {seg.note}</div>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Interaction Points */}
            <div className="script-module">
                <div className="script-module-header" onClick={() => toggleModule('interactions')}>
                    <span className="module-title">互动设计</span>
                    <span className={`module-toggle ${expandedModules.has('interactions') ? 'open' : ''}`}><ChevronDown size={14} /></span>
                </div>
                {expandedModules.has('interactions') && (
                    <div className="script-module-body">
                        {script.interaction_points?.map((p, i) => (
                            <div key={i} className="interaction-item">
                                <span className="interaction-icon">•</span>
                                <div className="interaction-detail">
                                    <div className="interaction-position">{p.position} · {p.strategy}</div>
                                    <div className="interaction-design">{p.design}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Ending */}
            <div className="script-module">
                <div className="script-module-header" onClick={() => toggleModule('ending')}>
                    <span className="module-title">结尾设计 · {script.ending?.type}</span>
                    <span className={`module-toggle ${expandedModules.has('ending') ? 'open' : ''}`}><ChevronDown size={14} /></span>
                </div>
                {expandedModules.has('ending') && (
                    <div className="script-module-body">
                        <div className="segment-item">
                            <div className="segment-narration">{script.ending?.content}</div>
                            <div className="segment-visual" style={{ color: 'var(--accent)' }}>CTA：{script.ending?.cta}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Full Narration */}
            <div className="script-module">
                <div className="script-module-header" onClick={() => toggleModule('full_narration')}>
                    <span className="module-title">完整口播稿</span>
                    <span className={`module-toggle ${expandedModules.has('full_narration') ? 'open' : ''}`}><ChevronDown size={14} /></span>
                </div>
                {expandedModules.has('full_narration') && (
                    <div className="script-module-body">
                        <div className="full-narration">{script.full_narration}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-md)', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                            <span>字数：{script.word_count}</span>
                            <span>预估时长：{script.estimated_duration}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Cover Suggestions */}
            {script.cover_suggestions && script.cover_suggestions.length > 0 && (
                <div className="script-module">
                    <div className="script-module-header" onClick={() => toggleModule('covers')}>
                        <span className="module-title">封面设计方案</span>
                        <span className={`module-toggle ${expandedModules.has('covers') ? 'open' : ''}`}><ChevronDown size={14} /></span>
                    </div>
                    {expandedModules.has('covers') && (
                        <div className="script-module-body">
                            <CoverSuggestionsDisplay suggestions={script.cover_suggestions} />
                        </div>
                    )}
                </div>
            )}

            {/* Extra info */}
            {(script.bgm_suggestion || script.shooting_tips?.length) && (
                <div className="script-module">
                    <div className="script-module-header" onClick={() => toggleModule('extras')}>
                        <span className="module-title">拍摄建议 & BGM</span>
                        <span className={`module-toggle ${expandedModules.has('extras') ? 'open' : ''}`}><ChevronDown size={14} /></span>
                    </div>
                    {expandedModules.has('extras') && (
                        <div className="script-module-body">
                            {script.bgm_suggestion && (
                                <div className="segment-item">
                                    <div className="segment-time">BGM 建议</div>
                                    <div className="segment-narration">{script.bgm_suggestion}</div>
                                </div>
                            )}
                            {script.shooting_tips?.map((tip, i) => (
                                <div key={i} className="segment-item">
                                    <div className="segment-time">建议 {i + 1}</div>
                                    <div className="segment-narration">{tip}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ---- Cover Design Configs per index ---- */
const COVER_THEMES = [
    {
        bg: 'linear-gradient(160deg, #0f0c29 0%, #302b63 40%, #24243e 100%)',
        accent: '#f59e0b',
        glow: 'radial-gradient(circle at 30% 70%, rgba(245,158,11,0.35) 0%, transparent 55%)',
        decorColor: 'rgba(245,158,11,0.12)',
        badge: '文字冲击型',
    },
    {
        bg: 'linear-gradient(160deg, #1a0a2e 0%, #6b21a8 45%, #3b0764 100%)',
        accent: '#c084fc',
        glow: 'radial-gradient(circle at 70% 30%, rgba(192,132,252,0.4) 0%, transparent 55%)',
        decorColor: 'rgba(192,132,252,0.15)',
        badge: '人物情绪型',
    },
    {
        bg: 'linear-gradient(160deg, #001d3d 0%, #003566 35%, #001845 100%)',
        accent: '#06d6a0',
        glow: 'radial-gradient(circle at 50% 80%, rgba(6,214,160,0.3) 0%, transparent 55%)',
        decorColor: 'rgba(6,214,160,0.1)',
        badge: '场景悬念型',
    },
];

function CoverSuggestionsDisplay({ suggestions }: { suggestions: CoverSuggestion[] }) {
    return (
        <div className="cover-grid">
            {suggestions.map((cover, i) => {
                const theme = COVER_THEMES[i % COVER_THEMES.length];
                return (
                    <div key={i} className="cover-card">
                        <div style={{
                            aspectRatio: '3/4',
                            background: theme.bg,
                            display: 'flex',
                            flexDirection: 'column' as const,
                            justifyContent: 'center',
                            alignItems: 'center',
                            padding: '32px 20px',
                            textAlign: 'center' as const,
                            position: 'relative' as const,
                            overflow: 'hidden',
                            borderRadius: '12px',
                        }}>
                            {/* Glow effect */}
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                background: theme.glow,
                                pointerEvents: 'none',
                            }} />

                            {/* Large decorative circle */}
                            <div style={{
                                position: 'absolute',
                                top: '-30%',
                                right: '-25%',
                                width: '280px',
                                height: '280px',
                                borderRadius: '50%',
                                background: theme.decorColor,
                                filter: 'blur(2px)',
                            }} />
                            <div style={{
                                position: 'absolute',
                                bottom: '-20%',
                                left: '-15%',
                                width: '200px',
                                height: '200px',
                                borderRadius: '50%',
                                background: theme.decorColor,
                                filter: 'blur(2px)',
                            }} />

                            {/* Geometric accent lines */}
                            <div style={{
                                position: 'absolute',
                                top: '20px',
                                left: '20px',
                                width: '40px',
                                height: '3px',
                                background: theme.accent,
                                borderRadius: '2px',
                                boxShadow: `0 0 12px ${theme.accent}`,
                            }} />
                            <div style={{
                                position: 'absolute',
                                top: '20px',
                                left: '20px',
                                width: '3px',
                                height: '40px',
                                background: theme.accent,
                                borderRadius: '2px',
                                boxShadow: `0 0 12px ${theme.accent}`,
                            }} />
                            <div style={{
                                position: 'absolute',
                                bottom: '20px',
                                right: '20px',
                                width: '40px',
                                height: '3px',
                                background: theme.accent,
                                borderRadius: '2px',
                                boxShadow: `0 0 12px ${theme.accent}`,
                            }} />
                            <div style={{
                                position: 'absolute',
                                bottom: '20px',
                                right: '20px',
                                width: '3px',
                                height: '40px',
                                background: theme.accent,
                                borderRadius: '2px',
                                boxShadow: `0 0 12px ${theme.accent}`,
                            }} />

                            {/* Style badge */}
                            <div style={{
                                position: 'absolute',
                                top: '18px',
                                right: '18px',
                                fontSize: '0.6rem',
                                letterSpacing: '0.15em',
                                textTransform: 'uppercase' as const,
                                color: theme.accent,
                                background: 'rgba(0,0,0,0.4)',
                                backdropFilter: 'blur(8px)',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                border: `1px solid ${theme.accent}40`,
                            }}>
                                {theme.badge}
                            </div>

                            {/* Main title */}
                            <div style={{
                                position: 'relative',
                                zIndex: 2,
                                fontSize: '1.6rem',
                                fontWeight: 900,
                                color: '#ffffff',
                                lineHeight: 1.3,
                                marginBottom: '16px',
                                textShadow: `0 0 40px ${theme.accent}60, 0 4px 20px rgba(0,0,0,0.5)`,
                                maxWidth: '92%',
                                letterSpacing: '0.02em',
                            }}>
                                {cover.title_text}
                            </div>

                            {/* Accent divider */}
                            <div style={{
                                width: '50px',
                                height: '3px',
                                background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
                                marginBottom: '14px',
                                borderRadius: '2px',
                                boxShadow: `0 0 15px ${theme.accent}80`,
                            }} />

                            {/* Subtitle */}
                            <div style={{
                                position: 'relative',
                                zIndex: 2,
                                fontSize: '0.82rem',
                                color: 'rgba(255,255,255,0.75)',
                                lineHeight: 1.6,
                                maxWidth: '88%',
                                letterSpacing: '0.03em',
                            }}>
                                {cover.subtitle_text}
                            </div>
                        </div>
                        <div className="cover-caption">
                            <div className="cover-style">方案 {i + 1} · {cover.style}</div>
                            <div className="cover-desc">{cover.mood}</div>
                            <div className="cover-meta">
                                <span>配色：{cover.color_scheme}</span>
                                <span>布局：{cover.layout}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function TrafficReportDisplay({ report }: { report: TrafficReport }) {
    const scoreClass = report.overall_score >= 80 ? 'high' : report.overall_score >= 60 ? 'medium' : 'low';

    return (
        <div className="section-card">
            <div className="section-header">
                <div className="section-title">
                    流量优化报告
                </div>
            </div>

            <div className="optimize-score-hero">
                <div className={`score-circle ${scoreClass}`}>{report.overall_score}</div>
                <div className="score-label">流量潜力综合评分</div>
            </div>

            <div className="dimension-grid">
                {report.dimensions?.map((dim, i) => (
                    <div key={i} className="dimension-card">
                        <div className="dimension-header">
                            <span className="dimension-name">{dim.name}</span>
                            <span className="dimension-score">{dim.score}</span>
                        </div>
                        <div className="dimension-analysis">{dim.analysis}</div>
                        <ul className="suggestion-list">
                            {dim.suggestions?.map((s, j) => (
                                <li key={j}>{s}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            {report.red_flags && report.red_flags.length > 0 && (
                <div className="red-flags">
                    <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-md)', color: 'var(--danger)' }}>红线警告</h3>
                    {report.red_flags.map((flag, i) => (
                        <div key={i} className="red-flag-item">
                            <span className="red-flag-icon">!</span>
                            <div className="red-flag-detail">
                                <div className="red-flag-type">{flag.type}</div>
                                <div className="red-flag-content">{flag.content}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: 4 }}>建议：{flag.suggestion}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ============ XHS NOTE DISPLAY ============ */
function XhsNoteDisplay({ note }: { note: XhsNote }) {
    if (!note) return null;

    return (
        <div className="xhs-note-display">
            {/* Titles */}
            <div className="xhs-section">
                <div className="xhs-section-title">备选标题</div>
                <div className="xhs-titles">
                    {note.titles?.map((t, i) => (
                        <div key={i} className="xhs-title-option">
                            <span className="xhs-title-num">#{i + 1}</span>
                            <span>{t}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Cover */}
            {note.cover_image_desc && (
                <div className="xhs-section">
                    <div className="xhs-section-title">封面设计</div>
                    <div className="xhs-cover-desc">{note.cover_image_desc}</div>
                </div>
            )}

            {/* Slides */}
            <div className="xhs-section">
                <div className="xhs-section-title">图文卡片（{note.content_slides?.length || 0} 张）</div>
                <div className="xhs-slides-grid">
                    {note.content_slides?.map((slide, i) => (
                        <div key={i} className="xhs-slide-card">
                            {slide.image_url && (
                                <div className="xhs-slide-image">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={slide.image_url} alt={slide.image_description || `Slide ${slide.page}`} />
                                </div>
                            )}
                            <div className="xhs-slide-header">
                                <span className="xhs-slide-num">第 {slide.page} 张</span>
                            </div>
                            <div className="xhs-slide-body">
                                <div className="xhs-slide-text-overlay">{slide.text_overlay}</div>
                                {!slide.image_url && (
                                    <div className="xhs-slide-image-desc">配图：{slide.image_description}</div>
                                )}
                            </div>
                            <div className="xhs-slide-layout">排版：{slide.layout_suggestion}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Caption */}
            <div className="xhs-section">
                <div className="xhs-section-title">正文文案</div>
                <div className="xhs-caption">{note.caption}</div>
            </div>

            {/* Hashtags */}
            {note.hashtags?.length > 0 && (
                <div className="xhs-section">
                    <div className="xhs-section-title">话题标签</div>
                    <div className="xhs-hashtags">
                        {note.hashtags.map((tag, i) => (
                            <span key={i} className="xhs-hashtag">#{tag}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Golden Quotes */}
            {note.golden_quotes && note.golden_quotes.length > 0 && (
                <div className="xhs-section">
                    <div className="xhs-section-title">金句</div>
                    <div className="xhs-quotes">
                        {note.golden_quotes.map((q, i) => (
                            <div key={i} className="xhs-quote">「{q}」</div>
                        ))}
                    </div>
                </div>
            )}

            {/* SEO Keywords */}
            {note.seo_keywords?.length > 0 && (
                <div className="xhs-section">
                    <div className="xhs-section-title">SEO 关键词</div>
                    <div className="xhs-hashtags">
                        {note.seo_keywords.map((kw, i) => (
                            <span key={i} className="xhs-keyword">{kw}</span>
                        ))}
                    </div>
                </div>
            )}

            {/* Engagement Tips */}
            {note.engagement_tips?.length > 0 && (
                <div className="xhs-section">
                    <div className="xhs-section-title">互动引导建议</div>
                    <div className="xhs-tips">
                        {note.engagement_tips.map((tip, i) => (
                            <div key={i} className="xhs-tip">{tip}</div>
                        ))}
                    </div>
                </div>
            )}

            {/* Meta */}
            <div className="xhs-meta">
                {note.estimated_reading && <span>预计阅读 {note.estimated_reading}</span>}
            </div>
        </div>
    );
}

/* ============ POLISH RESULT DISPLAY ============ */
function PolishResultDisplay({
    result,
    copyText,
    reset,
    shareResult,
    toggleFavorite,
}: {
    result: PolishResult;
    copyText: (text: string) => void;
    reset: () => void;
    shareResult: () => void;
    toggleFavorite: () => void;
}) {
    const [showOriginal, setShowOriginal] = useState(false);

    const improvement = result.score.after - result.score.before;
    const improvementColor = improvement >= 20 ? 'var(--success)' : improvement >= 10 ? '#f59e0b' : 'var(--text-secondary)';

    return (
        <div className="section-card">
            {/* Header with score */}
            <div className="section-header">
                <div className="section-title">
                    润色完成
                </div>
                <div className="polish-scores">
                    <span className="polish-score-before">{result.score.before}</span>
                    <span className="polish-score-arrow"><ArrowRight size={16} /></span>
                    <span className="score-circle" style={{ width: 48, height: 48, fontSize: '1.1rem', borderWidth: 2 }}>
                        {result.score.after}
                    </span>
                    <span className="polish-improvement" style={{ color: improvementColor }}>
                        +{improvement} 分
                    </span>
                </div>
            </div>

            <div className="polish-summary">{result.summary}</div>

            {/* Polished content */}
            <div className="polish-content-section">
                <div className="polish-content-header">
                    <span className="polish-content-title">优化后文案</span>
                    <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => copyText(result.polished)}>
                        复制
                    </button>
                </div>
                <div className="polish-content-body">
                    {result.polished}
                </div>
            </div>

            {/* Toggle original */}
            <button
                className="advanced-config-toggle"
                onClick={() => setShowOriginal(!showOriginal)}
                style={{ marginTop: 12 }}
            >
                <span className="toggle-arrow" style={{ transform: showOriginal ? 'rotate(90deg)' : '' }}><ChevronRight size={14} /></span>
                查看原始内容
                <span className="toggle-line" />
            </button>
            {showOriginal && (
                <div className="polish-original">
                    {result.original}
                </div>
            )}

            {/* Changes list */}
            <div className="polish-changes">
                <div className="polish-changes-title">改动详情（{result.changes.length} 处）</div>
                {result.changes.map((change, i) => (
                    <div key={i} className="polish-change-item">
                        <div className="polish-change-badge">{change.type}</div>
                        <div className="polish-change-before">
                            <span className="polish-change-label">原文：</span>{change.before}
                        </div>
                        <div className="polish-change-after">
                            <span className="polish-change-label">改为：</span>{change.after}
                        </div>
                        <div className="polish-change-reason">{change.reason}</div>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="final-actions">
                <button className="btn btn-primary" onClick={() => copyText(result.polished)}>
                    复制优化文案
                </button>
                <button className="btn btn-secondary" onClick={shareResult} title="分享内容">
                    <Share2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 分享
                </button>
                <button className="btn btn-secondary" onClick={toggleFavorite} title="收藏">
                    <Star size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> 收藏
                </button>
                <button className="btn btn-secondary" onClick={reset}>
                    继续润色
                </button>
            </div>
        </div>
    );
}

export default function WorkspacePage() {
    return (
        <Suspense>
            <WorkspaceInner />
        </Suspense>
    );
}
