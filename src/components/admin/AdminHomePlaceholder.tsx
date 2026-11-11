"use client";

import { useState } from "react";
import { AdminButton } from "@/components/admin/AdminButton";
import styles from "@/components/admin/AdminHomePlaceholder.module.css";
import { useAdminConversationList } from "@/hooks/use-admin-conversation-list";

const SDK_ORIGIN = process.env.NEXT_PUBLIC_SDK_ORIGIN ?? "http://localhost:3000";
const INSTALL_SNIPPET = [
  `<script src="${SDK_ORIGIN}/sdk.js"></script>`,
  `<script>Feedback.init({ projectKey: "<프로젝트 키>", user: { id: "<고객 ID>", name: "<고객 이름>" } });</script>`,
].join("\n");

// 대화를 고르기 전 가운데 칸. 받은 의견이 하나도 없으면 고르라는 말 대신 위젯 설치 방법을 보여 준다.
export function AdminHomePlaceholder() {
  const { conversationCount } = useAdminConversationList();

  if (conversationCount === 0) {
    return <InstallGuide />;
  }
  return (
    <section className={styles.placeholder}>
      <p className={styles.title}>의견을 골라 주세요</p>
      <p className={styles.caption}>왼쪽 목록에서 의견을 고르면 주고받은 메시지와 녹화 분석을 함께 볼 수 있어요.</p>
    </section>
  );
}

function InstallGuide() {
  const [isCopied, setIsCopied] = useState(false);

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(INSTALL_SNIPPET);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      setIsCopied(false);
    }
  }

  return (
    <section className={styles.placeholder}>
      <p className={styles.title}>아직 받은 의견이 없어요</p>
      <p className={styles.caption}>고객사 페이지에 아래 두 줄을 넣으면 위젯이 떠요</p>
      <pre className={styles.snippet}>
        <code>{INSTALL_SNIPPET}</code>
      </pre>
      <AdminButton variant="weak" size="small" onClick={() => void copySnippet()}>
        {isCopied ? "복사했어요" : "코드 복사하기"}
      </AdminButton>
      <span className={styles.visuallyHidden} role="status">
        {isCopied ? "설치 코드를 복사했어요" : ""}
      </span>
    </section>
  );
}
