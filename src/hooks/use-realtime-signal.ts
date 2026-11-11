"use client";

import { useEffect, useRef } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser-client";
import { REALTIME_EVENT, isRealtimeSignal, type RealtimeSignal } from "@/lib/realtime/realtime-signal";

const FALLBACK_POLL_MS = 15_000;

// 채널 신호를 받으면 onSignal을 부른다. 신호 내용은 믿지 않고 "다시 불러오기" 트리거로만 쓴다.
// 연결이 끊겨도 화면이 멈추지 않도록 15초마다 한 번씩도 다시 불러온다.
export function useRealtimeSignal(channelName: string | null, onSignal: (signal: RealtimeSignal | null) => void): void {
  const onSignalRef = useRef(onSignal);

  useEffect(() => {
    onSignalRef.current = onSignal;
  }, [onSignal]);

  useEffect(() => {
    if (!channelName) {
      return;
    }
    const supabase = getBrowserSupabase();
    const channel = supabase
      .channel(channelName)
      .on("broadcast", { event: REALTIME_EVENT }, ({ payload }) => {
        onSignalRef.current(isRealtimeSignal(payload) ? payload : null);
      })
      .subscribe();
    const pollTimer = window.setInterval(() => onSignalRef.current(null), FALLBACK_POLL_MS);

    return () => {
      window.clearInterval(pollTimer);
      void supabase.removeChannel(channel);
    };
  }, [channelName]);
}
