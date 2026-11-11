import type { Metadata } from "next";
import { WidgetApp } from "@/components/widget/WidgetApp";
import { getMaxRecordingMs } from "@/lib/recording/get-max-recording-ms";

export const metadata: Metadata = {
  title: "피드백 보내기",
  robots: { index: false, follow: false },
};

type WidgetPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// 고객사 페이지의 sdk.js가 띄우는 iframe. 실제 내용은 host:init을 받은 뒤 클라이언트에서 그린다.
export default async function WidgetPage({ searchParams }: WidgetPageProps) {
  const { projectKey, maxRecordingMs } = await searchParams;
  const maxDurationMs = getMaxRecordingMs(typeof maxRecordingMs === "string" ? maxRecordingMs : undefined, process.env.NODE_ENV === "production");
  return <WidgetApp projectKey={typeof projectKey === "string" ? projectKey : ""} maxDurationMs={maxDurationMs} />;
}
