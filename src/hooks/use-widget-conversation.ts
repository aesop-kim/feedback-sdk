"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeSignal } from "@/hooks/use-realtime-signal";
import { getConversationChannelName } from "@/lib/realtime/realtime-signal";
import type { HostToWidgetMessage } from "@/sdk/bridge-protocol";
import type { ChatMessage } from "@/types/feedback";

export type HostInit = Extract<HostToWidgetMessage, { type: "host:init" }>["payload"];

export type WidgetSession = {
  conversationId: string;
  conversationToken: string;
  projectName: string;
  endUserName: string;
};

export type ConversationStatus = "loading" | "ready" | "error";

export class WidgetApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "WidgetApiError";
  }
}

export const NETWORK_ERROR_MESSAGE = "연결이 잠깐 불안정해요. 잠시 후 다시 해볼까요?";

async function requestWidgetApi<TResponse>(path: string, init: RequestInit & { token?: string }): Promise<TResponse> {
  const { token, ...requestInit } = init;
  let response: Response;
  try {
    response = await fetch(path, {
      ...requestInit,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
  } catch {
    throw new WidgetApiError(NETWORK_ERROR_MESSAGE, 0);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new WidgetApiError(body?.error ?? NETWORK_ERROR_MESSAGE, response.status);
  }
  return (await response.json()) as TResponse;
}

function getStorageKey(init: HostInit): string {
  return `lattice-feedback:${init.projectKey}:${init.user.id}`;
}

function findStoredSession(key: string): WidgetSession | null {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as Partial<WidgetSession>) : null;
    if (parsed?.conversationId && parsed.conversationToken) {
      return {
        conversationId: parsed.conversationId,
        conversationToken: parsed.conversationToken,
        projectName: parsed.projectName ?? "",
        endUserName: parsed.endUserName ?? "",
      };
    }
  } catch {
    // 저장소를 못 쓰는 환경(차단된 서드파티 저장소)이면 매번 새로 연결한다.
  }
  return null;
}

function storeSession(key: string, session: WidgetSession): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(session));
  } catch {
    // 저장 실패는 다음 접속 때 새 토큰을 받는 것으로 충분하다.
  }
}

async function getMessages(token: string): Promise<ChatMessage[]> {
  const { messages } = await requestWidgetApi<{ messages: ChatMessage[] }>("/api/messages", { method: "GET", token });
  return messages;
}

async function startSession(init: HostInit, hostOrigin: string, storageKey: string): Promise<{ session: WidgetSession; messages: ChatMessage[] }> {
  const storedSession = findStoredSession(storageKey);
  if (storedSession) {
    try {
      return { session: storedSession, messages: await getMessages(storedSession.conversationToken) };
    } catch {
      // 토큰이 만료됐거나 대화가 사라졌으면 아래에서 새로 연결한다.
    }
  }
  const session = await requestWidgetApi<WidgetSession>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ projectKey: init.projectKey, hostOrigin, user: init.user }),
  });
  storeSession(storageKey, session);
  return { session, messages: await getMessages(session.conversationToken) };
}

type UseWidgetConversationInput = {
  init: HostInit | null;
  hostOrigin: string | null;
  isOpen: boolean;
  onUnreadChange: (count: number) => void;
};

export function useWidgetConversation({ init, hostOrigin, isOpen, onUnreadChange }: UseWidgetConversationInput) {
  const [status, setStatus] = useState<ConversationStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session, setSession] = useState<WidgetSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const seenMessageIdsRef = useRef<Set<string> | null>(null);
  const unreadCountRef = useRef(0);
  const isOpenRef = useRef(isOpen);
  const onUnreadChangeRef = useRef(onUnreadChange);

  useEffect(() => {
    onUnreadChangeRef.current = onUnreadChange;
  }, [onUnreadChange]);

  const applyMessages = useCallback((nextMessages: ChatMessage[]) => {
    const seenIds = seenMessageIdsRef.current;
    if (seenIds && !isOpenRef.current) {
      const newReplies = nextMessages.filter((message) => message.sender !== "user" && !seenIds.has(message.id));
      if (newReplies.length > 0) {
        unreadCountRef.current += newReplies.length;
        onUnreadChangeRef.current(unreadCountRef.current);
      }
    }
    seenMessageIdsRef.current = new Set(nextMessages.map((message) => message.id));
    setMessages(nextMessages);
  }, []);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen && unreadCountRef.current > 0) {
      unreadCountRef.current = 0;
      onUnreadChangeRef.current(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!init || !hostOrigin) {
      return;
    }
    let isCancelled = false;
    startSession(init, hostOrigin, getStorageKey(init))
      .then((result) => {
        if (isCancelled) {
          return;
        }
        setSession(result.session);
        applyMessages(result.messages);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : NETWORK_ERROR_MESSAGE);
        setStatus("error");
      });
    return () => {
      isCancelled = true;
    };
  }, [init, hostOrigin, applyMessages]);

  const refetch = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      applyMessages(await getMessages(session.conversationToken));
    } catch {
      // 다음 신호나 주기 재조회에서 다시 가져온다.
    }
  }, [session, applyMessages]);

  useRealtimeSignal(session ? getConversationChannelName(session.conversationId) : null, () => {
    void refetch();
  });

  const sendText = useCallback(
    async (body: string) => {
      if (!session) {
        throw new WidgetApiError(NETWORK_ERROR_MESSAGE, 0);
      }
      await requestWidgetApi("/api/messages", { method: "POST", body: JSON.stringify({ body }), token: session.conversationToken });
      await refetch();
    },
    [session, refetch],
  );

  const answerClarification = useCallback(
    async (cardId: string, answer: { optionId?: string; text?: string }) => {
      if (!session) {
        throw new WidgetApiError(NETWORK_ERROR_MESSAGE, 0);
      }
      await requestWidgetApi(`/api/clarifications/${cardId}/answer`, {
        method: "POST",
        body: JSON.stringify(answer),
        token: session.conversationToken,
      });
      await refetch();
    },
    [session, refetch],
  );

  return { status, errorMessage, session, messages, refetch, sendText, answerClarification };
}
