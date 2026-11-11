import { z } from "zod";

export const MAX_FRAME_COUNT = 120;
export const MAX_RECORDING_MS = 180_000;
export const MAX_MESSAGE_LENGTH = 2_000;

export const startConversationSchema = z.object({
  projectKey: z.string().min(1).max(100),
  hostOrigin: z.string().url(),
  user: z.object({
    id: z.string().min(1).max(200),
    name: z.string().min(1).max(100),
    email: z.string().email().max(200).optional(),
  }),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, "내용을 입력해 주세요").max(MAX_MESSAGE_LENGTH),
});

export const createRecordingSchema = z.object({
  pageUrl: z.string().max(2_000),
  pageTitle: z.string().max(300).optional(),
  viewport: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  t0EpochMs: z.number().int().positive(),
  durationMs: z.number().int().positive().max(MAX_RECORDING_MS + 5_000),
  audioOffsetMs: z.number().int(),
  frames: z
    .array(z.object({ tMs: z.number().int().min(0), reason: z.enum(["interval", "click"]) }))
    .max(MAX_FRAME_COUNT),
  reverifyIssueId: z.string().uuid().optional(),
});

export const completeRecordingSchema = z.object({
  status: z.literal("uploaded"),
});

export const answerClarificationSchema = z
  .object({
    optionId: z.string().max(50).optional(),
    text: z.string().trim().max(MAX_MESSAGE_LENGTH).optional(),
  })
  .refine((value) => Boolean(value.optionId) || Boolean(value.text), { message: "답을 골라 주세요" });

export const adminLoginSchema = z.object({ password: z.string().min(1).max(200) });

export const approveClarificationSchema = z.object({
  question: z.string().trim().min(1).max(300).optional(),
  options: z
    .array(z.object({ id: z.string().min(1).max(50), label: z.string().trim().min(1).max(100) }))
    .min(2)
    .max(4)
    .optional(),
});

export const updateIssueSchema = z.object({ status: z.enum(["resolved"]) });
