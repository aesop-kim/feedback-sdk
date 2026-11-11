// S07~S13: 위젯 열기 → 화면 녹화 → 버그 3개 → 끝내기
import type { ReactNode } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, E_INOUT, E_OUT, LINEAR, kf, soft, tw, ui } from "../theme";
import { Caption, Sub } from "../motion/Kinetic";
import { Camera, clampFocus, type Cam } from "../motion/Camera";
import { Cursor, type Pt } from "../motion/Cursor";
import { HOST, HostPage, UILayer } from "../ui/Host";
import { EmptyState, Launcher, Panel, RecordingCard, RecordingPill, PANEL, LAUNCHER } from "../ui/Widget";
import { NARRATION_RMS } from "../data/narration-rms";

const LF = ui(LAUNCHER.x, LAUNCHER.y);
const panelCenter = ui(PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h / 2);

/** 카메라 값 계산 + 레이어가 화면을 벗어나지 않게 제한 */
export function cam(s: number, fx: number, fy: number, margin = 60, blurX = 0): Cam {
  const [x, y] = clampFocus(s, fx, fy, margin);
  return { s, fx: x, fy: y, blurX };
}
/** 두 카메라 사이를 보간 */
export function camLerp(a: Cam, b: Cam, k: number): Cam {
  return { s: a.s + (b.s - a.s) * k, fx: a.fx + (b.fx - a.fx) * k, fy: a.fy + (b.fy - a.fy) * k };
}

// ---------- S07 · 고객이 위젯을 열어요 ----------
export function S07() {
  const f = useCurrentFrame();
  const m = tw(f, 0, 18, 0, 1, E_INOUT);
  const lx = 960 + (LF[0] - 960) * m;
  const ly = 540 + (LF[1] - 540) * m;
  const lsize = 160 + (56 * (1536 / 1440) - 160) * m;
  const hostO = tw(f, 6, 18, 0, 1, E_OUT);
  const hostS = tw(f, 6, 18, 0.96, 1, E_OUT);
  const open = tw(f, 44, 50, 0, 1, E_OUT);
  const ps = f < 44 ? 0 : soft(f, 44);
  const k = tw(f, 60, 80, 0, 1, E_INOUT);
  const c = camLerp({ s: 1, fx: 960, fy: 540 }, cam(1.45, panelCenter[0], panelCenter[1], 140), k);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Camera cam={c}>
        <AbsoluteFill style={{ opacity: hostO, transform: `scale(${hostS})`, transformOrigin: `${LF[0]}px ${LF[1]}px` }}>
          <UILayer>
            <HostPage />
            <Panel scale={0.96 + 0.04 * ps} dy={24 * (1 - ps)} opacity={Math.min(1, ps * 1.4)}>
              <EmptyState stepIn={[0, 1, 2].map((i) => tw(f, 50 + i * 4, 58 + i * 4, 0, 1))} />
            </Panel>
          </UILayer>
        </AbsoluteFill>
        {/* 런처는 레이어 밖에서 움직이다가 자리에 들어간다(매치컷) */}
        <Launcher x={lx} y={ly} size={lsize} open={open} />
        <Cursor f={f} start={[1200, 1200]} moves={[{ at: 20, to: [LF[0] - 6, LF[1] - 4], dur: 18 }]} clicks={[38]} />
      </Camera>
      <Caption text="고객이 위젯을 열어요" f={f} />
    </AbsoluteFill>
  );
}

// 위젯 패널 안 주요 위치 (UI 좌표)
const STEP_Y = [359, 394, 429];
const CTA = { x: PANEL.x + PANEL.w / 2, y: 663 };

