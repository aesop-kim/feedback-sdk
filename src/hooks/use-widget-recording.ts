"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestMicrophone, watchMicrophone } from "@/lib/recording/request-microphone";
import { startCaptureSession, type CaptureResult, type CaptureSession } from "@/lib/recording/capture-session";
import { RecordingUploadError, uploadRecording, type RecordedContext } from "@/lib/recording/upload-recording";
import { MAX_RECORDING_MS } from "@/lib/validation/api-schemas";
import type { HostToWidgetMessage, WidgetToHostMessage } from "@/sdk/bridge-protocol";

const FRAME_INTERVAL_MS = 2_000;
const DOM_STOP_TIMEOUT_MS = 2_000;
const TIMER_TICK_MS = 250;
const RRWEB_META_EVENT_TYPE = 4;

const SCREEN_DENIED_MESSAGE = "화면 공유를 시작하지 않았어요. 다시 누르고 ‘이 탭’을 골라 주세요";
const MICROPHONE_DENIED_MESSAGE = "마이크를 쓸 수 없어요. 주소창 왼쪽 자물쇠에서 마이크를 허용해 주세요";
const UPLOAD_FAILED_MESSAGE = "녹화를 보내지 못했어요. ‘다시 보내기’를 눌러 주세요";
const CANCELLED_MESSAGE = "녹화를 취소했어요. 아무것도 보내지 않았어요";
export const MICROPHONE_SILENT_MESSAGE = "목소리가 들리지 않아요. 주소창의 마이크 아이콘에서 마이크를 바꿔 주세요";

export type RecordingPhase = "idle" | "recording" | "stopping";

export type PendingUpload = { localId: string; durationMs: number; progress: number; isFailed: boolean };

type PreparedUpload = {
  capture: CaptureResult;
  rrwebEvents: unknown[];
  contexts: RecordedContext[];
  page: { url: string; title: string };
  viewport: { width: number; height: number };
  // 앞선 업로드 시도에서 서버가 만든 녹화 id. 다시 보낼 때 같은 녹화를 이어 쓴다.
  recordingId: string | null;
  reverifyIssueId: string | null;
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
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const [isMicrophoneSilent, setIsMicrophoneSilent] = useState(false);
  const sessionRef = useRef<CaptureSession | null>(null);
  const stopMicrophoneWatchRef = useRef<(() => void) | null>(null);
  const reverifyIssueIdRef = useRef<string | null>(null);
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

  // 녹화나 업로드가 진행 중이면 고객사 페이지가 새로고침·닫기 전에 확인을 묻게 한다.
  const isBusy = phase !== "idle" || (pendingUpload !== null && !pendingUpload.isFailed);
  useEffect(() => {
    post({ type: "widget:busy", payload: { isBusy } });
  }, [post, isBusy]);

  // 무음 경고를 보여 줄 때는 고객사 페이지가 알약 iframe을 경고 높이만큼 키운다.
  const isWarningVisible = phase === "recording" && isMicrophoneSilent;
  useEffect(() => {
    post({ type: "widget:warning", payload: { isVisible: isWarningVisible } });
  }, [post, isWarningVisible]);

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
        recordingId: prepared.recordingId,
        reverifyIssueId: prepared.reverifyIssueId,
        onProgress: (progress) => setPendingUpload((current) => (current ? { ...current, progress } : current)),
      });
      preparedUploadRef.current = null;
      await handleUploaded();
      setPendingUpload(null);
    } catch (error) {
      if (error instanceof RecordingUploadError && error.recordingId) {
        prepared.recordingId = error.recordingId;
      }
      setPendingUpload((current) => (current ? { ...current, isFailed: true } : current));
      showToast(UPLOAD_FAILED_MESSAGE);
    }
  }, []);

  // 녹화를 멈추고 패널로 돌아간다. 끝내기(업로드)와 취소(버리기)가 함께 쓴다.
  const finishSession = useCallback(async (session: CaptureSession): Promise<CaptureResult> => {
    sessionRef.current = null;
    stopMicrophoneWatchRef.current?.();
    stopMicrophoneWatchRef.current = null;
    setPhase("stopping");
    const { post: postToHost, onModeChange: changeMode } = latestInputRef.current;

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
    setMicrophoneLevel(0);
    setIsMicrophoneSilent(false);
    return capture;
  }, []);

  const stopRecording = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) {
      return;
    }
    const capture = await finishSession(session);
    const currentPage = latestInputRef.current.page;
    const rrwebEvents = rrwebEventsRef.current;
    const contexts = contextsRef.current;
    const meta = findRrwebMeta(rrwebEvents);
    const prepared: PreparedUpload = {
      capture,
      rrwebEvents,
      contexts,
      page: { url: meta?.href ?? currentPage?.url ?? "", title: currentPage?.title ?? "" },
      viewport: getHostViewport(meta, contexts),
      recordingId: null,
      reverifyIssueId: reverifyIssueIdRef.current,
    };
    preparedUploadRef.current = prepared;
    await runUpload(prepared, `local-${capture.t0}`);
  }, [finishSession, runUpload]);

  // 잘못 시작했거나 민감한 화면이 보였을 때: 아무것도 올리지 않고 버린다.
  const cancelRecording = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) {
      return;
    }
    await finishSession(session);
    latestInputRef.current.onToast(CANCELLED_MESSAGE);
  }, [finishSession]);

  // 브라우저는 사용자 클릭 직후에만 화면 공유를 허락하므로, 첫 await가 getDisplayMedia여야 한다.
  // reverifyIssueId를 주면 고친 이슈를 다시 확인하는 녹화로 올린다.
  const startRecording = useCallback(async (options?: { reverifyIssueId?: string | null }) => {
    if (sessionRef.current || phase !== "idle") {
      return;
    }
    reverifyIssueIdRef.current = options?.reverifyIssueId ?? null;
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
      microphoneStream = await requestMicrophone();
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
    // 녹화 중에는 패널(토스트 자리)이 없으므로, 음량과 무음 경고는 알약이 직접 보여 준다.
    setMicrophoneLevel(0);
    setIsMicrophoneSilent(false);
    stopMicrophoneWatchRef.current = watchMicrophone(microphoneStream, {
      onSilent: () => setIsMicrophoneSilent(true),
      onLevel: (level) => {
        setMicrophoneLevel(level);
        if (level > 0) {
          setIsMicrophoneSilent(false);
        }
      },
    });
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
    microphoneLevel,
    isMicrophoneSilent,
    startRecording,
    stopRecording,
    cancelRecording,
    retryUpload,
    handleHostMessage,
  };
}
