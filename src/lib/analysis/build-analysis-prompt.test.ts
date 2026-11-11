import { describe, expect, it } from "vitest";
import { buildAnalysisPrompt } from "@/lib/analysis/build-analysis-prompt";

const BASE = {
  context: { segments: [], frames: [] },
  framesDirectory: "/tmp/frames",
  pageUrl: "https://example.com/",
  pageTitle: "예시",
  viewport: { width: 1440, height: 900 },
};

describe("buildAnalysisPrompt", () => {
  it("재확인 녹화면 원래 이슈와 되묻지 말라는 규칙을 넣는다 (V4-06)", () => {
    const prompt = buildAnalysisPrompt({ ...BASE, reverifyIssue: { title: "계약서 등록 버튼 무반응", summary: "버튼을 눌러도 반응이 없어요." } });
    expect(prompt).toContain("## 다시 확인 녹화");
    expect(prompt).toContain("- 원래 이슈: 계약서 등록 버튼 무반응");
    expect(prompt).toContain("- 원래 내용: 버튼을 눌러도 반응이 없어요.");
    expect(prompt).toContain('confidence는 모두 "clear"');
  });

  it("일반 녹화에는 재확인 안내가 없다", () => {
    expect(buildAnalysisPrompt(BASE)).not.toContain("다시 확인 녹화");
    expect(buildAnalysisPrompt({ ...BASE, reverifyIssue: null })).not.toContain("다시 확인 녹화");
  });
});
