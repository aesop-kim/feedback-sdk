import { describe, expect, it } from "vitest";
import { findNextRadioIndex } from "@/lib/widget/radio-navigation";

describe("findNextRadioIndex", () => {
  it("아래·오른쪽 방향키는 다음 보기로, 끝에서는 처음으로 간다", () => {
    expect(findNextRadioIndex("ArrowDown", 0, 4)).toBe(1);
    expect(findNextRadioIndex("ArrowRight", 3, 4)).toBe(0);
  });

  it("위·왼쪽 방향키는 이전 보기로, 처음에서는 끝으로 간다", () => {
    expect(findNextRadioIndex("ArrowUp", 2, 4)).toBe(1);
    expect(findNextRadioIndex("ArrowLeft", 0, 4)).toBe(3);
  });

  it("Home/End는 처음과 끝", () => {
    expect(findNextRadioIndex("Home", 2, 4)).toBe(0);
    expect(findNextRadioIndex("End", 0, 4)).toBe(3);
  });

  it("다른 키나 빈 목록은 null", () => {
    expect(findNextRadioIndex("Enter", 1, 4)).toBeNull();
    expect(findNextRadioIndex("ArrowDown", 0, 0)).toBeNull();
  });
});
