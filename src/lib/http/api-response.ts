import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { getValidationMessage } from "@/lib/validation/validation-message";

export function respondJson<TBody>(body: TBody, status = 200): NextResponse<TBody> {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function respondError(status: number, message: string): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

export function respondUnauthorized(): NextResponse<{ error: string }> {
  return respondError(401, "인증 정보가 없거나 만료됐어요.");
}

// zod 원문(영어, 필드 경로 포함)은 화면에 그대로 보이므로 한국어 안내로 바꿔서 준다.
export function respondValidationError(error: ZodError): NextResponse<{ error: string }> {
  return respondError(400, getValidationMessage(error.issues[0]));
}
