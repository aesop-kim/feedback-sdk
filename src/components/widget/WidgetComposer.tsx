"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { CaptureIcon, CloseIcon, ScreenIcon, SendIcon } from "@/components/widget/WidgetIcons";
import styles from "@/components/widget/WidgetComposer.module.css";

const MAX_TEXTAREA_HEIGHT = 120;
const MAX_MESSAGE_LENGTH = 2000;

type WidgetComposerProps = {
  onSend: (body: string) => void;
  onSendCapture: (body: string) => Promise<boolean>;
  onStartRecording: () => void;
  onStartCapture?: () => void;
  onRemoveCapture: () => void;
  capturePreview: string | null;
  isDisabled: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
};

export function WidgetComposer({
  onSend, onSendCapture, onStartRecording, onStartCapture, onRemoveCapture, capturePreview, isDisabled, inputRef,
}: WidgetComposerProps) {
  const [text, setText] = useState("");
  const [isSendingCapture, setIsSendingCapture] = useState(false);
  const sendingRef = useRef(false);
  const ownTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = inputRef ?? ownTextareaRef;
  const canSend = !isDisabled && !isSendingCapture && (text.trim().length > 0 || capturePreview !== null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [text, textareaRef]);

  const submit = async () => {
    if (!canSend || sendingRef.current) {
      return;
    }
    if (!capturePreview) {
      onSend(text.trim());
      setText("");
      return;
    }
    sendingRef.current = true;
    setIsSendingCapture(true);
    try {
      if (await onSendCapture(text.trim())) {
        setText("");
      }
    } finally {
      sendingRef.current = false;
      setIsSendingCapture(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <>
      {capturePreview ? (
        <div className={styles.capturePreview}>
          {/* eslint-disable-next-line @next/next/no-img-element -- 브라우저 메모리에 있는 첨부 미리보기 */}
          <img src={capturePreview} alt="선택한 화면 캡처 미리보기" />
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => {
              onRemoveCapture();
              textareaRef.current?.focus();
            }}
            disabled={isSendingCapture}
            aria-label="캡처 첨부 제거"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      ) : null}
      <div className={styles.composer}>
        <button type="button" className={styles.iconButton} onClick={onStartRecording} disabled={isDisabled || isSendingCapture} aria-label="화면 녹화">
          <ScreenIcon size={22} />
        </button>
        {onStartCapture ? (
          <button
            type="button"
            className={styles.iconButton}
            onClick={onStartCapture}
            disabled={isDisabled || isSendingCapture}
            aria-label="영역 캡처"
          >
            <CaptureIcon size={22} />
          </button>
        ) : null}
        <div className={styles.field}>
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력해 주세요"
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            aria-label="메시지"
            readOnly={isSendingCapture}
          />
          <button type="button" className={styles.sendButton} onClick={() => void submit()} disabled={!canSend} aria-label="보내기">
            <SendIcon size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
