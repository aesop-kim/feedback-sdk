"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startCaptureSession, type CaptureResult, type CaptureSession } from "@/lib/recording/capture-session";
import { uploadRecording, type RecordedContext } from "@/lib/recording/upload-recording";
import { MAX_RECORDING_MS } from "@/lib/validation/api-schemas";
import type { HostToWidgetMessage, WidgetToHostMessage } from "@/sdk/bridge-protocol";

const FRAME_INTERVAL_MS = 2_000;
const DOM_STOP_TIMEOUT_MS = 2_000;
const TIMER_TICK_MS = 250;
const RRWEB_META_EVENT_TYPE = 4;

export const SCREEN_DENIED_MESSAGE = "화면 공유를 시작하지 않았어요";
export const MICROPHONE_DENIED_MESSAGE = "마이크 권한이 필요해요";
const UPLOAD_FAILED_MESSAGE = "연결이 잠깐 불안정해요. 잠시 후 다시 해볼까요?";

export type RecordingPhase = "idle" | "recording" | "stopping";

export type PendingUpload = { localId: string; durationMs: number; progress: number; isFailed: boolean };

type PreparedUpload = {
  capture: CaptureResult;
  rrwebEvents: unknown[];
  contexts: RecordedContext[];
  page: { url: string; title: string };
  viewport: { width: number; height: number };
};

type UseWidgetRecordingInput = {
  post: (message: WidgetToHostMessage) => void;
  conversationToken: string | null;
  page: { url: string; title: string } | null;
  onToast: (message: string) => void;
  onModeChange: (mode: "open" | "recording") => void;
  onUploaded: () => Promise<void> | void;
};

type DisplayMediaOptions = DisplayMediaStreamOptions & { preferCurrentTab?: boolean; selfBrowserSurface?: "include" | "exclude" };

const DISPLAY_MEDIA_OPTIONS: DisplayMediaOptions = {
  video: { displaySurface: "browser", width: { ideal: 1280 }, frameRate: { max: 15 } } as MediaTrackConstraints,
  audio: false,
  preferCurrentTab: true,
  selfBrowserSurface: "include",
};

type RrwebMetaEvent = { type: number; data?: { href?: string; width?: number; height?: number } };

function findRrwebMeta(events: unknown[]): RrwebMetaEvent["data"] | null {
  for (const event of events) {
    const candidate = event as RrwebMetaEvent;
    if (candidate?.type === RRWEB_META_EVENT_TYPE && candidate.data) {
      return candidate.data;
    }
  }
  return null;
}

function getHostViewport(meta: RrwebMetaEvent["data"] | null, contexts: RecordedContext[]): { width: number; height: number } {
  if (meta?.width && meta.height) {
    return { width: Math.round(meta.width), height: Math.round(meta.height) };
  }
  const contextViewport = contexts.at(-1)?.context.viewport;
  if (contextViewport && contextViewport.width > 0 && contextViewport.height > 0) {
    return contextViewport;
  }
  return { width: window.screen.width, height: window.screen.height };
}