// ---------- S08 · 화면 녹화를 눌러요 ----------
export function S08() {
  const f = useCurrentFrame();
  const steps = ui(PANEL.x + PANEL.w / 2, STEP_Y[1]);
  const btn = ui(CTA.x, CTA.y);
  const drift = tw(f, 0, 60, 2.2, 2.23, LINEAR);
  const a = cam(drift, steps[0], steps[1] - 30, 260);
  const b = cam(2.2, btn[0], btn[1] - 60, 260);
  const c = camLerp(a, b, tw(f, 60, 75, 0, 1, E_INOUT));
  const stepColor = STEP_Y.map((_, i) => {
    const T0 = 6 + 15 * i;
    const up = tw(f, T0, T0 + 4, 0, 1);
    const down = tw(f, T0 + 15, T0 + 19, 0, 1);
    return mixC(C.grey400, C.ink, up - down);
  });
  const ring = tw(f, 56, 60, 0, 1);
  const press = f < 77 ? 1 : kf(f, [[77, 1], [80, 0.97], [85, 1]], E_OUT);
  const btnF = ui(CTA.x + 30, CTA.y + 2);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Camera cam={c}>
        <UILayer>
          <HostPage />
          <Panel>
            <EmptyState stepColor={stepColor} ctaRing={ring} ctaScale={press} />
          </Panel>
        </UILayer>
        <Launcher x={LF[0]} y={LF[1]} size={56 * (1536 / 1440)} open={1} />
        <Cursor f={f} start={[btnF[0] + 120, btnF[1] + 260]} moves={[{ at: 58, to: btnF, dur: 16 }]} clicks={[74]} size={52 / 2.2} />
      </Camera>
      <Caption text="화면 녹화를 눌러요" f={f} />
    </AbsoluteFill>
  );
}
function mixC(a: string, b: string, k: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// ---------- 녹화 중 공통: 녹화 링, 알약 ----------
const REC_START = 754; // 전역 프레임
/** 알약 타이머: S09에서는 실제 시간, 이후 녹화 시간을 압축해 끝내기 때 1:07이 되게 한다. */
export function timerAt(g: number) {
  const s = g < 810 ? (g - REC_START) / 30 : (810 - REC_START) / 30 + ((g - 810) / 30) * 3.62;
  const sec = Math.max(0, Math.floor(s));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** 화면 테두리 녹화 링 (왼쪽 위에서 시계 방향으로 그려짐). draw 0~1, reverse면 반대 방향으로 지워짐 */
export function RecRing({ draw, reverse = false }: { draw: number; reverse?: boolean }) {
  if (draw <= 0) return null;
  const inset = 22;
  const w = 1920 - inset * 2;
  const h = 1080 - inset * 2;
  const r = 28;
  const d = `M ${inset + r} ${inset} H ${inset + w - r} A ${r} ${r} 0 0 1 ${inset + w} ${inset + r} V ${inset + h - r} A ${r} ${r} 0 0 1 ${inset + w - r} ${inset + h} H ${inset + r} A ${r} ${r} 0 0 1 ${inset} ${inset + h - r} V ${inset + r} A ${r} ${r} 0 0 1 ${inset + r} ${inset} Z`;
  return (
    <svg width={1920} height={1080} style={{ position: "absolute", left: 0, top: 0 }}>
      <path d={d} fill="none" stroke={C.accent} strokeWidth={4} pathLength={1} strokeDasharray={1} strokeDashoffset={reverse ? -(1 - draw) : 1 - draw} />
    </svg>
  );
}

export const PILL_Y = 846;
export function PillAt({ g, dy = 0, opacity = 1, wave, stopPress, stopRing }: { g: number; dy?: number; opacity?: number; wave?: number[]; stopPress?: number; stopRing?: number }) {
  if (opacity <= 0) return null;
  const dot = 0.65 + 0.35 * Math.cos(((g - REC_START) / 30) * 2 * Math.PI);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: PILL_Y + dy, display: "flex", justifyContent: "center", opacity }}>
      <RecordingPill timer={timerAt(g)} dot={dot} wave={wave} stopPress={stopPress} stopRing={stopRing} />
    </div>
  );
}

/** 대사 RMS로 24막대 파형. local = 대사 시작 기준 프레임 */
export function waveAt(seg: string | null, local: number) {
  const rms = seg ? NARRATION_RMS[seg] : undefined;
  return Array.from({ length: 24 }, (_, j) => {
    const idx = Math.floor(local) - (23 - j);
    const v = rms && idx >= 0 && idx < rms.length ? rms[idx] : 0;
    return Math.max(4, v * 48);
  });
}

// ---------- S09 · 화면을 보여 주며 말해요 ----------
export function S09() {
  const f = useCurrentFrame();
  const g = 750 + f;
  const pS = tw(f, 0, 6, 1, 0.96, E_OUT);
  const pO = tw(f, 0, 6, 1, 0, E_OUT);
  const ring = tw(f, 4, 24, 0, 1, E_INOUT);
  const pill = f < 8 ? 0 : soft(f, 8);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Camera cam={{ s: 1, fx: 960, fy: 540 }}>
        <UILayer>
          <HostPage />
          <Panel scale={pS} opacity={pO}>
            <EmptyState />
          </Panel>
        </UILayer>
        <Launcher x={LF[0]} y={LF[1]} size={56 * (1536 / 1440)} open={1 - tw(f, 0, 6, 0, 1)} />
      </Camera>
      <RecRing draw={ring} />
      <PillAt g={g} dy={40 * (1 - pill)} opacity={Math.min(1, pill * 1.5)} />
      <Caption text="화면을 보여 주며 말해요" f={f} />
    </AbsoluteFill>
  );
}

