"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { AdminButton } from "@/components/admin/AdminButton";
import { LatticeMark } from "@/components/admin/LatticeMark";
import styles from "@/components/admin/AdminLoginForm.module.css";

const WRONG_PASSWORD_MESSAGE = "비밀번호가 맞지 않아요";
const NETWORK_ERROR_MESSAGE = "연결이 잠깐 불안정해요. 잠시 후 다시 해볼까요?";

export function AdminLoginForm() {
  const router = useRouter();
  const passwordId = useId();
  const errorId = useId();
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setErrorMessage(response.status === 401 || response.status === 400 ? WRONG_PASSWORD_MESSAGE : NETWORK_ERROR_MESSAGE);
        setIsSubmitting(false);
        return;
      }
      router.replace("/admin");
    } catch {
      setErrorMessage(NETWORK_ERROR_MESSAGE);
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <div className={styles.brand}>
        <LatticeMark />
        <span className={styles.caption}>래티스 피드백</span>
      </div>
      <h1 className={styles.title}>관리자 로그인</h1>
      <label className={styles.label} htmlFor={passwordId}>
        비밀번호
      </label>
      <input
        id={passwordId}
        className={styles.input}
        type="password"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setErrorMessage(null);
        }}
        aria-invalid={errorMessage === WRONG_PASSWORD_MESSAGE}
        aria-describedby={errorMessage ? errorId : undefined}
        placeholder="비밀번호를 입력해 주세요"
      />
      <p id={errorId} className={styles.error} role="alert">
        {errorMessage}
      </p>
      <AdminButton type="submit" size="large" isBlock isLoading={isSubmitting} disabled={!password}>
        로그인하기
      </AdminButton>
    </form>
  );
}
