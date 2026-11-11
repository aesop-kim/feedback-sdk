"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  createEnvelope,
  isBridgeEnvelope,
  type HostToWidgetMessage,
  type WidgetToHostMessage,
} from "@/sdk/bridge-protocol";

// 위젯(iframe) ↔ 고객사 페이지 postMessage. 첫 host:init을 보낸 origin을 기억하고, 그 뒤로는 그 origin만 믿는다.
// 그 origin이 정말 허용된 사이트인지는 POST /api/conversations(hostOrigin 검사)와 CSP frame-ancestors가 판단한다.
export function useWidgetBridge(onMessage: (message: HostToWidgetMessage, origin: string) => void) {
  const hostOriginRef = useRef<string | null>(null);
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
        hostOriginRef.current = event.origin;
      }
      if (event.origin !== hostOriginRef.current) {
        return;
      }
      onMessageRef.current(message, event.origin);
    };
    window.addEventListener("message", handleMessage);
    // 아직 상대 origin을 모르는 유일한 메시지라 "*"로 보낸다. 내용이 비어 있어 새어 나갈 정보가 없다.
    window.parent.postMessage(createEnvelope({ type: "widget:ready", payload: {} }), "*");
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
