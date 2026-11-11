"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  createEnvelope,
  isBridgeEnvelope,
  type HostToWidgetMessage,
  type WidgetToHostMessage,
} from "@/sdk/bridge-protocol";

// 부모 페이지 origin: Chrome은 location.ancestorOrigins, 그 외엔 referrer(기본 정책에서 origin은 남는다).
function findParentOrigin(): string | null {
  const ancestorOrigin = window.location.ancestorOrigins?.[0];
  if (ancestorOrigin) {
    return ancestorOrigin;
  }
  try {
    return document.referrer ? new URL(document.referrer).origin : null;
  } catch {
    return null;
  }
}

// 위젯(iframe) ↔ 고객사 페이지 postMessage. 부모 origin에서 온 host:init만 받고, 그 뒤로는 그 origin만 믿는다.
// 그 origin이 정말 허용된 사이트인지는 POST /api/conversations(hostOrigin 검사)와 CSP frame-ancestors가 판단한다.
export function useWidgetBridge(onMessage: (message: HostToWidgetMessage, origin: string) => void) {
  const hostOriginRef = useRef<string | null>(null);
  const expectedHostOriginRef = useRef<string | null>(null);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || window.parent === window || !isBridgeEnvelope(event.data)) {
        return;
      }
      const message = event.data as unknown as HostToWidgetMessage;
      if (!hostOriginRef.current) {
        if (message.type !== "host:init") {
          return;
        }
        if (expectedHostOriginRef.current && event.origin !== expectedHostOriginRef.current) {
          return;
        }
        hostOriginRef.current = event.origin;
      }
      if (event.origin !== hostOriginRef.current) {
        return;
      }
      onMessageRef.current(message, event.origin);
    };
    window.addEventListener("message", handleMessage);
    // 부모 페이지 origin을 브라우저가 알려 주는 값으로 먼저 고정한다. 이 origin에서 온 host:init만 받는다.
    const expectedHostOrigin = findParentOrigin();
    if (expectedHostOrigin) {
      expectedHostOriginRef.current = expectedHostOrigin;
      window.parent.postMessage(createEnvelope({ type: "widget:ready", payload: {} }), expectedHostOrigin);
    }
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const post = useCallback((message: WidgetToHostMessage) => {
    const hostOrigin = hostOriginRef.current;
    if (!hostOrigin) {
      return;
    }
    window.parent.postMessage(createEnvelope(message), hostOrigin);
  }, []);

  return { post };
}
