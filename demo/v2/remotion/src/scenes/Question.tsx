// S17~S20: 질문 초안 승인 → 질문 카드가 고객에게 → 고객이 하나 고름 → 답변이 이슈에 붙음
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, E_INOUT, E_OUT, LINEAR, kf, pop, soft, tw, ui, UI } from "../theme";
import { Caption, ScrambleSwap } from "../motion/Kinetic";
import { Camera, type Cam } from "../motion/Camera";
import { Cursor, type Pt } from "../motion/Cursor";
import { HostPage, UILayer } from "../ui/Host";
import { AdminShell, AnalysisHead, CustomerBubble, DEFAULT_LIST, DraftCard, ISSUES, IssueRow, NeedBadge, RecordingChip } from "../ui/Admin";
import { Launcher, MyBubble, Panel, PANEL, LAUNCHER, QuestionCard, QUESTION, RecordingCard, t } from "../ui/Widget";
import { cam, camLerp } from "./Record";

const LF = ui(LAUNCHER.x, LAUNCHER.y);
const LSIZE = 56 * UI.s;

// 관리자 오른쪽 패널 안 초안 카드 자리 (UI 좌표)
const DRAFT = { x: 1030, y: 140, w: 380 };
// 초안 카드 안 버튼 위치(카드 기준, UI px)
const DRAFT_BTN = { x: 316, y: 482 };

function DraftPanel({ typed, optIn, btnScale, sent, caret }: { typed: number; optIn: number[]; btnScale: number; sent: boolean; caret: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0 }}>
        <IssueRow n={3} title={ISSUES[2].title} right={<NeedBadge />} open />
      </div>
      <div style={{ position: "absolute", left: DRAFT.x - 1000, top: DRAFT.y - 56 }}>
        <DraftCard typed={typed} optIn={optIn} btnScale={btnScale} sent={sent} caret={caret} />
      </div>
    </div>
  );
}

const CAM17 = (k: number): Cam => {
  const a = cam(1.3, ...ui(DRAFT.x + DRAFT.w / 2, DRAFT.y + 210), 160);
  const b = cam(1.3, ...ui(DRAFT.x + DRAFT.w / 2, DRAFT.y + 330), 160);
  return camLerp(a, b, k);
};

// ---------- S17 · 질문 초안을 확인하고 보내기만 하면 돼요 ----------
export function S17() {
  const f = useCurrentFrame();
  const cardIn = f < 0 ? 0 : soft(f, 0);
  const typed = Math.floor(tw(f, 10, 75, 0, QUESTION.length, LINEAR));
  const optIn = [76, 82, 88, 94].map((a) => tw(f, a, a + 6, 0, 1));
  const btnScale = f < 124 ? 1 : kf(f, [[124, 1], [127, 0.97], [136, 1]], E_OUT);
  const c = CAM17(tw(f, 100, 118, 0, 1, E_INOUT));
  const btn = ui(DRAFT.x + DRAFT_BTN.x, DRAFT.y + DRAFT_BTN.y);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Camera cam={c}>
        <UILayer>
          <AdminShell
            right={
              <div style={{ opacity: Math.min(1, cardIn * 1.5), transform: `translateY(${24 * (1 - cardIn)}px)`, position: "absolute", inset: 0 }}>
                <DraftPanel typed={typed} optIn={optIn} btnScale={btnScale} sent={f >= 128} caret={f >= 10 && f < 80} />
              </div>
            }
          />
        </UILayer>
        <Cursor f={f} start={[btn[0] - 260, btn[1] + 260]} moves={[{ at: 104, to: [btn[0] + 6, btn[1] + 6], dur: 16 }]} clicks={[120]} size={52 / 1.3} visibleFrom={96} />
      </Camera>
      <Caption text="질문 초안을 확인하고 보내기만 하면 돼요" f={f} />
    </AbsoluteFill>
  );
}

// 위젯 질문 카드 자리 (UI 좌표)
const QCARD = { x: PANEL.x + 20, y: PANEL.y + 92, w: 338 };
const WIDGET_CAM = (s: number, dy = 0) => cam(s, ...ui(PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h / 2 + dy), 400);

