// S21~S25: 반영 완료 → 재확인 요청 → 요약 롤링 → 메시지 → 엔드 카드
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, E_INOUT, E_OUT, FONT, LINEAR, T, kf, pop, rand, soft, tw, ui, UI } from "../theme";
import { Caption, Roll, ScrambleOut, SylType, springPop } from "../motion/Kinetic";
import { Camera, type Cam } from "../motion/Camera";
import { Cursor } from "../motion/Cursor";
import { HostPage, UILayer } from "../ui/Host";
import { DoneChip, ISSUES } from "../ui/Admin";
import { LatticeMark } from "../ui/Icons";
import { Launcher, MyBubble, Panel, PANEL, LAUNCHER, RecordingCard, SystemMessage, t } from "../ui/Widget";
import { CARD, IssueCard, IssuesHeader } from "./Ai";
import { cam, camLerp } from "./Record";

const LF = ui(LAUNCHER.x, LAUNCHER.y);

// ---------- S21 · 고치고 나면 반영 완료로 바꿔요 ----------
const CHIP_AT = [52, 96, 106];
function StatusButton() {
  return <span style={{ display: "inline-flex", padding: "10px 18px", borderRadius: 12, background: C.blue50, ...t(22, 600, C.accent, { lineHeight: 1.2, whiteSpace: "nowrap" }) }}>반영 완료로 바꾸기</span>;
}
export function S21() {
  const f = useCurrentFrame();
  const inK = soft(f, 0);
  const card1 = { x: CARD.x + CARD.w / 2, y: CARD.ys[0] + 75 };
  let c: Cam = camLerp({ s: 1, fx: 960, fy: 520 }, { s: 1.3, fx: card1.x + 120, fy: card1.y + 60 }, tw(f, 0, 15, 0, 1, E_INOUT));
  if (f >= 80) c = camLerp({ s: 1.3, fx: card1.x + 120, fy: card1.y + 60 }, { s: 1, fx: 960, fy: 520 }, tw(f, 80, 95, 0, 1, E_INOUT));
  // 버튼 위치(프레임): 카드 오른쪽 268px 안쪽에 오른쪽 정렬
  const btn: [number, number] = [CARD.x + CARD.w - 268 - 110, CARD.ys[0] + 30 + 24];
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Camera cam={c}>
        <IssuesHeader f={99} morph={false} sub={false} />
        {CARD.ys.map((y, i) => {
          const at = CHIP_AT[i];
          const done = f >= at;
          const chipS = done ? pop(f, at) : 1;
          const titleC = f >= at + 4 ? mixT(tw(f, at + 4, at + 10, 0, 1)) : C.ink;
          return (
            <div key={i} style={{ position: "absolute", left: CARD.x, top: y + 30 * (1 - inK), opacity: Math.min(1, inK * 1.5) }}>
              <IssueCard i={i} titleColor={titleC} right={done ? <DoneChip size={22} draw={tw(f, at, at + 12, 0, 1)} scale={0.6 + 0.4 * chipS} /> : <StatusButton />} />
            </div>
          );
        })}
        <Cursor f={f} start={[btn[0] + 300, btn[1] + 360]} moves={[{ at: 20, to: [btn[0] + 10, btn[1] + 8], dur: 22 }, { at: 70, to: [btn[0] + 160, btn[1] + 240], dur: 18 }]} clicks={[CHIP_AT[0] - 3]} size={52 / 1.3} />
      </Camera>
      <Caption text="고치고 나면 반영 완료로 바꿔요" f={f} />
    </AbsoluteFill>
  );
}
function mixT(k: number) {
  const a = [0x19, 0x1f, 0x28];
  const b = [0x4e, 0x59, 0x68];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`;
}

// ---------- S22 · 고객에게 같은 화면에서 다시 확인을 부탁해요 ----------
const MSG_AT = [34, 42, 50];
export function S22() {
  const f = useCurrentFrame();
  const badge = f < 6 ? 0 : pop(f, 6);
  const ps = f < 22 ? 0 : soft(f, 22);
  const contentTop = PANEL.y + 92;
  const msg1 = ui(PANEL.x + PANEL.w / 2, contentTop + 72 + 14 + 44 + 18 + 34);
  const c = camLerp({ s: 1, fx: 960, fy: 540 }, cam(1.6, msg1[0], msg1[1] + 40, 220), tw(f, 30, 48, 0, 1, E_INOUT));
  const line = tw(f, 60, 70, 0, 1);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Camera cam={c}>
        <UILayer>
          <HostPage />
          <Panel scale={0.96 + 0.04 * ps} dy={24 * (1 - ps)} opacity={Math.min(1, ps * 1.4)}>
            <RecordingCard sub="문제 3건을 정리했어요" />
            <div style={{ height: 14 }} />
            <MyBubble text="글씨가 너무 굵어요" />
            <div style={{ height: 18 }} />
            {ISSUES.map((is, i) => {
              const a = MSG_AT[i];
              const k = tw(f, a, a + 10, 0, 1, E_OUT);
              return <SystemMessage key={i} title={is.title} line={i === 0 ? line : 0} style={{ marginBottom: 8, opacity: k, transform: `translateY(${24 * (1 - k)}px)` }} />;
            })}
          </Panel>
        </UILayer>
        <Launcher x={LF[0]} y={LF[1]} size={56 * UI.s} open={tw(f, 22, 28, 0, 1)} badge={f >= 6 && f < 22 ? "3" : undefined} badgeScale={badge} />
        <Cursor f={f} start={[LF[0] - 300, LF[1] - 220]} moves={[{ at: 8, to: [LF[0] - 4, LF[1] - 2], dur: 12 }]} clicks={[20]} opacity={f < 30 ? 1 : tw(f, 30, 34, 1, 0, LINEAR)} />
      </Camera>
      <TileWipe f={f} start={140} />
      <Caption text="고객에게 같은 화면에서 다시 확인을 부탁해요" f={f} />
    </AbsoluteFill>
  );
}

/** 화면 정리: bg 타일이 무작위 순서로 덮는다(SCRAMBLE을 화면 전체에 적용한 근사). */
function TileWipe({ f, start }: { f: number; start: number }) {
  if (f < start) return null;
  const cols = 16;
  const rows = 9;
  const size = 120;
  const tiles = [];
  for (let r = 0; r < rows; r++)
    for (let q = 0; q < cols; q++) {
      const at = start + rand(r * 31 + q * 7 + 3) * 9;
      if (f >= at) tiles.push(<div key={`${r}-${q}`} style={{ position: "absolute", left: q * size, top: r * size, width: size + 1, height: size + 1, background: f < at + 1 ? C.accent : C.bg }} />);
    }
  return <AbsoluteFill>{tiles}</AbsoluteFill>;
}

// ---------- S23 · 녹화 한 번으로 재확인까지 ----------
export const S23_ITEMS = ["이슈 정리", "되묻기", "답변", "반영", "재확인까지"];
export function S23() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Roll f={f} phrase="녹화 한 번으로" phraseStart={0} items={S23_ITEMS} moves={[45, 75, 105, 135, 165]} typeStart={10} typeGap={6} lastBold />
    </AbsoluteFill>
  );
}

// ---------- S24 · 말로 설명하면, 이슈가 돼요. ----------
export function S24() {
  const f = useCurrentFrame();
  const drift = tw(f, 0, 135, 1, 1.02, LINEAR);
  const join = tw(f, 34, 40, 0, 1, E_OUT);
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      {f < 12 ? (
        <AbsoluteFill>
          {/* S23 마지막 화면이 글자 단위로 흩어진다 */}
          <div style={{ position: "absolute", right: 1920 - 820, top: 490, height: 100, display: "flex", alignItems: "center", ...T.head }}>
            <ScrambleOut text="녹화 한 번으로" f={f} start={0} dur={12} seed={3} />
          </div>
          <div style={{ position: "absolute", left: 900, top: 470, height: 140, display: "flex", alignItems: "center", fontSize: 104, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>
            <ScrambleOut text="재확인까지" f={f} start={0} dur={12} seed={5} />
          </div>
          <div style={{ position: "absolute", left: 900, top: 470 - 124, height: 140, display: "flex", alignItems: "center", fontSize: 72, fontWeight: 500, letterSpacing: -1, lineHeight: 1 }}>
            <ScrambleOut text="반영" f={f} start={0} dur={12} seed={7} color={C.grey400} />
          </div>
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `scale(${drift})` }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `translateY(${105 * (1 - join)}px)` }}>
          <div style={{ height: 100, display: "flex", alignItems: "center", ...T.head, color: C.ink }}>
            <SylType text="말로 설명하면," f={f} start={12} />
          </div>
          <div style={{ height: 190, display: "flex", alignItems: "center", ...T.display, color: C.ink, whiteSpace: "nowrap", ...springPop(f, 34, 1.12) }}>이슈가 돼요.</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------- S25 · 래티스 피드백 (엔드 카드) ----------
export function S25() {
  const f = useCurrentFrame();
  const mark = f < 4 ? 0 : pop(f, 4);
  const subO = tw(f, 30, 40, 0, 1);
  const subY = tw(f, 30, 40, 12, 0);
  const all = tw(f, 171, 195, 1, 0, LINEAR);
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      <AbsoluteFill style={{ opacity: all }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 540 - 70, height: 130, display: "flex", alignItems: "center", justifyContent: "center", gap: 34 }}>
          <div style={{ transform: `scale(${mark})` }}>
            <LatticeMark size={112} />
          </div>
          <div style={{ ...T.title, color: C.ink, lineHeight: 1, minWidth: 640 }}>
            <SylType text="래티스 피드백" f={f} start={10} />
          </div>
        </div>
        <p style={{ position: "absolute", left: 0, right: 0, top: 540 + 100, textAlign: "center", opacity: subO, transform: `translateY(${subY}px)`, ...t(36, 500, C.grey700) }}>래티스 × NEXT 15기 · 피드백 SDK</p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export { kf };
