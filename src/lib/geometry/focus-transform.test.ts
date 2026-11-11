import { describe, expect, it } from "vitest";
import { getFocusTransform, toCssTransform } from "@/lib/geometry/focus-transform";

describe("getFocusTransform", () => {
  it("하이라이트가 없으면 확대하지 않는다", () => {
    expect(getFocusTransform(null)).toEqual({ scale: 1, translateX: 0, translateY: 0 });
  });

  it("작은 영역은 최대 3배까지만 확대한다", () => {
    expect(getFocusTransform({ x: 0.4, y: 0.4, width: 0.05, height: 0.03 }).scale).toBe(3);
  });

  it("큰 영역은 확대하지 않는다", () => {
    expect(getFocusTransform({ x: 0, y: 0, width: 0.8, height: 0.5 }).scale).toBe(1);
  });

  it("가운데 영역은 중심이 화면 가운데로 온다", () => {
    const transform = getFocusTransform({ x: 0.45, y: 0.45, width: 0.1, height: 0.1 });
    expect(transform.scale).toBe(3);
    expect(0.5 * transform.scale + transform.translateX).toBeCloseTo(0.5);
  });

  it("가장자리 영역은 이미지 바깥이 보이지 않게 고정한다", () => {
    const transform = getFocusTransform({ x: 0.9, y: 0.0, width: 0.1, height: 0.05 });
    expect(transform.translateX).toBeCloseTo(1 - transform.scale);
    expect(transform.translateY).toBe(0);
  });

  it("CSS transform 문자열을 만든다", () => {
    expect(toCssTransform({ scale: 2, translateX: -0.5, translateY: 0 })).toBe("translate(-50%, 0%) scale(2)");
  });
});
