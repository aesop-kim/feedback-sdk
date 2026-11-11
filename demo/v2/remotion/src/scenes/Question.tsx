// S17~S20: 질문 초안 승인 → 질문 카드가 고객에게 → 고객이 하나 고름 → 답변이 이슈에 붙음
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, E_INOUT, E_OUT, LINEAR, kf, pop, soft, tw, ui, UI } from "../theme";
import { Caption } from "../motion/Kinetic";
import { Camera, type Cam } from "../motion/Camera";
import { Cursor, type Pt } from "../motion/Cursor";
import { HostPage, UILayer } from "../ui/Host";
import { AdminShell, AnalysisHead, CustomerBubble, DEFAULT_LIST, DraftCard, ISSUES, IssueRow, NeedBadge, RecordingChip, StatusPill } from "../ui/Admin";
import { CheckIcon } from "../ui/Icons";
import { Launcher, MyBubble, Panel, PANEL, PANEL_CONTENT_TOP, LAUNCHER, QCARD_LAYOUT, QuestionCard, QUESTION, RecordingCard, t } from "../ui/Widget";
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

// 1.6배: 화면 왼쪽 끝이 대화 영역 시작(UI x=320)에 오게 잡아 목록 열이 잘려 보이지 않게 한다.
const CAM17 = (k: number): Cam => {
  const s = 1.6;
  const fx = ui(320, 0)[0] + 960 / s;
  const a = { s, fx, fy: ui(0, DRAFT.y + 250)[1] };
  const b = { s, fx, fy: ui(0, DRAFT.y + 290)[1] };
  return camLerp(a, b, k);
};

// ---------- S17 · 질문 초안을 확인하고 보내기만 하면 돼요 ----------
export function S17() {
  const f = useCurrentFrame();
  const cardIn = f < 0 ? 0 : soft(f, 0);
  const typed = Math.floor(tw(f, 6, 46, 0, QUESTION.length, LINEAR));
  const optIn = [48, 54, 60, 66].map((a) => tw(f, a, a + 6, 0, 1));
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
                <DraftPanel typed={typed} optIn={optIn} btnScale={btnScale} sent={f >= 128} caret={f >= 6 && f < 50} />
              </div>
            }
          />
        </UILayer>
        <Cursor f={f} start={[btn[0] - 260, btn[1] + 260]} moves={[{ at: 104, to: [btn[0] + 6, btn[1] + 6], dur: 16 }]} clicks={[120]} size={52 / 1.6} visibleFrom={96} />
      </Camera>
      <Caption text="질문 초안을 확인하고 보내기만 하면 돼요" f={f} />
    </AbsoluteFill>
  );
}

// 위젯 질문 카드 자리 (UI 좌표)
const QCARD = { x: PANEL.x + 20, y: PANEL.y + PANEL_CONTENT_TOP.compact + 8, w: 338 };
const OPT_H = 38;
const QL = QCARD_LAYOUT(OPT_H);
const WIDGET_CAM = (s: number, dy = 0) => cam(s, ...ui(PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h / 2 + dy), 400);
// S19: 패널 전체(장면 + 질문 + 보기 + 버튼)가 한 화면에 들어오는 1.5배 고정
const S19_CAM = WIDGET_CAM(1.5, 14);

// ---------- S18 · 질문은 그 장면과 함께 고객에게 가요 ----------
export function S18() {
  const f = useCurrentFrame();
  const adminO = tw(f, 0, 8, 1, 0, LINEAR);
  const worldO = tw(f, 8, 22, 0, 1, LINEAR);
  const end17 = CAM17(1);
  let c: Cam = camLerp(end17, { s: 1, fx: 960, fy: 540 }, tw(f, 0, 24, 0, 1, E_INOUT));
  if (f >= 30) c = camLerp({ s: 1, fx: 960, fy: 540 }, S19_CAM, tw(f, 30, 45, 0, 1, E_INOUT));
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
            <Panel compact footer={false}>{landed ? <QuestionCard sceneH={sceneH} boxDraw={tw(f, 30, 40, 0, 1)} optH={OPT_H} /> : null}</Panel>
            <div style={{ position: "absolute", left: LAUNCHER.x - 28, top: LAUNCHER.y - 28 }}>
              <Launcher x={28} y={28} open={1} />
            </div>
          </UILayer>
        ) : null}
        {!landed ? (
          <div style={{ position: "absolute", left: UI.x, top: UI.y, transform: `scale(${UI.s})`, transformOrigin: "0 0", perspective: 1600 }}>
            <div style={{ position: "absolute", left: x, top: y, transform: `rotateY(${rot}deg) scale(${s})`, transformOrigin: "50% 50%" }}>
              <QuestionCard sceneH={0} width={w} optH={OPT_H} />
            </div>
          </div>
        ) : null}
      </Camera>
      <Caption text="질문은 그 장면과 함께 고객에게 가요" f={f} />
    </AbsoluteFill>
  );
}

