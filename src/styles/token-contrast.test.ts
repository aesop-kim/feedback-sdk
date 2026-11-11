import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// tokens.css의 실제 값으로 글자/면 조합의 WCAG 대비를 계산한다. 토큰 값을 바꾸면 여기서 바로 걸린다.
const TOKENS_CSS = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");
const MIN_TEXT_CONTRAST = 4.5;

type Rgba = { red: number; green: number; blue: number; alpha: number };

function getTokenValue(name: string): string {
  const match = TOKENS_CSS.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) {
    throw new Error(`토큰이 없어요: --${name}`);
  }
  return match[1].trim();
}

function getTokenColor(name: string): Rgba {
  const value = getTokenValue(name);
  const reference = value.match(/^var\(--([\w-]+)\)$/);
  if (reference) {
    return getTokenColor(reference[1]);
  }
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const [red, green, blue] = [0, 2, 4].map((offset) => parseInt(hex[1].slice(offset, offset + 2), 16));
    return { red, green, blue, alpha: 1 };
  }
  const rgba = value.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  if (rgba) {
    return { red: Number(rgba[1]), green: Number(rgba[2]), blue: Number(rgba[3]), alpha: Number(rgba[4]) };
  }
  throw new Error(`색으로 읽을 수 없어요: --${name} = ${value}`);
}

// 반투명 색은 아래 면 위에 얹은 결과로 바꾼다.
function flatten(color: Rgba, base: Rgba): Rgba {
  const mix = (top: number, bottom: number) => top * color.alpha + bottom * (1 - color.alpha);
  return { red: mix(color.red, base.red), green: mix(color.green, base.green), blue: mix(color.blue, base.blue), alpha: 1 };
}

function getRelativeLuminance({ red, green, blue }: Rgba): number {
  const [linearRed, linearGreen, linearBlue] = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linearRed + 0.7152 * linearGreen + 0.0722 * linearBlue;
}

function getContrastRatio(foreground: Rgba, background: Rgba): number {
  const lighter = Math.max(getRelativeLuminance(foreground), getRelativeLuminance(background));
  const darker = Math.min(getRelativeLuminance(foreground), getRelativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

// [글자 토큰, 면 토큰(위에서 아래 순서로 겹친다), 쓰는 곳]
const TEXT_PAIRS: [string, string[], string][] = [
  ["text-primary", ["bg"], "본문"],
  ["text-secondary", ["grey-100"], "보조 글자(회색 면)"],
  ["text-tertiary", ["bg"], "캡션·시각·힌트"],
  ["text-tertiary", ["grey-50"], "옅은 면 위 캡션"],
  ["text-tertiary", ["grey-100"], "녹화 카드 상태, 회색 배지"],
  ["text-tertiary", ["bg-screen"], "관리자 바탕 위 캡션"],
  ["text-placeholder", ["bg"], "입력창 placeholder(흰 면)"],
  ["text-placeholder", ["grey-50"], "질문 초안 캡션"],
  ["text-placeholder", ["grey-100"], "입력창 placeholder(회색 면)"],
  ["bg", ["blue-500"], "고객 말풍선, 보내기, 런처 배지 외 주 버튼"],
  ["white-alpha-900", ["blue-500"], "주 버튼 글자"],
  ["bg", ["blue-600"], "주 버튼 hover"],
  ["blue-500", ["bg"], "파란 글자 링크"],
  ["accent-weak-text", ["accent-weak-bg", "bg"], "weak 버튼(흰 면)"],
  ["accent-weak-text", ["accent-weak-bg", "grey-100"], "다시 보내기(회색 카드)"],
  ["blue-600", ["blue-50"], "물어봤어요 배지"],
  ["danger", ["bg"], "오류 글자"],
  ["danger", ["grey-100"], "회색 카드 위 오류 글자"],
  ["bg", ["red-500"], "런처 안 읽음 배지"],
  ["green-700", ["bg"], "고객 답변 라벨"],
  ["green-700", ["green-50"], "답변 받음 배지"],
  ["orange-700", ["orange-50"], "확인 필요 배지"],
  ["bg", ["grey-800"], "토스트"],
  ["grey-400", ["grey-900"], "녹화 알약 제한 시간"],
  ["bg", ["white-alpha-200", "grey-900"], "녹화 알약 버튼"],
];

function getLayeredBackground(layers: string[]): Rgba {
  return layers.reduceRight<Rgba | null>((below, name) => {
    const color = getTokenColor(name);
    return below ? flatten(color, below) : color;
  }, null) as Rgba;
}

describe("토큰 글자 대비", () => {
  it.each(TEXT_PAIRS)("%s / %j (%s)는 4.5:1 이상이다", (foregroundName, backgroundLayers) => {
    const background = getLayeredBackground(backgroundLayers);
    const foreground = flatten(getTokenColor(foregroundName), background);
    expect(getContrastRatio(foreground, background)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it("계산식은 WCAG 예시와 같다", () => {
    const white = { red: 255, green: 255, blue: 255, alpha: 1 };
    const black = { red: 0, green: 0, blue: 0, alpha: 1 };
    expect(getContrastRatio(white, black)).toBeCloseTo(21, 5);
  });
});
