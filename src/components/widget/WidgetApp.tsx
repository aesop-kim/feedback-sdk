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
import { NETWORK_ERROR_MESSAGE, useWidgetConversation, type HostInit } from "@/hooks/use-widget-conversation";
import { useWidgetRecording } from "@/hooks/use-widget-recording";
import type { HostToWidgetMessage } from "@/sdk/bridge-protocol";
import styles from "@/components/widget/WidgetApp.module.css";

const TOAST_DURATION_MS = 3_000;

type WidgetAppProps = { projectKey: string };

export function WidgetApp({ projectKey }: WidgetAppProps) {
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
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
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
  const handleSendText = (body: string) => {
    const localId = `pending-${Date.now()}`;
    setPendingTexts((current) => [...current, { localId, body }]);
    sendText(body)
      .catch(() => showToast(NETWORK_ERROR_MESSAGE))
      .finally(() => setPendingTexts((current) => current.filter((pendingText) => pendingText.localId !== localId)));
  };

  const handleAnswer = async (cardId: string, answer: { optionId?: string; text?: string }) => {
    try {
      await conversation.answerClarification(cardId, answer);
    } catch {
      showToast(NETWORK_ERROR_MESSAGE);
    }
  };

  const handleStartRecording = () => {
    void recording.startRecording();
  };

  if (recording.phase !== "idle") {
    return (
      <RecordingPill
        elapsedMs={recording.elapsedMs}
        maxDurationMs={recording.maxDurationMs}
        isStopping={recording.phase === "stopping"}
        onStop={() => void recording.stopRecording()}
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
        onClose={handleClose}
      />
      <div className={styles.body} data-widget-scroll="">
        {conversation.status === "loading" ? <MessageSkeleton /> : null}
        {conversation.status === "error" ? (
          <section className={styles.errorState}>
            <p className={styles.errorTitle}>지금은 위젯을 열 수 없어요</p>
            <p className={styles.errorDescription}>{conversation.errorMessage ?? NETWORK_ERROR_MESSAGE}</p>
          </section>
        ) : null}
        {isReady && !hasMessages ? <WidgetEmptyState onStartRecording={handleStartRecording} isRecordingDisabled={false} /> : null}
        {isReady && hasMessages ? (
          <MessageList
            messages={conversation.messages}
            pendingTexts={pendingTexts}
            pendingUpload={recording.pendingUpload}
            onAnswer={handleAnswer}
            onRetryUpload={recording.retryUpload}
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