// ---------- S18 · 질문은 그 장면과 함께 고객에게 가요 ----------
export function S18() {
  const f = useCurrentFrame();
  const adminO = tw(f, 0, 8, 1, 0, LINEAR);
  const worldO = tw(f, 8, 22, 0, 1, LINEAR);
  const end17 = CAM17(1);
  let c: Cam = camLerp(end17, { s: 1, fx: 960, fy: 540 }, tw(f, 0, 24, 0, 1, E_INOUT));
  if (f >= 30) c = camLerp({ s: 1, fx: 960, fy: 540 }, WIDGET_CAM(1.5), tw(f, 30, 45, 0, 1, E_INOUT));
  // 질문 카드 비행 (UI 좌표에서 보간, 왼쪽으로 크게 휘는 호)
  const p = tw(f, 4, 26, 0, 1, E_INOUT);
  const from = { x: DRAFT.x, y: DRAFT.y + 50, w: DRAFT.w };
  const to = { x: QCARD.x, y: QCARD.y, w: QCARD.w };
  const arc = Math.sin(Math.PI * p);
  const x = from.x + (to.x - from.x) * p - 520 * arc;
  const y = from.y + (to.y - from.y) * p + 60 * arc;
  const w = from.w + (to.w - from.w) * p;
  const s = 1 - 0.1 * arc;
  const rot = -10 * arc;
  const sceneH = f < 22 ? 0 : 190 * soft(f, 22);
  const landed = f >= 26;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Camera cam={c}>
        {adminO > 0 ? (
          <UILayer style={{ opacity: adminO }}>
            <AdminShell right={<DraftPanel typed={99} optIn={[1, 1, 1, 1]} btnScale={1} sent caret={false} />} />
          </UILayer>
        ) : null}
        {worldO > 0 ? (
          <UILayer style={{ opacity: worldO }}>
            <HostPage />
            <Panel>{landed ? <QuestionCard sceneH={sceneH} boxDraw={tw(f, 30, 40, 0, 1)} /> : null}</Panel>
            <div style={{ position: "absolute", left: LAUNCHER.x - 28, top: LAUNCHER.y - 28 }}>
              <Launcher x={28} y={28} open={1} />
            </div>
          </UILayer>
        ) : null}
        {!landed ? (
          <div style={{ position: "absolute", left: UI.x, top: UI.y, transform: `scale(${UI.s})`, transformOrigin: "0 0", perspective: 1600 }}>
            <div style={{ position: "absolute", left: x, top: y, transform: `rotateY(${rot}deg) scale(${s})`, transformOrigin: "50% 50%" }}>
              <QuestionCard sceneH={0} width={w} />
            </div>
          </div>
        ) : null}
      </Camera>
      <Caption text="질문은 그 장면과 함께 고객에게 가요" f={f} />
    </AbsoluteFill>
  );
}

// 질문 카드 안 위치 (카드 기준 px). 보기 1 가운데, 답변 보내기 버튼 가운데
const OPT1_Y = 190 + 14 + 38 + 8 + 44 + 8 + 21;
const SEND_Y = 190 + 14 + 38 + 8 + 44 + 8 + 5 * 42 + 10 + 23;

// ---------- S19 · 고객은 하나만 고르면 돼요 ----------
export function S19() {
  const f = useCurrentFrame();
  const scroll = f < 150 ? tw(f, 40, 58, 0, 150, E_INOUT) : tw(f, 150, 165, 150, 220, E_INOUT);
  const c = camLerp(WIDGET_CAM(1.5, -40), WIDGET_CAM(1.5, 40), tw(f, 150, 165, 0, 1, E_INOUT));
  const sel = f >= 90 ? 0 : -1;
  const selT = f < 90 ? 0 : pop(f, 90);
  const send = f < 162 ? 1 : kf(f, [[162, 1], [165, 0.97], [172, 1]], E_OUT);
  const fold = f < 166 ? 0 : soft(f, 166);
  const contentTop = PANEL.y + 84 + 8; // 패널 안 메시지 영역 위
  const opt1 = ui(QCARD.x + 130, contentTop + OPT1_Y - scroll);
  const sendPt = ui(QCARD.x + QCARD.w / 2 + 20, contentTop + SEND_Y - 220);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Camera cam={c}>
        <UILayer>
          <HostPage />
          <Panel scrollY={fold > 0 ? 220 * (1 - fold) : scroll}>
            <div style={{ position: "relative" }}>
              {fold < 1 ? (
                <div style={{ opacity: 1 - fold, transform: `scale(${1 - 0.15 * fold})`, transformOrigin: "100% 100%" }}>
                  <QuestionCard boxDraw={tw(f, 6, 18, 0, 1)} kenBurns={tw(f, 0, 60, 1, 1.06, LINEAR)} selected={sel} selectT={Math.min(1, selT)} sendScale={send} />
                </div>
              ) : null}
              {fold > 0 ? (
                <div style={{ position: "absolute", left: 0, right: 0, top: 0, opacity: fold, transform: `translateY(${16 * (1 - fold)}px)` }}>
                  <RecordingCard sub="문제 3건을 정리했어요" />
                  <div style={{ height: 14 }} />
                  <MyBubble text="글씨가 너무 굵어요" />
                </div>
              ) : null}
            </div>
          </Panel>
        </UILayer>
        <Launcher x={LF[0]} y={LF[1]} size={LSIZE} open={1} />
        <Cursor f={f} start={[opt1[0] + 220, opt1[1] + 160]} moves={[{ at: 66, to: [opt1[0], opt1[1] + 4], dur: 20 }, { at: 130, to: [sendPt[0], sendPt[1] + 4], dur: 26 }]} clicks={[86, 160]} size={52 / 1.5} visibleFrom={60} />
      </Camera>
      <Caption text="고객은 하나만 고르면 돼요" f={f} />
    </AbsoluteFill>
  );
}

