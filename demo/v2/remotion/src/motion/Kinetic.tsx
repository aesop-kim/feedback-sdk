// 키네틱 타이포: WORD-POP, SYL-TYPE, SCRAMBLE, ROLL, CAP-IN, 대사 자막 (스토리보드 0장 모션 토큰)
import type { CSSProperties, ReactNode } from "react";
import { C, E_OUT, FONT, T, mix, pop, rand, tw } from "../theme";

/** WORD-POP: 등장 프레임에 opacity 0→1(1f), scale 1.08→1.00(3f, E-OUT) */
export function wordPop(f: number, at: number, from = 1.08) {
  if (f < at) return { opacity: 0, transform: `scale(${from})` };
  return { opacity: 1, transform: `scale(${tw(f, at, at + 3, from, 1)})` };
}

/** SPR-POP으로 커지는 단어 (scale from → 1, 오버슈트 포함) */
export function springPop(f: number, at: number, from = 1.12) {
  if (f < at) return { opacity: 0, transform: `scale(${from})` };
  const s = pop(f, at);
  return { opacity: Math.min(1, (f - at + 1) / 2), transform: `scale(${from + (1 - from) * s})` };
}

const isBlank = (ch: string) => ch === " ";

/** SYL-TYPE: 음절마다 interval 프레임 간격으로 등장. 새 음절은 flash 색 4f → base 색으로 3f 선형 전환.
 *  보이는 글자만 렌더해서 줄이 늘 때마다 가운데 정렬이 다시 맞춰진다. */
export function SylType({ text, f, start, interval = 2, color = C.ink, flash = C.accent, style }: { text: string; f: number; start: number; interval?: number; color?: string; flash?: string; style?: CSSProperties }) {
  let k = 0;
  const out: ReactNode[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (isBlank(ch)) {
      if (f >= start + k * interval) out.push(<span key={i}> </span>);
      continue;
    }
    const at = start + k * interval;
    k++;
    if (f < at) break;
    const age = f - at;
    const c = age < 4 ? flash : mix(flash, color, (age - 4) / 3);
    out.push(
      <span key={i} style={{ color: c }}>
        {ch}
      </span>,
    );
  }
  return <span style={{ whiteSpace: "pre", ...style }}>{out}</span>;
}
/** SYL-TYPE이 끝나는 로컬 프레임 */
export const sylEnd = (text: string, start: number, interval = 2) => start + text.replace(/ /g, "").length * interval;

/** SCRAMBLE 퇴장: 글자가 무작위 순서로 accent로 바뀌었다가(1f) 투명해진다. 글자당 2f 간격으로 총 dur 안에. */
export function ScrambleOut({ text, f, start, dur = 12, color = C.ink, seed = 1, style }: { text: string; f: number; start: number; dur?: number; color?: string; seed?: number; style?: CSSProperties }) {
  const n = text.length;
  return (
    <span style={{ whiteSpace: "pre", ...style }}>
      {text.split("").map((ch, i) => {
        const at = start + rand(seed * 100 + i) * (dur - 2);
        let c: string = color;
        let o = 1;
        if (f >= at + 2) o = 0;
        else if (f >= at) c = C.accent;
        return (
          <span key={i} style={{ color: c, opacity: o }}>
            {ch}
          </span>
        );
      })}
      {n === 0 ? null : null}
    </span>
  );
}

/** SCRAMBLE 교체: 이전 문구 글자가 사라지는 동안 새 문구 글자가 무작위 순서로 채워진다. 합계 dur. */
export function ScrambleSwap({ from, to, f, start, dur = 12, color = C.ink, style }: { from: string; to: string; f: number; start: number; dur?: number; color?: string; style?: CSSProperties }) {
  if (f < start) return <span style={style}>{from}</span>;
  const half = dur / 2;
  if (f < start + half) return <ScrambleOut text={from} f={f} start={start} dur={half} color={color} style={style} />;
  return (
    <span style={{ whiteSpace: "pre", ...style }}>
      {to.split("").map((ch, i) => {
        const at = start + half + rand(500 + i) * (half - 1);
        if (f < at) return <span key={i} style={{ opacity: 0 }}>{ch}</span>;
        const age = f - at;
        return (
          <span key={i} style={{ color: age < 2 ? C.accent : color }}>
            {ch}
          </span>
        );
      })}
    </span>
  );
}

