// ============================================================
// 会议系统类型定义
// ============================================================

import type { AgentProfile } from './departments';

export type MeetingType = 'department' | 'cross-department' | 'project' | 'review';
export type MeetingStatus = 'active' | 'completed' | 'cancelled';
export type MessageType = 'moderator' | 'opinion' | 'question' | 'reply' | 'suggestion' | 'summary' | 'user_input';

export interface Meeting {
    id: string;
    title: string;
    topic: string;
    type: MeetingType;
    participantIds: string[];
    messages: MeetingMessage[];
    summary?: MeetingSummary;
    status: MeetingStatus;
    createdAt: string;
}

export interface MeetingMessage {
    id: string;
    agentId: string;
    agentName: string;
    agentAvatar: string;
    agentColor: string;
    content: string;
    thinking?: string;
    replyTo?: string;
    timestamp: number;
    type: MessageType;
}

export interface MeetingSummary {
    keyPoints: string[];
    decisions: string[];
    actionItems: {
        assignee: string;
        assigneeName: string;
        task: string;
    }[];
    nextSteps: string[];
}

/** SSE 事件 */
export interface MeetingSSEEvent {
    type: 'message_start' | 'message_delta' | 'message_done' | 'meeting_summary' | 'meeting_end' | 'error';
    data: MeetingMessage | MeetingSummary | { error: string } | null;
}

/** 发起会议请求 */
export interface StartMeetingRequest {
    topic: string;
    type: MeetingType;
    participantIds: string[];
    userContext?: string;
}
