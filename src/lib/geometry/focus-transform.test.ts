import { describe, expect, it } from "vitest";
import { getFitTransform, getFocusTransform, toCssTransform, toHighlightStyle } from "@/lib/geometry/focus-transform";

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

  it("창이 이미지보다 납작하면(16:10 이미지, 16:9 창) 영역 중심을 창 높이의 가운데로 옮긴다", () => {
    const aspect = { image: 16 / 10, container: 16 / 9 };
    const heightRatio = aspect.image / aspect.container;
    const transform = getFocusTransform({ x: 0.45, y: 0.45, width: 0.1, height: 0.1 }, aspect);
    expect(transform.scale).toBe(3);
    expect(transform.translateY + 0.5 * transform.scale).toBeCloseTo(heightRatio / 2);
  });

  it("창이 이미지보다 납작해도 아래쪽 가장자리 영역에서 빈 공간이 보이지 않는다", () => {
    const aspect = { image: 16 / 10, container: 16 / 9 };
    const heightRatio = aspect.image / aspect.container;
    const transform = getFocusTransform({ x: 0.4, y: 0.95, width: 0.1, height: 0.05 }, aspect);
    expect(transform.translateY).toBeCloseTo(heightRatio - transform.scale);
  });
});

describe("getFitTransform", () => {
  it("모양이 같으면 그대로 둔다", () => {
    expect(getFitTransform()).toEqual({ scale: 1, translateX: 0, translateY: 0 });
  });

  it("이미지가 창보다 길쭉하면 줄여서 가로 가운데에 둔다", () => {
    const transform = getFitTransform({ image: 16 / 10, container: 16 / 9 });
    expect(transform.scale).toBeCloseTo(0.9);
    expect(transform.translateX).toBeCloseTo(0.05);
    expect(transform.translateY).toBeCloseTo(0);
  });
});

describe("toHighlightStyle", () => {
  it("0~1 좌표를 퍼센트로 바꾸고 범위를 벗어나면 자른다", () => {
    expect(toHighlightStyle({ x: 0.25, y: -0.1, width: 0.5, height: 1.2 })).toEqual({
      left: "25%",
      top: "0%",
      width: "50%",
      height: "100%",
    });
  });
});
