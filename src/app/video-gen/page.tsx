'use client';

import { useState } from 'react';
import {
    Film, Sparkles, Play, Loader2, Download, RotateCcw,
    Monitor, Smartphone, Square, Clock,
} from 'lucide-react';

type Ratio = '16:9' | '9:16' | '1:1';
type Status = 'idle' | 'submitting' | 'processing' | 'done' | 'error';

const RATIO_OPTIONS: { value: Ratio; label: string; icon: React.ReactNode }[] = [
    { value: '16:9', label: '横屏 16:9', icon: <Monitor size={16} /> },
    { value: '9:16', label: '竖屏 9:16', icon: <Smartphone size={16} /> },
    { value: '1:1', label: '方形 1:1', icon: <Square size={16} /> },
];

export default function VideoGenPage() {
    const [mode, setMode] = useState<'prompt' | 'script'>('prompt');
    const [prompt, setPrompt] = useState('');
    const [scriptContent, setScriptContent] = useState('');
    const [scriptType, setScriptType] = useState('画外音解说');
    const [ratio, setRatio] = useState<Ratio>('16:9');
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState('');
    const [taskId, setTaskId] = useState('');
    const [result, setResult] = useState<{ videoUrl: string; coverUrl: string } | null>(null);
    const [generatedPrompt, setGeneratedPrompt] = useState('');

    const handleGenerate = async () => {
        const input = mode === 'prompt' ? prompt.trim() : scriptContent.trim();
        if (!input) return;

        setStatus('submitting');
        setError('');
        setResult(null);
        setGeneratedPrompt('');

        try {
            const body = mode === 'prompt'
                ? { prompt: input, ratio }
                : { scriptContent: input, scriptType, ratio };

            const endpoint = mode === 'prompt' ? '/api/video-gen/direct' : '/api/video-gen/submit';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) {
                setStatus('error');
                setError(data.error || '提交失败');
                return;
            }

            setTaskId(data.taskId);
            if (data.prompt) setGeneratedPrompt(data.prompt);
            setStatus('processing');

            // Poll for result
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
                        setResult({ videoUrl: sd.videoUrl, coverUrl: sd.coverUrl });
                        setStatus('done');
                    } else if (sd.status === 'failed') {
                        clearInterval(poll);
                        setStatus('error');
                        setError(sd.error || '视频生成失败');
                    }
                } catch {
                    clearInterval(poll);
                    setStatus('error');
                    setError('查询状态失败');
                }
            }, 5000);
        } catch {
            setStatus('error');
            setError('网络错误');
        }
    };

    const reset = () => {
        setStatus('idle');
        setError('');
        setResult(null);
        setTaskId('');
        setGeneratedPrompt('');
    };

    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 16px' }}>
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <Film size={26} style={{ color: '#8b5cf6' }} /> AI 视频生成
                </h1>
                <p style={{ fontSize: '0.88rem', color: '#64748b' }}>
                    输入创意描述或粘贴脚本内容，即梦 AI 智能生成高质量短视频
                </p>
            </div>

            {/* Mode Tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: '#f1f5f9', borderRadius: 12, padding: 4 }}>
                {[
                    { key: 'prompt', label: '✨ 直接描述', desc: '用文字描述你想生成的视频画面' },
                    { key: 'script', label: '📄 提供脚本', desc: '粘贴脚本内容，AI 自动提取画面' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setMode(tab.key as 'prompt' | 'script')}
                        style={{
                            flex: 1, padding: '12px 16px', borderRadius: 10, border: 'none',
                            background: mode === tab.key ? 'white' : 'transparent',
                            boxShadow: mode === tab.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                            cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                        }}
                    >
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: mode === tab.key ? '#1e293b' : '#94a3b8' }}>
                            {tab.label}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2 }}>{tab.desc}</div>
                    </button>
                ))}
            </div>

            {/* Input Area */}
            <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0', marginBottom: 20 }}>
                {mode === 'prompt' ? (
                    <>
                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 8 }}>
                            <Sparkles size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                            视频画面描述
                        </label>
                        <textarea
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="例如：清晨的城市天际线，太阳缓缓升起，金色阳光洒在摩天大楼上，鸟群飞过，电影质感，慢镜头..."
                            rows={5}
                            style={{
                                width: '100%', padding: 14, borderRadius: 12,
                                border: '2px solid #e2e8f0', fontSize: '0.88rem',
                                resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                                lineHeight: 1.6, boxSizing: 'border-box',
                            }}
                        />
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 6 }}>
                            💡 描述越详细画面效果越好，可包含：场景、光线、镜头运动、风格等
                        </div>
                    </>
                ) : (
                    <>
                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: 8 }}>
                            📄 脚本内容
                        </label>
                        <textarea
                            value={scriptContent}
                            onChange={e => setScriptContent(e.target.value)}
                            placeholder="粘贴你的视频脚本内容，AI 会自动从中提取最具画面感的场景来生成视频..."
                            rows={8}
                            style={{
                                width: '100%', padding: 14, borderRadius: 12,
                                border: '2px solid #e2e8f0', fontSize: '0.88rem',
                                resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                                lineHeight: 1.6, boxSizing: 'border-box',
                            }}
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: '30px' }}>脚本类型：</span>
                            {['画外音解说', '画面故事', '情景再现', '产品展示'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setScriptType(t)}
                                    style={{
                                        padding: '4px 14px', borderRadius: 20, fontSize: '0.78rem',
                                        border: '1px solid', cursor: 'pointer',
                                        borderColor: scriptType === t ? '#8b5cf6' : '#e2e8f0',
                                        background: scriptType === t ? 'rgba(139,92,246,0.08)' : 'white',
                                        color: scriptType === t ? '#8b5cf6' : '#64748b',
                                        fontWeight: scriptType === t ? 600 : 400,
                                    }}
                                >{t}</button>
                            ))}
                        </div>
                    </>
                )}

                {/* Ratio + Generate */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {RATIO_OPTIONS.map(r => (
                            <button
                                key={r.value}
                                onClick={() => setRatio(r.value)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px',
                                    borderRadius: 10, fontSize: '0.78rem', cursor: 'pointer',
                                    border: '1px solid',
                                    borderColor: ratio === r.value ? '#8b5cf6' : '#e2e8f0',
                                    background: ratio === r.value ? 'rgba(139,92,246,0.08)' : 'white',
                                    color: ratio === r.value ? '#8b5cf6' : '#64748b',
                                    fontWeight: ratio === r.value ? 600 : 400,
                                }}
                            >
                                {r.icon} {r.label}
                            </button>
                        ))}
                    </div>
                    <div style={{ flex: 1 }} />
                    <button
                        onClick={handleGenerate}
                        disabled={status !== 'idle' || !(mode === 'prompt' ? prompt.trim() : scriptContent.trim())}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px',
                            borderRadius: 12, border: 'none', fontWeight: 700, fontSize: '0.92rem',
                            background: status !== 'idle' || !(mode === 'prompt' ? prompt.trim() : scriptContent.trim())
                                ? '#e2e8f0' : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                            color: 'white', cursor: status !== 'idle' ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        <Play size={16} /> 生成视频
                    </button>
                </div>
            </div>

            {/* Status / Result */}
            {status !== 'idle' && (
                <div style={{ background: 'white', borderRadius: 16, padding: 24, border: '1px solid #e2e8f0' }}>
                    {status === 'submitting' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#8b5cf6', justifyContent: 'center', padding: 40 }}>
                            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                            <span style={{ fontWeight: 600 }}>正在提交视频生成任务...</span>
                        </div>
                    )}
                    {status === 'processing' && (
                        <div style={{ textAlign: 'center', padding: 40 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', color: '#8b5cf6', marginBottom: 12 }}>
                                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                                <span style={{ fontWeight: 700 }}>AI 正在生成视频...</span>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: 8 }}>
                                <Clock size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                                通常需要 1-3 分钟，请耐心等待
                            </div>
                            {generatedPrompt && (
                                <div style={{ marginTop: 16, padding: 14, background: '#f8fafc', borderRadius: 10, textAlign: 'left', fontSize: '0.82rem', color: '#475569', lineHeight: 1.6 }}>
                                    <div style={{ fontWeight: 700, marginBottom: 4, color: '#8b5cf6', fontSize: '0.75rem' }}>🎬 AI 提取的画面描述：</div>
                                    {generatedPrompt}
                                </div>
                            )}
                        </div>
                    )}
                    {status === 'done' && result && (
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: '#10b981' }}>
                                ✅ 视频生成完成
                            </div>
                            <video
                                src={result.videoUrl}
                                poster={result.coverUrl}
                                controls
                                autoPlay
                                style={{ width: '100%', borderRadius: 12, maxHeight: 500, background: '#000' }}
                            />
                            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                                <a
                                    href={result.videoUrl}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                                        borderRadius: 10, background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                        color: 'white', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600,
                                    }}
                                >
                                    <Download size={15} /> 下载视频
                                </a>
                                <button
                                    onClick={reset}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                                        borderRadius: 10, border: '1px solid #e2e8f0', background: 'white',
                                        color: '#64748b', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                                    }}
                                >
                                    <RotateCcw size={15} /> 再生成一个
                                </button>
                            </div>
                        </div>
                    )}
                    {status === 'error' && (
                        <div style={{ textAlign: 'center', padding: 30 }}>
                            <div style={{ color: '#ef4444', fontWeight: 600, marginBottom: 10 }}>❌ {error || '生成失败'}</div>
                            <button onClick={reset} style={{
                                padding: '8px 20px', borderRadius: 10, border: '1px solid #e2e8f0',
                                background: 'white', cursor: 'pointer', fontSize: '0.85rem',
                            }}>重试</button>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
            `}</style>
        </div>
    );
}
