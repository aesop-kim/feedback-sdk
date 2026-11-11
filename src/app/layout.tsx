import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "@/styles/tokens.css";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "래티스 피드백",
  description: "화면을 보여주며 말로 남기는 피드백",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
