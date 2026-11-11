import { describe, expect, it } from "vitest";
import { getIssueStatusMessage } from "@/lib/feedback/issue-status-message";

describe("getIssueStatusMessage", () => {
  it("반영 완료는 다시 확인을 부탁한다", () => {
    expect(getIssueStatusMessage("resolved", "버튼 무반응")).toEqual({
      body: "‘버튼 무반응’ 수정을 반영했어요. 같은 화면에서 한 번 더 확인해 주세요.",
      preview: "수정을 반영했어요",
    });
  });

  it("해결됨은 확인해 준 고객에게 끝났다고 알린다", () => {
    expect(getIssueStatusMessage("closed", "버튼 무반응")).toEqual({
      body: "‘버튼 무반응’ 확인해 주셔서 고마워요. 해결로 정리했어요.",
      preview: "해결로 정리했어요",
    });
  });

  it("다시 열기는 아직 남아 있어서 다시 고친다고 알린다", () => {
    expect(getIssueStatusMessage("open", "버튼 무반응")).toEqual({
      body: "‘버튼 무반응’ 아직 남아 있는 걸 확인했어요. 다시 고칠게요.",
      preview: "다시 고칠게요",
    });
  });
});
