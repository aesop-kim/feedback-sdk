import { z } from "zod";
import type { TranscriptSegment } from "@/types/feedback";

// whisper.cpp `-ojf` 결과(JSON)를 단어·세그먼트로 바꾼다.
// whisper.cpp는 토큰을 바이트 단위로 잘라 쓰기 때문에 한글 한 글자가 두 토큰에 걸쳐 깨진 UTF-8로 나온다.
// 그래서 파일을 latin1(바이트 1:1)로 읽어 토큰 바이트를 이어 붙인 뒤 단어 단위로 UTF-8 디코딩한다.

export type TranscriptWord = { startMs: number; endMs: number; text: string };

export type ParsedTranscript = { segments: TranscriptSegment[]; words: TranscriptWord[] };

export const MAX_SEGMENT_MS = 8_000;

const SPACE_BYTE = 0x20;
const SENTENCE_END_PATTERN = /[.?!。…]$/;
const SPECIAL_TOKEN_PATTERN = /^\[_.*\]$/;

const offsetsSchema = z.object({ from: z.number(), to: z.number() });

const whisperJsonSchema = z.object({
  transcription: z.array(
    z.object({
      offsets: offsetsSchema,
      text: z.string(),
      tokens: z.array(z.object({ text: z.string(), offsets: offsetsSchema })).default([]),
    }),
  ),
});

type WordDraft = { startMs: number; endMs: number; bytes: number[] };

const utf8Decoder = new TextDecoder("utf-8");

function decodeWord(draft: WordDraft): TranscriptWord {
  return { startMs: draft.startMs, endMs: draft.endMs, text: utf8Decoder.decode(Uint8Array.from(draft.bytes)).trim() };
}

function buildWords(tokens: { text: string; offsets: { from: number; to: number } }[]): TranscriptWord[] {
  const drafts: WordDraft[] = [];
  for (const token of tokens) {
    if (SPECIAL_TOKEN_PATTERN.test(token.text)) {
      continue;
    }
    const bytes = [...Buffer.from(token.text, "latin1")];
    if (bytes.length === 0) {
      continue;
    }
    const current = drafts.at(-1);
    if (!current || bytes[0] === SPACE_BYTE) {
      drafts.push({ startMs: token.offsets.from, endMs: token.offsets.to, bytes });
      continue;
    }
    current.bytes.push(...bytes);
    current.endMs = Math.max(current.endMs, token.offsets.to);
  }
  return drafts.map(decodeWord).filter((word) => word.text.length > 0);
}

// 긴 세그먼트는 문장 부호 또는 약 8초에서 끊는다.
function splitSegmentWords(words: TranscriptWord[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let chunk: TranscriptWord[] = [];
  const flush = () => {
    if (chunk.length === 0) {
      return;
    }
    segments.push({
      startMs: chunk[0].startMs,
      endMs: chunk[chunk.length - 1].endMs,
      text: chunk.map((word) => word.text).join(" "),
    });
    chunk = [];
  };
  for (const word of words) {
    chunk.push(word);
    const isSentenceEnd = SENTENCE_END_PATTERN.test(word.text);
    const isTooLong = word.endMs - chunk[0].startMs >= MAX_SEGMENT_MS;
    if (isSentenceEnd || isTooLong) {
      flush();
    }
  }
  flush();
  return segments;
}

// raw: whisper-cli가 쓴 JSON 파일 바이트 그대로.
export function parseWhisperJson(raw: Uint8Array): ParsedTranscript {
  const parsed = whisperJsonSchema.parse(JSON.parse(Buffer.from(raw).toString("latin1")));
  const segments: TranscriptSegment[] = [];
  const words: TranscriptWord[] = [];
  for (const whisperSegment of parsed.transcription) {
    const segmentWords = buildWords(whisperSegment.tokens);
    if (segmentWords.length === 0) {
      const text = utf8Decoder.decode(Buffer.from(whisperSegment.text, "latin1")).trim();
      if (text.length > 0) {
        segments.push({ startMs: whisperSegment.offsets.from, endMs: whisperSegment.offsets.to, text });
      }
      continue;
    }
    words.push(...segmentWords);
    segments.push(...splitSegmentWords(segmentWords));
  }
  return { segments, words };
}
