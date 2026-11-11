"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageList, type PendingText } from "@/components/widget/MessageList";
import { MessageSkeleton } from "@/components/widget/MessageSkeleton";
import { RecordingPill } from "@/components/widget/RecordingPill";
import { WidgetComposer } from "@/components/widget/WidgetComposer";
import { WidgetEmptyState } from "@/components/widget/WidgetEmptyState";
import { WidgetHeader } from "@/components/widget/WidgetHeader";
import { WidgetToast } from "@/components/widget/WidgetToast";
import { useWidgetBridge } from "@/hooks/use-widget-bridge";
import {
  NETWORK_ERROR_MESSAGE,
  isAlreadyAnsweredError,
  useWidgetConversation,
  type HostInit,
} from "@/hooks/use-widget-conversation";
import { MICROPHONE_SILENT_MESSAGE, useWidgetRecording } from "@/hooks/use-widget-recording";
import type { HostToWidgetMessage } from "@/sdk/bridge-protocol";
import styles from "@/components/widget/WidgetApp.module.css";

const TOAST_DURATION_MS = 3_000;
// 해결 방법까지 적은 긴 안내는 3초 안에 다 읽기 어렵다.
const LONG_TOAST_DURATION_MS = 5_000;
const LONG_TOAST_LENGTH = 25;
const SEND_FAILED_MESSAGE = "메시지를 보내지 못했어요. 말풍선 아래 ‘다시 보내기’를 눌러 주세요";
const ALREADY_ANSWERED_MESSAGE = "이미 답한 질문이에요";
const LOAD_FAILED_DESCRIPTION = "연결이 잠깐 끊겼어요. 다시 불러와 볼게요";

// 서버가 알려 준 이유(허용되지 않은 사이트 등)는 그대로, 네트워크 문제는 다시 불러오기를 권한다.
function getLoadErrorDescription(errorMessage: string | null): string {
  if (!errorMessage || errorMessage === NETWORK_ERROR_MESSAGE) {
    return LOAD_FAILED_DESCRIPTION;
  }
  return errorMessage;
}

type WidgetAppProps = { projectKey: string; maxDurationMs: number };