// 녹화 장면 카메라 키
const BTN = ui(HOST.register.x + HOST.register.w / 2, HOST.register.y + HOST.register.h / 2);
const AMT = ui(HOST.amountHeader.x + 26, HOST.amountHeader.y + 12);
const TTL = ui(HOST.title.x + 46, HOST.title.y + 13);
export const CAM_BTN = (s: number) => cam(s, BTN[0], BTN[1] + 150, 70);
export const CAM_AMT = (s: number) => cam(s, AMT[0] - 120, AMT[1] + 150, 70);
export const CAM_TTL = (s: number) => cam(s, TTL[0] + 120, TTL[1] + 150, 70);

// ---------- S10 · 버그 1: 등록 버튼 ----------
// 녹화 장면 공통 틀
function RecScene({ c, cursor, overlay, host }: { c: Cam; cursor?: ReactNode; overlay?: ReactNode; host?: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Camera cam={c}>
        <UILayer>
          <HostPage>{host}</HostPage>
        </UILayer>
        <Launcher x={LF[0]} y={LF[1]} size={56 * (1536 / 1440)} />
        {cursor}
      </Camera>
      {overlay}
    </AbsoluteFill>
  );
}

export function S10() {
  const f = useCurrentFrame();
  const g = 810 + f;
  const wide = { s: 1, fx: 960, fy: 540 };
  const s = f < 20 ? 1.7 : tw(f, 20, 150, 1.7, 1.73, LINEAR);
  const c = f < 20 ? camLerp(wide, CAM_BTN(1.7), tw(f, 0, 20, 0, 1, E_INOUT)) : CAM_BTN(s);
  const target: Pt = [BTN[0] + 10, BTN[1] + 6];
  return (
    <RecScene
      c={c}
      cursor={<Cursor f={f} start={[1250, 520]} moves={[{ at: 20, to: target, dur: 20 }, { at: 70, to: [target[0] + 14, target[1] + 10], dur: 12 }, { at: 84, to: target, dur: 10 }]} clicks={[58, 94]} size={52 / 1.7} />}
      overlay={
        <>
          <RecRing draw={1} />
          <PillAt g={g} wave={waveAt("n1", f - 15)} />
          <Sub text="새 계약서를 하나 만들려고 눌렀는데, 아무 반응이 없어요." f={f} from={15} to={134} />
        </>
      }
    />
  );
}

// ---------- S11 · 버그 2: 표 머리글 오타 ----------
export function S11() {
  const f = useCurrentFrame();
  const g = 960 + f;
  const pan = tw(f, 0, 12, 0, 1, E_INOUT);
  const s = f < 12 ? 1.73 : tw(f, 12, 24, 1.73, 1.8, E_OUT);
  const c = camLerp(CAM_BTN(1.73), CAM_AMT(s), pan);
  c.blurX = Math.sin(Math.PI * pan) * 10;
  const center: Pt = [AMT[0], AMT[1]];
  const ang = tw(f, 40, 76, 0, Math.PI * 2, E_INOUT);
  const startPt: Pt = [BTN[0] + 10, BTN[1] + 6];
  const pre: Pt = [center[0] - 50, center[1] + 12];
  const approach = tw(f, 18, 38, 0, 1, E_INOUT);
  let pos: Pt;
  if (f < 40) pos = [startPt[0] + (pre[0] - startPt[0]) * approach, startPt[1] + (pre[1] - startPt[1]) * approach];
  else if (f <= 76) pos = [center[0] - 50 * Math.cos(ang), center[1] + 12 + 26 * Math.sin(ang)];
  else pos = [pre[0] + tw(f, 90, 104, 0, 34, E_INOUT), pre[1] + tw(f, 90, 104, 0, 10, E_INOUT)];
  const under = tw(f, 100, 110, 0, 1, E_OUT);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Camera cam={c} id="s11">
        <UILayer>
          <HostPage underline={under} />
        </UILayer>
        <Launcher x={LF[0]} y={LF[1]} size={56 * (1536 / 1440)} />
        <Cursor f={f} start={pos} moves={[]} size={52 / 1.8} />
      </Camera>
      <RecRing draw={1} />
      <PillAt g={g} wave={f < 93 ? waveAt("n2", f - 6) : waveAt("n3", f - 93)} />
      {f < 93 ? <Sub text="여기 금액 칸 제목이 계약 금액이어야 하는데," f={f} from={6} to={93} /> : <Sub text="계약 긍액이라고 오타가 나 있어요." f={f} from={93} to={164} />}
    </AbsoluteFill>
  );
}

