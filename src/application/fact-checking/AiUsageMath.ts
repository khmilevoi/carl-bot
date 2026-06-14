import type { AiUsage } from '@/application/interfaces/ai/AiGateway';

function sumNullable(left: number | null, right: number | null): number | null {
  if (left == null && right == null) return null;
  return (left ?? 0) + (right ?? 0);
}

export function sumAiUsage(left: AiUsage, right: AiUsage): AiUsage {
  return {
    promptTokens: sumNullable(left.promptTokens, right.promptTokens),
    completionTokens: sumNullable(
      left.completionTokens,
      right.completionTokens
    ),
    totalTokens: sumNullable(left.totalTokens, right.totalTokens),
  };
}
