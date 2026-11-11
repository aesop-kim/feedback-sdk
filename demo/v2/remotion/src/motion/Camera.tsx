// 카메라: 부모 div 하나의 transform으로 처리한다(스토리보드 3장 제작 메모).
// (fx, fy) = 화면 가운데에 올 프레임 좌표, s = 배율. blurX > 0이면 가로 모션블러(휩 팬).
import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { UI } from "../theme";

export type Cam = { s: number; fx: number; fy: number; blurX?: number };

export function Camera({ cam, children, id = "cam" }: { cam: Cam; children: ReactNode; id?: string }) {
  const blur = cam.blurX ?? 0;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {blur > 0.3 ? (
        <svg width={0} height={0} style={{ position: "absolute" }}>
          <filter id={`${id}-hb`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={`${blur} 0`} />
          </filter>
        </svg>
      ) : null}
      <AbsoluteFill
        style={{
          transformOrigin: "0 0",
          transform: `translate(960px, 540px) scale(${cam.s}) translate(${-cam.fx}px, ${-cam.fy}px)`,
          filter: blur > 0.3 ? `url(#${id}-hb)` : undefined,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** UI 레이어(192,60,1536x960)가 화면을 벗어나 빈 배경이 너무 많이 보이지 않게 초점을 제한한다. margin = 허용할 여백(px, 화면 기준). */
export function clampFocus(s: number, fx: number, fy: number, margin = 48): [number, number] {
  const hw = 960 / s;
  const hh = 540 / s;
  const m = margin / s;
  const L = UI.x - m;
  const R = UI.x + UI.w * UI.s + m;
  const Tp = UI.y - m;
  const B = UI.y + UI.h * UI.s + m;
  const cx = R - L <= 2 * hw ? (L + R) / 2 : Math.max(L + hw, Math.min(R - hw, fx));
  const cy = B - Tp <= 2 * hh ? (Tp + B) / 2 : Math.max(Tp + hh, Math.min(B - hh, fy));
  return [cx, cy];
}

export const WIDE: Cam = { s: 1, fx: 960, fy: 540 };
