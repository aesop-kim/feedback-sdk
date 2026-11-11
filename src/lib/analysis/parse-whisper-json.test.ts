import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_SEGMENT_MS, parseWhisperJson } from "@/lib/analysis/parse-whisper-json";

// whisper-cli -l ko -ojf 로 만든 실제 결과(say -v Yuna TTS)를 다듬은 샘플. 한글이 토큰 사이에서 바이트 단위로 잘려 있다.
const SAMPLE_PATH = fileURLToPath(new URL("./fixtures/whisper-ko-sample.json", import.meta.url));

function toBytes(value: unknown): Uint8Array {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function token(text: string, from: number, to: number) {
  return { text, offsets: { from, to } };
}

describe("parseWhisperJson", () => {
  it("실제 샘플에서 잘린 한글 바이트를 이어 붙여 단어를 만든다", () => {
    const { words, segments } = parseWhisperJson(readFileSync(SAMPLE_PATH));
    const texts = words.map((word) => word.text);
    expect(texts.slice(0, 7)).toEqual(["여기", "계약서", "등록", "버튼을", "눌러도", "아무", "반응이"]);
    expect(texts).toContain("칼럼");
    expect(texts).toContain("제목");
    expect(texts).toContain("글씨가");
    expect(texts.join(" ")).not.toContain("�");
    expect(words[1]).toEqual({ startMs: 360, endMs: 810, text: "계약서" });
    expect(segments.map((segment) => segment.text)).toEqual([
      "여기 계약서 등록 버튼을 눌러도 아무 반응이 없어요.",
      "그리고 이 표에 금액 칼럼 이름이 이상하게 써 있어요.",
      "저기 제목 글씨가 좀 이상해요.",
    ]);
    expect(segments[0]).toMatchObject({ startMs: 0, endMs: 3360 });
  });

  it("특수 토큰은 버리고 문장 부호는 앞 단어에 붙인다", () => {
    const { words } = parseWhisperJson(
      toBytes({
        transcription: [
          {
            offsets: { from: 0, to: 1000 },
            text: " 안녕하세요.",
            tokens: [token("[_BEG_]", 0, 0), token(" 안녕", 0, 400), token("하세요", 400, 800), token(".", 800, 900), token("[_TT_50]", 1000, 1000)],
          },
        ],
      }),
    );
    expect(words).toEqual([{ startMs: 0, endMs: 900, text: "안녕하세요." }]);
  });

  it("문장 부호 없이 긴 세그먼트는 약 8초에서 다시 나눈다", () => {
    const tokens = Array.from({ length: 20 }, (_, index) => token(" 단어", index * 1000, index * 1000 + 900));
    const { segments } = parseWhisperJson(
      toBytes({ transcription: [{ offsets: { from: 0, to: 20_000 }, text: "", tokens }] }),
    );
    expect(segments.length).toBeGreaterThanOrEqual(2);
    for (const segment of segments) {
      expect(segment.endMs - segment.startMs).toBeLessThanOrEqual(MAX_SEGMENT_MS + 1000);
    }
    expect(segments[0].startMs).toBe(0);
    expect(segments.at(-1)?.endMs).toBe(19_900);
  });

  it("세그먼트 안 문장 부호에서 나눈다", () => {
    const { segments } = parseWhisperJson(
      toBytes({
        transcription: [
          {
            offsets: { from: 0, to: 3000 },
            text: " 하나요. 둘이에요?",
            tokens: [token(" 하나요", 0, 900), token(".", 900, 1000), token(" 둘이에요", 1200, 2500), token("?", 2500, 2600)],
          },
        ],
      }),
    );
    expect(segments).toEqual([
      { startMs: 0, endMs: 1000, text: "하나요." },
      { startMs: 1200, endMs: 2600, text: "둘이에요?" },
    ]);
  });

  it("말이 없으면 빈 결과", () => {
    expect(parseWhisperJson(toBytes({ transcription: [] }))).toEqual({ segments: [], words: [] });
  });
});
