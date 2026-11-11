// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { findElementAtPoint, getElementContext, getElementSelector } from "@/sdk/element-context";

function getRequiredElement(selector: string): Element {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`테스트용 요소가 없어요: ${selector}`);
  }
  return element;
}

describe("element-context", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <header id="top"><button aria-label="메뉴 열기"></button></header>
      <main>
        <section>
          <ul>
            <li>첫째</li>
            <li><a href="#">둘째 <b>링크</b></a></li>
          </ul>
        </section>
        <section>
          <button data-testid="checkout">  결제
            하기  </button>
        </section>
      </main>`;
  });

  it("id가 있으면 #id를 쓴다", () => {
    expect(getElementSelector(getRequiredElement("#top"))).toBe("#top");
  });

  it("자동 생성된 id는 쓰지 않는다", () => {
    document.body.innerHTML = `<div id="radix-_r_0_"><button>열기</button></div><div><button>닫기</button></div>`;
    expect(getElementSelector(getRequiredElement("button"))).not.toContain("radix");
  });

  it("data-testid가 있으면 그 속성을 쓴다", () => {
    expect(getElementSelector(getRequiredElement("button[data-testid]"))).toBe('[data-testid="checkout"]');
  });

  it("id 가진 조상이 있으면 거기서 경로를 끊는다", () => {
    expect(getElementSelector(getRequiredElement("#top button"))).toBe("#top > button");
  });

  it("그 외에는 nth-of-type 사슬로 유일한 경로를 만든다", () => {
    const element = getRequiredElement("li:nth-of-type(2) a");
    const selector = getElementSelector(element);
    expect(document.querySelectorAll(selector)).toHaveLength(1);
    expect(document.querySelector(selector)).toBe(element);
    expect(selector.split(" > ").length).toBeLessThanOrEqual(5);
  });

  it("형제 사이에서 클래스로 구별되면 읽기 쉬운 태그.클래스를 쓴다", () => {
    document.body.innerHTML = `
      <div class="_titleSection_1dv6w_41">
        <p class="_title_1dv6w_41 rr-block">전체 계약서</p>
        <p class="_count_1dv6w_50">60</p>
      </div>
      <div class="_titleSection_1dv6w_41"><p class="_title_1dv6w_41">다른 제목</p></div>`;
    const element = getRequiredElement("p._title_1dv6w_41");
    const selector = getElementSelector(element);
    expect(selector).toContain("p._title_1dv6w_41");
    expect(selector).not.toContain("rr-block");
    expect(document.querySelector(selector)).toBe(element);
  });

  it("글자는 공백을 정리하고, 없으면 aria-label을 쓴다", () => {
    expect(getElementContext(getRequiredElement("[data-testid=checkout]")).text).toBe("결제 하기");
    expect(getElementContext(getRequiredElement("#top button")).text).toBe("메뉴 열기");
  });

  it("글자는 80자까지만 담는다", () => {
    document.body.innerHTML = `<p>${"가".repeat(200)}</p>`;
    expect(getElementContext(getRequiredElement("p")).text).toHaveLength(80);
  });

  it("태그 이름, 위치, 화면 크기를 담는다", () => {
    const context = getElementContext(getRequiredElement("[data-testid=checkout]"));
    expect(context.tagName).toBe("button");
    expect(context.rect).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(context.viewport).toEqual({ width: window.innerWidth, height: window.innerHeight });
  });

  it("좌표로 요소를 찾는다", () => {
    const target = getRequiredElement("#top");
    const fakeDocument = { elementFromPoint: (x: number, y: number) => (x === 10 && y === 20 ? target : null) } as unknown as Document;
    expect(findElementAtPoint(10, 20, fakeDocument)).toBe(target);
    expect(findElementAtPoint(0, 0, fakeDocument)).toBeNull();
  });
});
