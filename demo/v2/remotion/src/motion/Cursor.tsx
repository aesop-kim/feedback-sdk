// 커서: 화살표 52px, ink 채움 + 흰 외곽선 3px. 3차 베지어 경로(수직 방향 12% 휨), E-INOUT.
// 클릭: scale 1→0.86(3f) → SPR-POP 복귀 + accent 리플(반지름 0→36, opacity 0.6→0, 10f E-OUT).
import { C, E_INOUT, E_OUT, pop, tw } from "../theme";

export type Pt = [number, number];
export type Move = { at: number; to: Pt; dur?: number; bend?: number };

export const moveDur = (a: Pt, b: Pt) => Math.max(12, Math.min(24, 12 + Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.012));

function bez(a: Pt, b: Pt, t: number, bend: number): Pt {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const nx = -dy * bend;
  const ny = dx * bend;
  const c1: Pt = [a[0] + dx / 3 + nx, a[1] + dy / 3 + ny];
  const c2: Pt = [a[0] + (2 * dx) / 3 + nx, a[1] + (2 * dy) / 3 + ny];
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * b[0],
    u * u * u * a[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * b[1],
  ];
}

export function cursorPos(f: number, start: Pt, moves: Move[]): Pt {
  let p = start;
  for (const m of moves) {
    const d = m.dur ?? moveDur(p, m.to);
    if (f < m.at) return p;
    if (f < m.at + d) return bez(p, m.to, E_INOUT((f - m.at) / d), m.bend ?? 0.12);
    p = m.to;
  }
  return p;
}

export function Cursor({ f, start, moves, clicks = [], size = 52, visibleFrom = -999, opacity = 1 }: { f: number; start: Pt; moves: Move[]; clicks?: number[]; size?: number; visibleFrom?: number; opacity?: number }) {
  if (f < visibleFrom || opacity <= 0) return null;
  const [x, y] = cursorPos(f, start, moves);
  let scale = 1;
  let ripple: { r: number; o: number } | null = null;
  for (const c of clicks) {
    if (f >= c && f < c + 3) scale = tw(f, c, c + 3, 1, 0.86);
    else if (f >= c + 3 && f < c + 30) scale = 0.86 + 0.14 * pop(f, c + 3);
    if (f >= c + 3 && f < c + 13) ripple = { r: tw(f, c + 3, c + 13, 0, 36, E_OUT), o: tw(f, c + 3, c + 13, 0.6, 0, E_OUT) };
  }
  const k = size / 52;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, opacity }}>
      {ripple ? <div style={{ position: "absolute", left: x - ripple.r * k, top: y - ripple.r * k, width: ripple.r * 2 * k, height: ripple.r * 2 * k, borderRadius: "50%", border: `${3 * k}px solid ${C.accent}`, opacity: ripple.o }} /> : null}
      <svg width={size * 0.72} height={size} viewBox="0 0 26 36" style={{ position: "absolute", left: x - 2 * k, top: y - 2 * k, transform: `scale(${scale})`, transformOrigin: "2px 2px", overflow: "visible" }}>
        <path d="M2 2 L2 29 L9 22.5 L13.6 33 L18.4 31 L13.9 20.8 L23 20.8 Z" fill={C.ink} stroke="#fff" strokeWidth={2.4} strokeLinejoin="round" />
      </svg>
    </div>
  );
}