export function WidgetApp({ projectKey, maxDurationMs }: WidgetAppProps) {
  const [init, setInit] = useState<HostInit | null>(null);
  const [hostOrigin, setHostOrigin] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pendingTexts, setPendingTexts] = useState<PendingText[]>([]);
  const toastTimerRef = useRef<number | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const recordingMessageHandlerRef = useRef<(message: HostToWidgetMessage) => void>(() => undefined);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    const duration = message.length > LONG_TOAST_LENGTH ? LONG_TOAST_DURATION_MS : TOAST_DURATION_MS;
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), duration);
  }, []);

  const handleHostMessage = useCallback(
    (message: HostToWidgetMessage, origin: string) => {
      switch (message.type) {
        case "host:init":
          if (message.payload.projectKey !== projectKey) {
            return;
          }
          setHostOrigin((current) => current ?? origin);
          setInit((current) => current ?? message.payload);
          return;
        case "host:visibility":
          setIsOpen(message.payload.open);
          // 런처로 열면 키보드 사용자가 고객사 페이지를 다시 지나지 않게 바로 입력창에 둔다.
          if (message.payload.open) {
            requestAnimationFrame(() => composerInputRef.current?.focus());
          }
          return;
        default:
          recordingMessageHandlerRef.current(message);
      }
    },
    [projectKey],
  );

  const { post } = useWidgetBridge(handleHostMessage);

  const handleUnreadChange = useCallback((count: number) => post({ type: "widget:unread", payload: { count } }), [post]);

  const conversation = useWidgetConversation({ init, hostOrigin, isOpen, onUnreadChange: handleUnreadChange });
  const { refetch } = conversation;

  const handleModeChange = useCallback((mode: "open" | "recording") => {
    if (mode === "open") {
      setIsOpen(true);
    }
  }, []);

  const recording = useWidgetRecording({
    post,
    conversationToken: conversation.session?.conversationToken ?? null,
    page: init?.page ?? null,
    onToast: showToast,
    onModeChange: handleModeChange,
    onUploaded: refetch,
    maxDurationMs,
  });

  useEffect(() => {
    recordingMessageHandlerRef.current = recording.handleHostMessage;
  }, [recording.handleHostMessage]);

  useEffect(
    () => () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    },
    [],
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    post({ type: "widget:mode", payload: { mode: "closed" } });
  }, [post]);

  // Escape로 닫는다. 녹화 중에는 알약만 보이므로 무시한다.
  const isRecordingIdle = recording.phase === "idle";
  useEffect(() => {
    if (!isOpen || !isRecordingIdle) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.isComposing) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isRecordingIdle, handleClose]);

  const { sendText } = conversation;
  // 보내지 못한 글은 지우지 않고 실패한 말풍선으로 남겨 '다시 보내기'로 같은 글을 다시 보낸다.
  const deliverText = (localId: string, body: string) => {
    sendText(body)
      .then(() => setPendingTexts((current) => current.filter((pendingText) => pendingText.localId !== localId)))
      .catch(() => {
        setPendingTexts((current) =>
          current.map((pendingText) => (pendingText.localId === localId ? { ...pendingText, isFailed: true } : pendingText)),
        );
        showToast(SEND_FAILED_MESSAGE);
      });
  };

  const handleSendText = (body: string) => {
    const localId = `pending-${Date.now()}`;
    setPendingTexts((current) => [...current, { localId, body, isFailed: false }]);
    deliverText(localId, body);
  };

  const handleRetryText = (localId: string) => {
    const failedText = pendingTexts.find((pendingText) => pendingText.localId === localId);
    if (!failedText) {
      return;
    }
    setPendingTexts((current) =>
      current.map((pendingText) => (pendingText.localId === localId ? { ...pendingText, isFailed: false } : pendingText)),
    );
    deliverText(localId, failedText.body);
  };

  const handleAnswer = async (cardId: string, answer: { optionId?: string; text?: string }) => {
    try {
      await conversation.answerClarification(cardId, answer);
    } catch (error) {
      showToast(isAlreadyAnsweredError(error) ? ALREADY_ANSWERED_MESSAGE : NETWORK_ERROR_MESSAGE);
    }
  };

  const handleStartRecording = () => {
    void recording.startRecording();
  };

  const handleStartReverify = (issueId: string | null) => {
    void recording.startRecording({ reverifyIssueId: issueId });
  };

  if (recording.phase !== "idle") {
    return (
      <RecordingPill
        elapsedMs={recording.elapsedMs}
        maxDurationMs={recording.maxDurationMs}
        isStopping={recording.phase === "stopping"}
        microphoneLevel={recording.microphoneLevel}
        warning={recording.isMicrophoneSilent ? MICROPHONE_SILENT_MESSAGE : null}
        onStop={() => void recording.stopRecording()}
        onCancel={() => void recording.cancelRecording()}
      />
    );
  }

  const isReady = conversation.status === "ready";
  const hasMessages = conversation.messages.length > 0 || pendingTexts.length > 0 || recording.pendingUpload !== null;

  return (
    <main className={styles.panel}>
      <WidgetHeader
        projectName={conversation.session?.projectName ?? ""}
        userName={conversation.session?.endUserName || init?.user.name || ""}
        isCompact={isReady && hasMessages}
        onClose={handleClose}
      />
      <div className={styles.body} data-widget-scroll="">
        {conversation.status === "loading" ? <MessageSkeleton /> : null}
        {conversation.status === "error" ? (
          <section className={styles.errorState}>
            <p className={styles.errorTitle}>지금은 위젯을 열 수 없어요</p>
            <p className={styles.errorDescription}>{getLoadErrorDescription(conversation.errorMessage)}</p>
            <button type="button" className={styles.reloadButton} onClick={conversation.reload}>
              다시 불러오기
            </button>
          </section>
        ) : null}
        {isReady && !hasMessages ? <WidgetEmptyState onStartRecording={handleStartRecording} isRecordingDisabled={false} /> : null}
        {isReady && hasMessages ? (
          <MessageList
            messages={conversation.messages}
            reverifyRequest={conversation.reverifyRequest}
            pendingTexts={pendingTexts}
            pendingUpload={recording.pendingUpload}
            onAnswer={handleAnswer}
            onRetryText={handleRetryText}
            onStartReverify={handleStartReverify}
            onRetryUpload={recording.retryUpload}
            onStartRecording={handleStartRecording}
          />
        ) : null}
      </div>
      <div className={styles.footer}>
        <WidgetToast message={toastMessage} />
        <WidgetComposer
          onSend={handleSendText}
          onStartRecording={handleStartRecording}
          isDisabled={!isReady}
          inputRef={composerInputRef}
        />
      </div>
    </main>
  );
}
