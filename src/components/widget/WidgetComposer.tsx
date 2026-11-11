"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { ScreenIcon, SendIcon } from "@/components/widget/WidgetIcons";
import styles from "@/components/widget/WidgetComposer.module.css";

const MAX_TEXTAREA_HEIGHT = 120;
const MAX_MESSAGE_LENGTH = 2000;

type WidgetComposerProps = {
  onSend: (body: string) => void;
  onStartRecording: () => void;
  isDisabled: boolean;
};

export function WidgetComposer({ onSend, onStartRecording, isDisabled }: WidgetComposerProps) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !isDisabled && text.trim().length > 0;

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [text]);

  const submit = () => {
    if (!canSend) {
      return;
    }
    onSend(text.trim());
    setText("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className={styles.composer}>
      <button type="button" className={styles.iconButton} onClick={onStartRecording} disabled={isDisabled} aria-label="화면 녹화">
        <ScreenIcon size={22} />
      </button>
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
        />
        <button type="button" className={styles.sendButton} onClick={submit} disabled={!canSend} aria-label="보내기">
          <SendIcon size={18} />
        </button>
      </div>
    </div>
  );
}
