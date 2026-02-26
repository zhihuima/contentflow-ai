// ============================================================
// 核心数据类型定义 — 视频号短视频脚本 Workflow Agent
// ============================================================

/** 内容风格枚举 */
export type ContentStyle = '知识科普' | '情感共鸣' | '实用教程' | '热点跟踪' | '种草带货';

/** 视频时长枚举 */
export type VideoDuration = '超短(15-30s)' | '短(30-60s)' | '中(1-3min)' | '长(3-5min)';

/** 语气风格枚举 */
export type Tone = '专业权威' | '轻松幽默' | '认真走心' | '情绪张力' | '口语化';

/** 目标受众 */
export interface TargetAudience {
    age_range: string;
    gender: string;
    interests: string[];
}

/** Node 1 输出：结构化需求文档 */
export interface ParsedRequirement {
    topic: string;
    industry: string;
    target_audience: TargetAudience;
    content_style: ContentStyle;
    video_duration: VideoDuration;
    tone: Tone;
    business_goal?: string;
    brand_info?: string;
    reference_videos?: string[];
}

/** Node 2 输出：选题方案 */
export interface TopicPlan {
    id: number;
    title: string;
    angle: string;
    traffic_score: number;
    score_reason: string;
    metrics_estimate: {
        completion_rate: string;
        interaction_rate: string;
        share_rate: string;
    };
    publish_window: string;
}

/** 脚本分镜 */
export interface ScriptSegment {
    time_range: string;
    narration: string;
    visual: string;
    note?: string;
}

/** 封面设计建议 */
export interface CoverSuggestion {
    style: string;
    title_text: string;
    subtitle_text: string;
    color_scheme: string;
    layout: string;
    mood: string;
}

/** Node 3 输出：完整脚本 */
export interface Script {
    titles: string[];
    cover_texts: string[];
    hook: {
        type: string;
        content: string;
        visual: string;
    };
    main_body: ScriptSegment[];
    interaction_points: {
        position: string;
        strategy: string;
        design: string;
    }[];
    ending: {
        type: string;
        content: string;
        cta: string;
    };
    full_narration: string;
    word_count: number;
    estimated_duration: string;
    bgm_suggestion?: string;
    shooting_tips?: string[];
    golden_quotes?: string[];
    cover_suggestions?: CoverSuggestion[];
}

/** Node 4 输出：流量优化报告 */
export interface TrafficReport {
    overall_score: number;
    dimensions: {
        name: string;
        score: number;
        analysis: string;
        suggestions: string[];
    }[];
    red_flags: {
        type: string;
        content: string;
        suggestion: string;
    }[];
    optimized_titles?: string[];
    optimized_hook?: string;
    optimized_cover_texts?: string[];
}

/** Node 5 输出：质量审核结果 */
export interface QualityReview {
    passed: boolean;
    overall_score: number;
    checklist: {
        item: string;
        passed: boolean;
        note: string;
    }[];
    final_script: Script;
    summary: string;
}

/** 小红书图文卡片 */
export interface XhsSlide {
    page: number;
    image_description: string;
    text_overlay: string;
    layout_suggestion: string;
    image_keywords?: string[];
    image_url?: string;
}

/** 小红书图文笔记 */
export interface XhsNote {
    titles: string[];
    cover_image_desc: string;
    content_slides: XhsSlide[];
    caption: string;
    hashtags: string[];
    golden_quotes?: string[];
    seo_keywords: string[];
    estimated_reading: string;
    engagement_tips: string[];
}

/** 小红书质量审核 */
export interface XhsQualityReview {
    passed: boolean;
    overall_score: number;
    checklist: { item: string; passed: boolean; note: string }[];
    final_note: XhsNote;
    summary: string;
}

/** 润色结果 */
export interface PolishResult {
    original: string;
    polished: string;
    changes: {
        type: string;
        before: string;
        after: string;
        reason: string;
    }[];
    score: {
        before: number;
        after: number;
    };
    summary: string;
}

/** 发布建议 */
export interface PlatformAdvice {
    platform: string;
    best_publish_time: string[];
    hashtag_strategy: string;
    recommended_hashtags: string[];
    interaction_guide: string[];
    algorithm_tips: string[];
    content_warnings: string[];
    distribution_strategy: string;
}

/** 创作模式 */
export type CreationMode = 'video' | 'xhs' | 'douyin' | 'polish' | 'imitate';

/** 工作流状态 */
export type WorkflowStage = 'idle' | 'parsing' | 'planning' | 'writing' | 'optimizing' | 'reviewing' | 'done' | 'error';

/** 工作流完整状态 */
export interface WorkflowState {
    mode: CreationMode;
    stage: WorkflowStage;
    userInput: string;
    parsedRequirement: ParsedRequirement | null;
    topicPlans: TopicPlan[] | null;
    selectedTopicId: number | null;
    script: Script | null;
    trafficReport: TrafficReport | null;
    qualityReview: QualityReview | null;
    xhsNote: XhsNote | null;
    xhsReview: XhsQualityReview | null;
    polishResult: PolishResult | null;
    platformAdvice: PlatformAdvice | null;
    error: string | null;
    streamingText: string;
    imitateResult: import('@/lib/agents/content-imitator').ImitateResult | null;
}
