import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function respondJson<TBody>(body: TBody, status = 200): NextResponse<TBody> {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

export function respondError(status: number, message: string): NextResponse<{ error: string }> {
  return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

export function respondUnauthorized(): NextResponse<{ error: string }> {
  return respondError(401, "인증 정보가 없거나 만료됐어요.");
}

export function respondValidationError(error: ZodError): NextResponse<{ error: string }> {
  const firstIssue = error.issues[0];
  return respondError(400, firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "요청 형식이 올바르지 않아요.");
}
