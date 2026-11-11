import { z } from "zod";

// claude -p 구조화 출력 스키마. JSON Schema로 바꿔 --json-schema에 넘기고, 받은 결과도 같은 스키마로 다시 검증한다.
// 구조화 출력 호환을 위해 선택 필드는 optional 대신 nullable로 둔다.

// 프롬프트는 20자 이내를 요구하고, 검증은 조금 넘친 제목 때문에 재시도하지 않도록 여유를 둔다.
export const TITLE_TARGET_LENGTH = 20;
export const MAX_TITLE_LENGTH = 30;

export const clarificationDraftSchema = z.object({
  question: z.string().trim().min(1).max(300),
  options: z.array(z.string().trim().min(1).max(100)).min(2).max(4),
});

export const analysisIssueSchema = z
  .object({
    tMs: z.number().min(0),
    quote: z.string().trim().min(1),
    title: z.string().trim().min(1).max(MAX_TITLE_LENGTH),
    summary: z.string().trim().min(1),
    suggestion: z.string().trim().min(1),
    frameRef: z.string().nullable(),
    selector: z.string().nullable(),
    confidence: z.enum(["clear", "ambiguous"]),
    clarification: clarificationDraftSchema.nullable(),
  })
  .refine((issue) => issue.confidence === "clear" || issue.clarification !== null, {
    message: "ambiguous 이슈에는 clarification이 필요해요",
    path: ["clarification"],
  });

export const analysisResultSchema = z.object({ issues: z.array(analysisIssueSchema) });

export type AnalysisIssue = z.infer<typeof analysisIssueSchema>;
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

// claude CLI의 스키마 검증기는 draft 2020-12 메타 스키마를 몰라서 "$schema" 키를 빼고 넘긴다.
export function getAnalysisJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(analysisResultSchema) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}
