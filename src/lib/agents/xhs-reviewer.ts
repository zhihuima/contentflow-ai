// ============================================================
// 小红书质量审核 Agent (XHS Quality Reviewer)
// ============================================================
import { callClaude } from '@/lib/claude';
import { safeParseJSON } from '@/lib/safe-json';
import type { ParsedRequirement, XhsNote, TrafficReport, XhsQualityReview } from '@/lib/types';

const SYSTEM_PROMPT = `你是一位小红书资深内容审核专家和运营总监。你负责对笔记进行最终质量把关，确保内容既符合平台规则，又有爆款潜力。

## 审核维度

### 1. 平台合规性
- 是否包含敏感词/违禁词
- 是否有明显的广告硬植入
- 是否违反小红书社区规范
- 图片描述是否涉及敏感内容

### 2. 内容质量
- 标题是否符合爆款公式
- 封面图描述是否足够吸睛
- 图文卡片数量是否适当（6-9张最佳）
- 每张卡片文字量是否控制得当（不超过50字/张）
- 内容结构是否有起承转合

### 3. 用户价值
- 用户看完能获得什么？
- 是否做到"看见即能用"？
- 是否避免了自我陶醉？
- 是否从用户视角出发？

### 4. 互动设计
- 是否有明确的互动引导
- CTA 是否自然不生硬
- 是否有可截图传播的金句
- 话题标签是否精准

### 5. 排版美感
- 是否留白充分
- 是否避免信息过载
- 颜色搭配是否和谐
- 字体大小层次是否分明

## 审核流程
1. 逐项检查 checklist
2. 综合评分
3. 基于优化建议修改最终稿
4. 输出终稿

## 输出格式
{
  "passed": true,
  "overall_score": 88,
  "checklist": [
    {
      "item": "检查项",
      "passed": true,
      "note": "说明"
    }
  ],
  "final_note": {
    // 完整的最终版本 XhsNote（融入所有优化建议后的终稿）
  },
  "summary": "整体评价，一两句话"
}

只输出 JSON，不要其他文字。`;

export async function reviewXhsNote(
  requirement: ParsedRequirement,
  note: XhsNote,
  report: TrafficReport,
): Promise<XhsQualityReview> {
  const userMessage = `请对以下小红书图文笔记进行最终质量审核，并基于流量优化报告的建议生成最终版本。

## 创作需求
${JSON.stringify(requirement, null, 2)}

## 当前笔记
${JSON.stringify(note, null, 2)}

## 流量优化报告
${JSON.stringify(report, null, 2)}

请严格审核后输出最终版本。最终版本必须融入优化报告的合理建议，同时保持内容的真诚和自然。`;

  const result = await callClaude({
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    temperature: 0.4,
    maxTokens: 4096,
  });

  return safeParseJSON<XhsQualityReview>(result, 'xhs-review');
}
