"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { AdminButton } from "@/components/admin/AdminButton";
import styles from "@/components/admin/ReplyComposer.module.css";
import { useAdminRequest } from "@/hooks/use-admin-request";
import { useAdminRevision } from "@/hooks/use-admin-revision";

const MAX_TEXTAREA_HEIGHT = 160;
// 서버 검증(api-schemas의 MAX_MESSAGE_LENGTH)과 같은 한도. 한도에 가까워지면 글자 수를 보여 준다.
// 클라이언트 번들에 zod를 끌어오지 않으려고 위젯처럼 값을 따로 둔다.
const MAX_REPLY_LENGTH = 2000;
const COUNTER_VISIBLE_LENGTH = 1800;

export function ReplyComposer({ conversationId, customerName }: { conversationId: string; customerName: string }) {
  const request = useAdminRequest();
  const { refresh } = useAdminRevision();
  const textareaId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canSend = body.trim().length > 0 && !isSending;
  const isNearLimit = body.length >= COUNTER_VISIBLE_LENGTH;

  function resizeTextarea() {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }

  async function sendReply() {
    if (!canSend) {
      return;
    }
    setIsSending(true);
    setErrorMessage(null);
    const result = await request(`/api/admin/conversations/${conversationId}/messages`, {
      method: "POST",
      body: { body: body.trim() },
    });
    setIsSending(false);
    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }
    setBody("");
    requestAnimationFrame(resizeTextarea);
    refresh();
    textareaRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // 한글 조합 중 Enter는 글자 확정용이라 보내지 않는다.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendReply();
    }
  }

  return (
    <div className={styles.composer}>
      <div className={styles.box}>
        <label htmlFor={textareaId} className={styles.visuallyHidden}>
          {customerName} 님에게 답장
        </label>
        <textarea
          id={textareaId}
          ref={textareaRef}
          className={styles.textarea}
          rows={1}
          value={body}
          placeholder={`${customerName} 님에게 답장하기`}
          onChange={(event) => {
            setBody(event.target.value);
            resizeTextarea();
          }}
          onKeyDown={handleKeyDown}
          maxLength={MAX_REPLY_LENGTH}
        />
        <AdminButton size="small" onClick={() => void sendReply()} disabled={!canSend} isLoading={isSending}>
          보내기
        </AdminButton>
      </div>
      <div className={styles.footer}>
        <p className={errorMessage ? styles.error : styles.hint} role={errorMessage ? "alert" : undefined}>
          {errorMessage ?? getHintText(body.length)}
        </p>
        {isNearLimit ? (
          <span className={body.length >= MAX_REPLY_LENGTH ? `${styles.counter} ${styles.counterFull}` : styles.counter}>
            {body.length}/{MAX_REPLY_LENGTH}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function getHintText(length: number): string {
  if (length >= MAX_REPLY_LENGTH) {
    return `${MAX_REPLY_LENGTH}자까지 보낼 수 있어요`;
  }
  return "Enter로 보내고, Shift + Enter로 줄을 바꿔요";
}
