"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

export type AdminRequestResult<TBody> = { ok: true; body: TBody } | { ok: false; status: number; message: string };

const FALLBACK_ERROR_MESSAGE = "연결이 잠깐 불안정해요. 잠시 후 다시 해볼까요?";

// 관리자 API 호출 공통 처리. 세션이 끊기면(401) 로그인 화면으로 보낸다.
export function useAdminRequest() {
  const router = useRouter();

  return useCallback(
    async <TBody>(path: string, init?: { method?: string; body?: unknown }): Promise<AdminRequestResult<TBody>> => {
      try {
        const response = await fetch(path, {
          method: init?.method ?? "GET",
          headers: init?.body === undefined ? undefined : { "content-type": "application/json" },
          body: init?.body === undefined ? undefined : JSON.stringify(init.body),
          cache: "no-store",
        });
        if (response.status === 401) {
          router.replace("/admin/login");
          return { ok: false, status: 401, message: "다시 로그인해 주세요." };
        }
        const body = (await response.json().catch(() => null)) as (TBody & { error?: string }) | null;
        if (!response.ok || body === null) {
          return { ok: false, status: response.status, message: body?.error ?? FALLBACK_ERROR_MESSAGE };
        }
        return { ok: true, body };
      } catch {
        return { ok: false, status: 0, message: FALLBACK_ERROR_MESSAGE };
      }
    },
    [router],
  );
}