export function useWidgetRecording({ post, conversationToken, page, onToast, onModeChange, onUploaded }: UseWidgetRecordingInput) {
  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const sessionRef = useRef<CaptureSession | null>(null);
  const rrwebEventsRef = useRef<unknown[]>([]);
  const contextsRef = useRef<RecordedContext[]>([]);
  const domStoppedResolverRef = useRef<(() => void) | null>(null);
  const preparedUploadRef = useRef<PreparedUpload | null>(null);
  const latestInputRef = useRef({ post, conversationToken, page, onToast, onModeChange, onUploaded });

  useEffect(() => {
    latestInputRef.current = { post, conversationToken, page, onToast, onModeChange, onUploaded };
  }, [post, conversationToken, page, onToast, onModeChange, onUploaded]);

  useEffect(() => {
    if (phase !== "recording") {
      return;
    }
    const timer = window.setInterval(() => {
      const session = sessionRef.current;
      setElapsedMs(session ? Math.max(0, Date.now() - session.t0) : 0);
    }, TIMER_TICK_MS);
    return () => window.clearInterval(timer);
  }, [phase]);

  const runUpload = useCallback(async (prepared: PreparedUpload, localId: string) => {
    const { conversationToken: token, onToast: showToast, onUploaded: handleUploaded } = latestInputRef.current;
    setPendingUpload({ localId, durationMs: prepared.capture.durationMs, progress: 0, isFailed: false });
    if (!token) {
      setPendingUpload((current) => (current ? { ...current, isFailed: true } : current));
      showToast(UPLOAD_FAILED_MESSAGE);
      return;
    }
    try {
      await uploadRecording({
        conversationToken: token,
        ...prepared,
        onProgress: (progress) => setPendingUpload((current) => (current ? { ...current, progress } : current)),
      });
      preparedUploadRef.current = null;
      await handleUploaded();
      setPendingUpload(null);
    } catch {
      setPendingUpload((current) => (current ? { ...current, isFailed: true } : current));
      showToast(UPLOAD_FAILED_MESSAGE);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) {
      return;
    }
    sessionRef.current = null;
    setPhase("stopping");
    const { post: postToHost, page: currentPage, onModeChange: changeMode } = latestInputRef.current;

    const domStopped = new Promise<void>((resolve) => {
      domStoppedResolverRef.current = resolve;
      window.setTimeout(resolve, DOM_STOP_TIMEOUT_MS);
    });
    postToHost({ type: "recording:stop", payload: {} });
    const [capture] = await Promise.all([session.stop(), domStopped]);
    domStoppedResolverRef.current = null;

    postToHost({ type: "widget:mode", payload: { mode: "open" } });
    changeMode("open");
    setPhase("idle");

    const rrwebEvents = rrwebEventsRef.current;
    const contexts = contextsRef.current;
    const meta = findRrwebMeta(rrwebEvents);
    const prepared: PreparedUpload = {
      capture,
      rrwebEvents,
      contexts,
      page: { url: meta?.href ?? currentPage?.url ?? "", title: currentPage?.title ?? "" },
      viewport: getHostViewport(meta, contexts),
    };
    preparedUploadRef.current = prepared;
    await runUpload(prepared, `local-${capture.t0}`);
  }, [runUpload]);

  // 브라우저는 사용자 클릭 직후에만 화면 공유를 허락하므로, 첫 await가 getDisplayMedia여야 한다.
  const startRecording = useCallback(async () => {
    if (sessionRef.current || phase !== "idle") {
      return;
    }
    const { onToast: showToast, post: postToHost, onModeChange: changeMode } = latestInputRef.current;
    let displayStream: MediaStream;
    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia(DISPLAY_MEDIA_OPTIONS);
    } catch {
      showToast(SCREEN_DENIED_MESSAGE);
      return;
    }
    let microphoneStream: MediaStream;
    try {
      microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      for (const track of displayStream.getTracks()) {
        track.stop();
      }
      showToast(MICROPHONE_DENIED_MESSAGE);
      return;
    }

    rrwebEventsRef.current = [];
    contextsRef.current = [];
    const session = startCaptureSession({ displayStream, microphoneStream, maxDurationMs: MAX_RECORDING_MS, frameIntervalMs: FRAME_INTERVAL_MS });
    sessionRef.current = session;
    session.onAutoStop(() => {
      void stopRecording();
    });
    setElapsedMs(0);
    setPhase("recording");
    postToHost({ type: "recording:start", payload: { t0: session.t0 } });
    postToHost({ type: "widget:mode", payload: { mode: "recording" } });
    changeMode("recording");
  }, [phase, stopRecording]);

  const retryUpload = useCallback(() => {
    const prepared = preparedUploadRef.current;
    if (prepared && pendingUpload) {
      void runUpload(prepared, pendingUpload.localId);
    }
  }, [pendingUpload, runUpload]);

  const handleHostMessage = useCallback((message: HostToWidgetMessage) => {
    switch (message.type) {
      case "dom:events":
        if (sessionRef.current || domStoppedResolverRef.current) {
          rrwebEventsRef.current.push(...message.payload.events);
        }
        return;
      case "dom:click":
        sessionRef.current?.requestFrame("click", message.payload.epochMs);
        if (message.payload.context) {
          contextsRef.current.push({ epochMs: message.payload.epochMs, context: message.payload.context, kind: "click" });
        }
        return;
      case "dom:context":
        contextsRef.current.push({ epochMs: message.payload.epochMs, context: message.payload.context, kind: "hover" });
        return;
      case "dom:stopped":
        domStoppedResolverRef.current?.();
        return;
      default:
        return;
    }
  }, []);

  return {
    phase,
    elapsedMs,
    maxDurationMs: MAX_RECORDING_MS,
    pendingUpload,
    startRecording,
    stopRecording,
    retryUpload,
    handleHostMessage,
  };
}