// ---------- S19 · 고객은 하나만 고르면 돼요 ----------
// 장면(제목 하이라이트)이 샷 내내 질문·보기 위에 보이도록 스크롤하지 않는다.
export function S19() {
  const f = useCurrentFrame();
  const c = S19_CAM;
  const sel = f >= 90 ? 0 : -1;
  const selT = f < 90 ? 0 : pop(f, 90);
  const send = f < 162 ? 1 : kf(f, [[162, 1], [165, 0.97], [172, 1]], E_OUT);
  const fold = f < 166 ? 0 : soft(f, 166);
  const opt1 = ui(QCARD.x + 130, QCARD.y + QL.opt1);
  const sendPt = ui(QCARD.x + QCARD.w / 2 + 20, QCARD.y + QL.send);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Camera cam={c}>
        <UILayer>
          <HostPage />
          <Panel compact footer={false}>
            <div style={{ position: "relative" }}>
              {fold < 1 ? (
                <div style={{ opacity: 1 - fold, transform: `scale(${1 - 0.15 * fold})`, transformOrigin: "100% 100%" }}>
                  <QuestionCard boxDraw={tw(f, 6, 18, 0, 1)} kenBurns={tw(f, 0, 60, 1, 1.06, LINEAR)} selected={sel} selectT={Math.min(1, selT)} sendScale={send} optH={OPT_H} />
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
  // 상태 배지: 질문 보냄 → 답변 받음 (IssueItem.tsx findStatusPill)
  const askedO = tw(f, 30, 36, 1, 0, E_OUT);
  const swap = tw(f, 30, 38, 0, 1, E_OUT);
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
                <IssueRow
                  n={3}
                  title={ISSUES[2].title}
                  right={f < 30 ? <StatusPill label="질문 보냄" tone="blue" opacity={askedO} /> : <StatusPill label="답변 받음" tone="blue" scale={0.9 + 0.1 * chip} />}
                  open
                >
                  <p style={t(13.5, 400, C.grey600)}>“{"맨 위에 있는 전체 계약서라는 제목이요."}”</p>
                  <div style={{ position: "relative", marginTop: 10 }}>
                    {/* 질문을 보내고 기다리는 줄 (IssueItem .waiting) */}
                    {swap < 1 ? (
                      <div style={{ padding: "10px 12px", borderRadius: 12, background: C.grey50, opacity: 1 - swap, ...t(13, 400, C.grey600, { lineHeight: 1.5 }) }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 600, color: C.accent }}>
                          <CheckIcon size={14} color={C.accent} />
                          고객에게 질문을 보냈어요
                        </span>
                        <span style={{ display: "block", fontWeight: 600, color: C.grey800 }}>{QUESTION}</span>
                        고객 답변을 기다리고 있어요
                      </div>
                    ) : null}
                    {/* 답이 오면 고객 답변 줄 (IssueItem .answer) */}
                    {swap > 0 ? (
                      <div style={{ position: swap < 1 ? "absolute" : "relative", left: 0, right: 0, top: 0, padding: "10px 12px", borderRadius: 12, background: C.grey50, opacity: swap, transform: `scale(${0.96 + 0.04 * chip})`, transformOrigin: "left center", ...t(15, 500, C.ink, { lineHeight: 1.5 }) }}>
                        <span style={{ color: C.accent, fontWeight: 600 }}>고객 답변</span>
                        <span style={{ margin: "0 6px", color: C.grey400 }}>·</span>
                        글씨가 너무 굵어요
                      </div>
                    ) : null}
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