/** T-CAP 캡션. CAP-IN: 샷 시작 6f 뒤부터 단어 간격 4f로 WORD-POP. 기준선 y=1004, 가운데, 한 줄. */
export function Caption({ text, f, start = 6, dark = false }: { text: string; f: number; start?: number; dark?: boolean }) {
  if (f < start) return null;
  const words = text.split(" ");
  const fg = dark ? "#FFFFFF" : C.ink;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 1004 - 48 * 0.95, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ display: "flex", gap: "0 0.26em", fontFamily: FONT, ...T.cap, letterSpacing: -0.6, color: fg, lineHeight: 1, whiteSpace: "nowrap", padding: dark ? 0 : "14px 30px 16px", borderRadius: 999, background: dark ? "transparent" : "rgba(242,244,246,0.96)", outline: dark ? undefined : `1px solid ${C.grey200}` }}>
        {words.map((w, i) =>
          f >= start + i * 4 ? (
            <span key={i} style={{ display: "inline-block", ...wordPop(f, start + i * 4) }}>
              {w}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

/** 대사 자막(T-SUB, 따옴표 포함). 단어 단위로 대사에 맞춰 grey-400 → ink (가라오케식). */
export function Sub({ text, f, from, to }: { text: string; f: number; from: number; to: number }) {
  const words = `“${text}”`.split(" ");
  const total = words.reduce((s, w) => s + w.length, 0);
  let acc = 0;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 1004 - 40 * 0.95 - 10, display: "flex", justifyContent: "center" }}>
      <div style={{ display: "flex", gap: "0 0.28em", fontFamily: FONT, ...T.sub, lineHeight: 1, whiteSpace: "nowrap", padding: "14px 28px 16px", borderRadius: 999, background: C.surface, outline: `1px solid ${C.grey200}` }}>
        {words.map((w, i) => {
          const at = from + ((to - from) * acc) / total;
          acc += w.length;
          const on = f >= at;
          return (
            <span key={i} style={{ color: on ? C.ink : C.grey400 }}>
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** ROLL: 고정 구절 + 오른쪽 세로 목록. moves = 포커스가 각 줄로 옮겨 가는 시작 프레임.
 *  typeStart부터 목록이 줄마다 6f 간격으로 회색 글자 타이핑. */
export function Roll({ f, phrase, phraseStart, items, icons, moves, typeStart, typeGap = 6, phraseRight = 820, listLeft = 900, lastBold = false }: { f: number; phrase: string; phraseStart: number; items: string[]; icons?: ((p: { size?: number; color?: string; stroke?: number }) => ReactNode)[]; moves: number[]; typeStart: number; typeGap?: number; phraseRight?: number; listLeft?: number; lastBold?: boolean }) {
  const GAP = 124;
  // 포커스 위치(연속값): moves[i] 시작 4f E-OUT 동안 i-1 → i
  let pos = 0;
  let focusIdx = -1;
  moves.forEach((m, i) => {
    if (f >= m) {
      focusIdx = i;
      pos = i === 0 ? 0 : tw(f, m, m + 4, i - 1, i);
    }
  });
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT }}>
      <div style={{ position: "absolute", right: 1920 - phraseRight, top: 540 - 50, height: 100, display: "flex", alignItems: "center", ...T.head, color: C.ink, whiteSpace: "nowrap" }}>
        <SylType text={phrase} f={f} start={phraseStart} />
      </div>
      {items.map((it, i) => {
        const y = 540 + (i - pos) * GAP;
        let on = 0;
        if (i === focusIdx) on = tw(f, moves[i], moves[i] + 4, 0, 1);
        else if (focusIdx >= 0 && i === focusIdx - 1) on = tw(f, moves[focusIdx], moves[focusIdx] + 4, 1, 0);
        const size = 72 + (104 - 72) * on;
        const weight = 500 + (lastBold && i === items.length - 1 ? 300 : 200) * on;
        const col = mix(C.grey400, C.ink, on);
        const Icon = icons?.[i];
        // 글자 단위 회색 타이핑
        const tStart = typeStart + i * typeGap;
        const shown = Math.max(0, Math.min(it.length, Math.floor((f - tStart) / 1) + 1));
        const dist = Math.abs(i - pos);
        const fade = Math.max(0, 1 - Math.max(0, dist - 2.2) / 1.2);
        return (
          <div key={it} style={{ position: "absolute", left: listLeft, top: y - 70, height: 140, display: "flex", alignItems: "center", gap: 20 + 10 * on, opacity: fade }}>
            {Icon ? <div style={{ width: 34 + 14 * on, display: "flex", justifyContent: "center" }}>{Icon({ size: 34 + 14 * on, color: mix(C.grey400, C.accent, on), stroke: 2 })}</div> : null}
            <span style={{ fontSize: size, fontWeight: weight, color: col, letterSpacing: -1 - on, whiteSpace: "nowrap", lineHeight: 1 }}>{f >= tStart ? it.slice(0, shown) : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

export { E_OUT };