// ---------- S12 · 버그 3: 애매한 제목 ----------
export function S12() {
  const f = useCurrentFrame();
  const g = 1140 + f;
  const pan = tw(f, 0, 12, 0, 1, E_INOUT);
  const s = f < 24 ? 1.8 : tw(f, 24, 180, 1.8, 1.72, LINEAR);
  const c = camLerp(CAM_AMT(1.8), CAM_TTL(s), pan);
  c.blurX = Math.sin(Math.PI * pan) * 22;
  const base: Pt = [TTL[0] + 10, TTL[1] + 14];
  const startPt: Pt = [AMT[0] - 16, AMT[1] + 12];
  const approach = tw(f, 4, 26, 0, 1, E_INOUT);
  let pos: Pt;
  if (f < 30) pos = [startPt[0] + (base[0] - startPt[0]) * approach, startPt[1] + (base[1] - startPt[1]) * approach];
  else {
    // 좌우 ±40px 왕복 2회 (f30~f110)
    const ph = tw(f, 30, 110, 0, 1, LINEAR);
    pos = [base[0] + 40 * Math.sin(ph * Math.PI * 4) * (1 - 0.3 * ph), base[1] + 4 * Math.sin(ph * Math.PI * 8)];
  }
  const box = tw(f, 80, 86, 0, 1, LINEAR);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Camera cam={c} id="s12">
        <UILayer>
          <HostPage titleBox={box} titleDash={Math.max(0, f - 80) * 0.6} />
        </UILayer>
        <Launcher x={LF[0]} y={LF[1]} size={56 * (1536 / 1440)} />
        <Cursor f={f} start={pos} moves={[]} size={52 / 1.8} />
      </Camera>
      <RecRing draw={1} />
      <PillAt g={g} wave={f < 92 ? waveAt("n4", f - 12) : waveAt("n5", f - 92)} />
      {f < 92 ? <Sub text="이 글씨가 다른 곳이랑 좀 달라 보여요." f={f} from={12} to={91} /> : <Sub text="정확히 뭐가 문제인지는 저도 모르겠는데," f={f} from={92} to={179} />}
    </AbsoluteFill>
  );
}

// ---------- S13 · 끝내기를 누르면 바로 보내져요 ----------
export function S13() {
  const f = useCurrentFrame();
  const g = 1320 + f;
  const wide = { s: 1, fx: 960, fy: 540 };
  let c: Cam = camLerp(CAM_TTL(1.72), wide, tw(f, 0, 15, 0, 1, E_INOUT));
  if (f >= 50) c = camLerp(wide, cam(1.4, panelCenter[0], panelCenter[1] - 120, 140), tw(f, 50, 70, 0, 1, E_INOUT));
  const ring = 1 - tw(f, 32, 44, 0, 1, E_INOUT);
  const pillDy = tw(f, 32, 38, 0, 40, E_OUT);
  const pillO = tw(f, 32, 38, 1, 0, E_OUT);
  const ps = f < 40 ? 0 : soft(f, 40);
  const stop: Pt = [1047, PILL_Y + 32];
  const press = f >= 30 && f < 40 ? kf(f, [[30, 1], [33, 0.94], [40, 1]], E_OUT) : 1;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Camera cam={c}>
        <UILayer>
          <HostPage titleBox={tw(f, 0, 8, 1, 0, LINEAR)} />
          <Panel scale={0.96 + 0.04 * ps} dy={24 * (1 - ps)} opacity={Math.min(1, ps * 1.4)}>
            <RecordingCard sub="정리하고 있어요" dotsFrame={f} />
          </Panel>
        </UILayer>
        <Launcher x={LF[0]} y={LF[1]} size={56 * (1536 / 1440)} open={tw(f, 40, 46, 0, 1)} />
      </Camera>
      <RecRing draw={ring} reverse />
      <PillAt g={Math.min(g, 1350)} dy={pillDy} opacity={pillO} stopPress={press} stopRing={tw(f, 22, 26, 0, 1) * (f < 32 ? 1 : 0)} />
      <Cursor f={f} start={[1250, 640]} moves={[{ at: 14, to: [stop[0] + 4, stop[1] + 4], dur: 16 }]} clicks={[30]} opacity={f < 46 ? 1 : tw(f, 46, 50, 1, 0, LINEAR)} />
      <Caption text="끝내기를 누르면 바로 보내져요" f={f} />
    </AbsoluteFill>
  );
}
