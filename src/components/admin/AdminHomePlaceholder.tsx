"use client";

import { useState } from "react";
import { AdminButton } from "@/components/admin/AdminButton";
import styles from "@/components/admin/AdminHomePlaceholder.module.css";
import { useAdminConversationList } from "@/hooks/use-admin-conversation-list";

const SDK_ORIGIN = process.env.NEXT_PUBLIC_SDK_ORIGIN ?? "http://localhost:3000";

// 프로젝트 키는 관리자가 보고 있는 프로젝트의 실제 값을 넣는다. 고객 ID·이름은 고객사가 채운다.
function getInstallSnippet(projectKey: string | null): string {
  return [
    `<script src="${SDK_ORIGIN}/sdk.js"></script>`,
    "<script>",
    "  Feedback.init({",
    `    projectKey: "${projectKey ?? "<프로젝트 키>"}",`,
    '    user: { id: "<고객 ID>", name: "<고객 이름>" },',
    "  });",
    "</script>",
  ].join("\n");
}

// 대화를 고르기 전 가운데 칸. 받은 의견이 하나도 없으면 고르라는 말 대신 위젯 설치 방법을 보여 준다.
export function AdminHomePlaceholder() {
  const { conversationCount, projectKey } = useAdminConversationList();

  if (conversationCount === 0) {
    return <InstallGuide projectKey={projectKey} />;
  }
  // 대화를 고르기 전에는 이 안내가 페이지의 주 내용이라 main과 h1을 여기에 둔다(V3-04).
  return (
    <main className={styles.placeholder}>
      <h1 className={styles.title}>의견을 골라 주세요</h1>
      <p className={styles.caption}>왼쪽 목록에서 의견을 고르면 주고받은 메시지와 녹화 분석을 함께 볼 수 있어요.</p>
    </main>
  );
}

function InstallGuide({ projectKey }: { projectKey: string | null }) {
  const [isCopied, setIsCopied] = useState(false);
  const installSnippet = getInstallSnippet(projectKey);

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(installSnippet);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1500);
    } catch {
      setIsCopied(false);
    }
  }

  return (
    <main className={styles.placeholder}>
      <h1 className={styles.title}>아직 받은 의견이 없어요</h1>
      <p className={styles.caption}>고객사 페이지에 아래 코드를 넣으면 위젯이 떠요</p>
      {projectKey ? (
        <p className={styles.caption}>
          프로젝트 키 <code className={styles.projectKey}>{projectKey}</code>
        </p>
      ) : null}
      <pre className={styles.snippet}>
        <code>{installSnippet}</code>
      </pre>
      <AdminButton variant="weak" size="small" onClick={() => void copySnippet()}>
        {isCopied ? "복사했어요" : "코드 복사하기"}
      </AdminButton>
      <span className={styles.visuallyHidden} role="status">
        {isCopied ? "설치 코드를 복사했어요" : ""}
      </span>
    </main>
  );
}
