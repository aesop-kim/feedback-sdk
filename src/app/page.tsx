import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "96px 20px" }}>
      <p style={{ color: "var(--grey-600)", fontSize: "var(--fs-t6)", margin: 0 }}>래티스 피드백 SDK</p>
      <h1 style={{ fontSize: "var(--fs-t2)", lineHeight: "var(--lh-t2)", margin: "8px 0 16px", fontWeight: 700 }}>
        화면을 보여주며 말로 남기는 피드백
      </h1>
      <p style={{ color: "var(--grey-700)", lineHeight: 1.7, margin: "0 0 32px" }}>
        고객사 페이지에 스크립트 한 줄을 넣으면 채팅 위젯이 열려요. 고객은 화면을 녹화하며 설명하고, 관리자는 정리된 이슈로 받아요.
      </p>
      <Link href="/admin" style={{ color: "var(--blue-500)", fontWeight: 600 }}>
        관리자 화면으로 가기
      </Link>
    </main>
  );
}
