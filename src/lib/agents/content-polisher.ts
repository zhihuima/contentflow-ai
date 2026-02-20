// ============================================================
// Content Polisher Agent — 内容润色（融合全部知识库）
// ============================================================
import { callClaude } from '@/lib/claude';
import { safeParseJSON } from '@/lib/safe-json';
import type { PolishResult } from '../types';

/**
 * 根据知识库标准对用户提供的内容进行润色改写
 */
export async function polishContent(
    content: string,
    ragContext: string,
    targetPlatform: string = '通用',
): Promise<PolishResult> {
    const systemPrompt = `你是一位顶级内容策略专家，精通短视频脚本和小红书爆款笔记创作。
你的任务是将用户提供的原始内容按照「爆款内容创作标准」进行全面润色优化。

## 优化维度
1. **标题/钩子优化** — 3秒吸引力法则，制造好奇心缺口
2. **结构优化** — 内容节奏、起承转合、信息密度
3. **表达优化** — 口语化/场景化表达，金句提炼
4. **互动设计** — 增加互动引导、争议点、参与感
5. **流量规则适配** — 避免违禁词、优化完播率设计
6. **情感共鸣** — 增强代入感，用切身案例替代空洞说教

## 目标平台：${targetPlatform}

${ragContext}`;

    const userPrompt = `请对以下内容进行全面润色优化。

## 原始内容
${content}

## 要求
请严格按照以下 JSON 格式返回：
\`\`\`json
{
  "original": "用户原始内容（原样保留）",
  "polished": "优化后的完整内容",
  "changes": [
    {
      "type": "标题优化|结构优化|表达优化|互动设计|流量适配|情感强化",
      "before": "修改前的片段",
      "after": "修改后的片段",
      "reason": "为什么这样改"
    }
  ],
  "score": {
    "before": 55,
    "after": 88
  },
  "summary": "一句话总结本次优化的核心提升点"
}
\`\`\`

请确保：
1. changes 列出 5~10 个最关键的改动点
2. 评分客观（满分100），before 不要低于 30，after 不要超过 95
3. polished 内容是改写后可以直接使用的完整文案`;

    const raw = await callClaude({
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.7,
        maxTokens: 4096,
    });
    const result = safeParseJSON<PolishResult>(raw, 'polish');

    if (!result || !result.polished) {
        throw new Error('AI 返回格式异常，请重试');
    }

    // 确保 original 字段正确
    result.original = content;

    return result;
}
