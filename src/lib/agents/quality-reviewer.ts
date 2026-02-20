// ============================================================
// Node 5: 审核输出 Agent (Quality Reviewer)
// ============================================================
import { callClaude } from '@/lib/claude';
import { safeParseJSON } from '@/lib/safe-json';
import type { ParsedRequirement, Script, TrafficReport, QualityReview } from '@/lib/types';

const SYSTEM_PROMPT = `你是一个严格的内容质量审核专家。你的任务是对最终脚本进行全面的质量审核，并组装交付物。

## 审核清单
1. **内容完整性**：所有脚本模块是否齐全（标题、封面文案、钩子、主体、互动点、结尾、完整口播稿）
2. **逻辑连贯性**：内容前后逻辑是否通顺，转场是否自然
3. **时长匹配**：口播字数与目标时长是否匹配（15s≈40字、30s≈80字、60s≈160字、3min≈480字）
4. **流量合规**：是否通过所有流量规则检查
5. **口语化检测**：文案是否适合直接口播，有无书面语残留
6. **可执行性**：脚本是否具备实际拍摄可行性

## 输出格式
必须严格输出 JSON：
{
  "passed": true,
  "overall_score": 85,
  "checklist": [
    {
      "item": "审核项名称",
      "passed": true,
      "note": "审核说明（30字以内）"
    }
  ],
  "final_script": { /* 最终优化后的完整脚本（与 Script 类型一致），如果流量优化提供了更好的标题/钩子/封面文案，在这里应用 */ },
  "summary": "整体评价总结（100字以内）"
}

## 规则
- 审核结果要公正客观
- 如果脚本需要微调，直接在 final_script 中修改
- 如果发现重大问题，passed 设为 false
- summary 要简明扼要地总结脚本的优缺点
- 只输出 JSON，不要输出其他文字`;

export async function reviewQuality(
  requirement: ParsedRequirement,
  script: Script,
  trafficReport: TrafficReport
): Promise<QualityReview> {
  const userMessage = `请对以下脚本进行最终质量审核：

## 用户需求
${JSON.stringify(requirement, null, 2)}

## 当前脚本
${JSON.stringify(script, null, 2)}

## 流量优化报告
${JSON.stringify(trafficReport, null, 2)}

请根据审核清单逐项检查，并生成最终交付版本。如果流量优化建议中有优化后的标题/钩子/封面文案，请在最终脚本中采纳。`;

  const result = await callClaude({
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    temperature: 0.3,
    maxTokens: 4096,
  });

  return safeParseJSON<QualityReview>(result, 'quality-review');
}
