import { z } from "zod";
import type { ParsedTranscript } from "@/lib/analysis/parse-whisper-json";
import type { ElementContext } from "@/types/feedback";

// 모든 시간은 녹화 시작(t0) 기준 ms로 맞춘다.
// - 오디오: wordMs = whisperMs + audioOffsetMs (오디오가 t0보다 늦게 시작하면 양수)
// - DOM 이벤트: relativeMs = epochMs - t0

export type ElementContextKind = "click" | "hover";

export type TimedElementContext = { tMs: number; kind: ElementContextKind; context: ElementContext };

const ELEMENT_CONTEXT_TAG = "element-context";
const ELEMENT_CLICK_TAG = "element-click";
const RRWEB_CUSTOM_EVENT_TYPE = 5;
const RRWEB_INCREMENTAL_EVENT_TYPE = 3;
const RRWEB_MOUSE_INTERACTION_SOURCE = 2;
const RRWEB_CLICK_INTERACTION = 2;
// SDK는 클릭 요소를 rrweb에 따로 남기지 않는다. rrweb 클릭과 가장 가까운(±1초) 머무름 컨텍스트를 click으로 본다.
// 같은 요소에 머문 뒤 클릭하면 새 컨텍스트가 생기지 않으므로 클릭 앞쪽 컨텍스트도 본다.
export const CLICK_MATCH_WINDOW_MS = 1_000;

function shiftMs(value: number, offsetMs: number): number {
  return Math.max(0, Math.round(value + offsetMs));
}

export function shiftTranscript(transcript: ParsedTranscript, audioOffsetMs: number): ParsedTranscript {
  return {
    segments: transcript.segments.map((segment) => ({
      ...segment,
      startMs: shiftMs(segment.startMs, audioOffsetMs),
      endMs: shiftMs(segment.endMs, audioOffsetMs),
    })),
    words: transcript.words.map((word) => ({
      ...word,
      startMs: shiftMs(word.startMs, audioOffsetMs),
      endMs: shiftMs(word.endMs, audioOffsetMs),
    })),
  };
}

export function toRelativeMs(epochMs: number, t0EpochMs: number): number {
  return Math.round(epochMs - t0EpochMs);
}

const rectSchema = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() });

const contextPayloadSchema = z.object({
  selector: z.string().min(1),
  text: z.string().catch(""),
  tagName: z.string().catch(""),
  rect: rectSchema,
  viewport: z.object({ width: z.number(), height: z.number() }),
  kind: z.string().optional(),
  reason: z.string().optional(),
  trigger: z.string().optional(),
});

const customEventSchema = z.object({
  type: z.literal(RRWEB_CUSTOM_EVENT_TYPE),
  timestamp: z.number(),
  data: z.object({ tag: z.string(), payload: z.unknown() }),
});

const clickEventSchema = z.object({
  type: z.literal(RRWEB_INCREMENTAL_EVENT_TYPE),
  timestamp: z.number(),
  data: z.object({ source: z.literal(RRWEB_MOUSE_INTERACTION_SOURCE), type: z.literal(RRWEB_CLICK_INTERACTION) }),
});

function getContextKind(tag: string, payload: z.infer<typeof contextPayloadSchema>): ElementContextKind {
  if (tag === ELEMENT_CLICK_TAG) {
    return "click";
  }
  const declared = payload.kind ?? payload.reason ?? payload.trigger;
  return declared === "click" ? "click" : "hover";
}

function getEventList(events: unknown): unknown[] {
  if (Array.isArray(events)) {
    return events;
  }
  if (typeof events === "object" && events !== null && Array.isArray((events as { events?: unknown }).events)) {
    return (events as { events: unknown[] }).events;
  }
  return [];
}

// events.json(rrweb 이벤트 배열)에서 element-context 사용자 정의 이벤트만 뽑아 t0 기준 시간으로 바꾼다.
export function extractElementContexts(events: unknown, t0EpochMs: number): TimedElementContext[] {
  const contexts: TimedElementContext[] = [];
  const clickTimes: number[] = [];
  for (const event of getEventList(events)) {
    const click = clickEventSchema.safeParse(event);
    if (click.success) {
      clickTimes.push(toRelativeMs(click.data.timestamp, t0EpochMs));
      continue;
    }
    const custom = customEventSchema.safeParse(event);
    if (!custom.success) {
      continue;
    }
    const { tag, payload } = custom.data.data;
    if (tag !== ELEMENT_CONTEXT_TAG && tag !== ELEMENT_CLICK_TAG) {
      continue;
    }
    const parsedPayload = contextPayloadSchema.safeParse(payload);
    if (!parsedPayload.success) {
      continue;
    }
    const { selector, text, tagName, rect, viewport } = parsedPayload.data;
    contexts.push({
      tMs: toRelativeMs(custom.data.timestamp, t0EpochMs),
      kind: getContextKind(tag, parsedPayload.data),
      context: { selector, text, tagName, rect, viewport },
    });
  }
  contexts.sort((left, right) => left.tMs - right.tMs);
  for (const clickMs of clickTimes) {
    let nearest: TimedElementContext | null = null;
    for (const item of contexts) {
      const distance = Math.abs(item.tMs - clickMs);
      if (distance <= CLICK_MATCH_WINDOW_MS && (!nearest || distance < Math.abs(nearest.tMs - clickMs))) {
        nearest = item;
      }
    }
    if (nearest) {
      nearest.kind = "click";
    }
  }
  return contexts;
}
