"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRealtimeSignal } from "@/hooks/use-realtime-signal";
import { getConversationChannelName } from "@/lib/realtime/realtime-signal";
import {
  countUnreadReplies,
  findLatestMessageTime,
  findStoredLastReadAt,
  getLastReadStorageKey,
  storeLastReadAt,
} from "@/lib/widget/unread-replies";
import type { HostToWidgetMessage } from "@/sdk/bridge-protocol";
import type { ChatMessage, ReverifyRequest } from "@/types/feedback";

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

const ALREADY_ANSWERED_STATUS = 409;

export function isAlreadyAnsweredError(error: unknown): boolean {
  return error instanceof WidgetApiError && error.status === ALREADY_ANSWERED_STATUS;
}

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

// reverifyRequest: 열린 재확인 요청(없으면 null). 이 필드를 모르는 서버면 undefined로 남긴다.
type MessagesResponse = { messages: ChatMessage[]; reverifyRequest?: ReverifyRequest | null };

async function getMessages(token: string): Promise<MessagesResponse> {
  return requestWidgetApi<MessagesResponse>("/api/messages", { method: "GET", token });
}

async function startSession(
  init: HostInit,
  hostOrigin: string,
  storageKey: string,
): Promise<{ session: WidgetSession; response: MessagesResponse }> {
  const storedSession = findStoredSession(storageKey);
  if (storedSession) {
    try {
      return { session: storedSession, response: await getMessages(storedSession.conversationToken) };
    } catch {
      // 토큰이 만료됐거나 대화가 사라졌으면 아래에서 새로 연결한다.
    }
  }
  const session = await requestWidgetApi<WidgetSession>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ projectKey: init.projectKey, hostOrigin, user: init.user }),
  });
  storeSession(storageKey, session);
  return { session, response: await getMessages(session.conversationToken) };
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
  const [reverifyRequest, setReverifyRequest] = useState<ReverifyRequest | null | undefined>(undefined);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const messagesRef = useRef<ChatMessage[]>([]);
  const lastReadKeyRef = useRef<string | null>(null);
  const lastReadAtRef = useRef<string | null>(null);
  const unreadCountRef = useRef(0);
  const isOpenRef = useRef(isOpen);
  const onUnreadChangeRef = useRef(onUnreadChange);

  useEffect(() => {
    onUnreadChangeRef.current = onUnreadChange;
  }, [onUnreadChange]);

  const markReadUntil = useCallback((time: string) => {
    lastReadAtRef.current = time;
    if (lastReadKeyRef.current) {
      storeLastReadAt(lastReadKeyRef.current, time);
    }
  }, []);

  // 위젯이 열려 있으면 받은 메시지를 모두 읽은 것으로 보고, 닫혀 있으면 마지막으로 본 시각 뒤의 답장을 센다.
  const updateUnread = useCallback((currentMessages: ChatMessage[]) => {
    const latestTime = findLatestMessageTime(currentMessages);
    if (latestTime && isOpenRef.current) {
      markReadUntil(latestTime);
    }
    const unreadCount = isOpenRef.current ? 0 : countUnreadReplies(currentMessages, lastReadAtRef.current);
    if (unreadCount !== unreadCountRef.current) {
      unreadCountRef.current = unreadCount;
      onUnreadChangeRef.current(unreadCount);
    }
  }, [markReadUntil]);

  const applyMessages = useCallback(
    ({ messages: nextMessages, reverifyRequest: nextReverifyRequest }: MessagesResponse) => {
      messagesRef.current = nextMessages;
      updateUnread(nextMessages);
      setMessages(nextMessages);
      setReverifyRequest(nextReverifyRequest);
    },
    [updateUnread],
  );

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (isOpen) {
      updateUnread(messagesRef.current);
    }
  }, [isOpen, updateUnread]);

  useEffect(() => {
    if (!init || !hostOrigin) {
      return;
    }
    lastReadKeyRef.current = getLastReadStorageKey(init.projectKey, init.user.id);
    lastReadAtRef.current = findStoredLastReadAt(lastReadKeyRef.current);
    let isCancelled = false;
    startSession(init, hostOrigin, getStorageKey(init))
      .then((result) => {
        if (isCancelled) {
          return;
        }
        setSession(result.session);
        // 이 기기에서 처음 연 위젯이면 지금까지 온 메시지는 읽은 것으로 본다(메시지가 없으면 앞으로 오는 답장부터 센다).
        if (lastReadAtRef.current === null) {
          markReadUntil(findLatestMessageTime(result.response.messages) ?? new Date(0).toISOString());
        }
        applyMessages(result.response);
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
  }, [init, hostOrigin, applyMessages, markReadUntil, loadAttempt]);

  // 처음 연결이 실패했을 때 "다시 불러오기". 세션 만들기부터 다시 한다.
  const reload = useCallback(() => {
    setStatus("loading");
    setErrorMessage(null);
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

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
      try {
        await requestWidgetApi(`/api/clarifications/${cardId}/answer`, {
          method: "POST",
          body: JSON.stringify(answer),
          token: session.conversationToken,
        });
      } catch (error) {
        // 다른 탭에서 이미 답했으면 다시 불러와 카드를 '답변을 보냈어요'로 바꾼다.
        if (isAlreadyAnsweredError(error)) {
          await refetch();
        }
        throw error;
      }
      await refetch();
    },
    [session, refetch],
  );

  return { status, errorMessage, session, messages, reverifyRequest, refetch, reload, sendText, answerClarification };
}