// ---------- S20 · 답변은 이슈에 바로 붙어요 ----------
export function S20() {
  const f = useCurrentFrame();
  const bub = f < 2 ? 0 : soft(f, 2);
  const badge = f < 4 ? 0 : pop(f, 4);
  const chip = f < 30 ? 0 : pop(f, 30);
  const needO = tw(f, 34, 40, 1, 0, E_OUT);
  const needS = tw(f, 34, 40, 1, 0.8, E_OUT);
  const target = ui(1220, 700);
  const c = camLerp({ s: 1, fx: 960, fy: 540 }, cam(1.45, target[0], target[1], 120), tw(f, 10, 25, 0, 1, E_INOUT));
  const list = DEFAULT_LIST.map((it, i) => (i === 0 ? { ...it, preview: "답변: 글씨가 너무 굵어요", badge: 1, badgeScale: badge, time: "방금" } : it));
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Camera cam={c}>
        <UILayer>
          <AdminShell
            list={list}
            thread={
              <div>
                <RecordingChip />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                  <div style={{ padding: "12px 16px", borderRadius: 16, border: `1px solid ${C.grey200}`, width: 300 }}>
                    <p style={t(13, 600, C.accent)}>질문을 보냈어요</p>
                    <p style={t(14, 500, C.ink, { marginTop: 4 })}>{QUESTION}</p>
                  </div>
                </div>
                <div style={{ marginTop: 16, opacity: bub, transform: `translateY(${16 * (1 - bub)}px)` }}>
                  <CustomerBubble text="글씨가 너무 굵어요" time="오후 11:51" />
                </div>
              </div>
            }
            right={
              <div>
                <AnalysisHead />
                <div style={{ padding: "18px 20px 6px", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={t(18, 700, C.ink)}>문제 3건</span>
                </div>
                <IssueRow n={1} title={ISSUES[0].title} summary={ISSUES[0].summary} />
                <IssueRow n={2} title={ISSUES[1].title} summary={ISSUES[1].summary} />
                <IssueRow n={3} title={ISSUES[2].title} right={needO > 0 ? <NeedBadge scale={needS} opacity={needO} /> : null} open>
                  <p style={t(13.5, 400, C.grey600)}>“{"맨 위에 있는 전체 계약서라는 제목이요."}”</p>
                  <div style={{ marginTop: 10, display: "inline-flex", padding: "8px 12px", borderRadius: 10, background: f >= 30 ? C.blue50 : C.grey100, transform: `scale(${f >= 30 ? 0.9 + 0.1 * chip : 1})`, transformOrigin: "left center" }}>
                    <ScrambleSwap from="‘…’ 고객 답변을 기다리고 있어요" to="고객 답변 · 글씨가 너무 굵어요" f={f} start={30} dur={12} color={f >= 36 ? C.accent : C.grey600} style={t(14, 600, C.grey600)} />
                  </div>
                </IssueRow>
              </div>
            }
          />
        </UILayer>
      </Camera>
      <Caption text="답변은 이슈에 바로 붙어요" f={f} />
    </AbsoluteFill>
  );
}

export type { Pt };
