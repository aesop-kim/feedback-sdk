// S22b · 화면 영역 캡처 (PR #123, feelforte). 문구·색은 실제 코드에서 옮겼다.
// - 위젯 버튼: WidgetFeedbackActions.tsx "화면 녹화로 설명하기" / "화면 캡처로 설명하기"(#eaeaea)
// - 선택 오버레이: sdk/launcher-styles.ts CAPTURE_STYLES (rgba(0,20,45,.46) 바깥 어둡게, #4695ff 테두리, 위 가운데 안내 카드)
// - 입력창 미리보기 → 보내기 → WidgetAttachmentReview "이대로 피드백을 전송할까요?" [수정하기][전송 확인]
// - 요약 문구: "선택한 영역에 ‘체결 여부’ 문구가 보여요." / 전송 후 "피드백을 전송했어요."
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, E_INOUT, E_OUT, LINEAR, UI, kf, soft, tw, ui } from "../theme";
import { Caption } from "../motion/Kinetic";
import { Camera, type Cam } from "../motion/Camera";
import { Cursor } from "../motion/Cursor";
import { HostCrop, HostPage, UILayer } from "../ui/Host";
import { ScreenIcon, ScreenMicIcon, SendIcon } from "../ui/Icons";
import { Launcher, LAUNCHER, PANEL, Panel, t } from "../ui/Widget";
import { cam, camLerp } from "./Record";
import { TileWipe } from "./Outro";

export const CAPTURE_LEN = 390;

// 고를 영역(UI 좌표): '체결 여부' 머리글과 상태 칩 세 줄 (오타는 앞 장면에서 이미 고쳤으므로 다른 문제를 고른다)
const REGION = { x: 1312, y: 58, w: 112, h: 176 };
const DESC = "체결 여부 표시가 헷갈려요";

// 타이밍(장면 안 프레임)
const CLICK_CAPTURE = 44;
const HIDE = [50, 62];
const DIM_IN = [62, 72];
const DOWN = 100;
const UP = 136;
const DIM_OUT = [146, 156];
const BACK = [154, 170];
const TYPE = [172, 208];
const CLICK_SEND = 222;
const REVIEW_IN = 230;
const CLICK_CONFIRM = 268;
const SENT = 276;

const LF = ui(LAUNCHER.x, LAUNCHER.y);
const panelPt = (x: number, y: number) => ui(PANEL.x + x, PANEL.y + y);

function CaptureIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0 }}>
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <rect x="8.5" y="8.5" width="7" height="7" rx="1" />
    </svg>
  );
}

/** 위젯 첫 화면: 안내 + 두 버튼(실제 WidgetEmptyState + WidgetFeedbackActions) */
function Actions({ capPress }: { capPress: number }) {
  const btn = { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 54, borderRadius: 16 } as const;
  return (
    <div>
      <p style={t(19, 700, C.ink, { letterSpacing: -0.3, marginTop: 6 })}>말로 설명하면 저희가 정리할게요</p>
      <p style={t(14, 400, C.grey600, { marginTop: 6 })}>어느 화면의 어떤 버튼인지 따로 적지 않아도 돼요</p>
      <div style={{ height: 250 }} />
      <div style={{ ...btn, background: C.accent, ...t(16, 600, "#fff") }}>
        <ScreenMicIcon size={22} />
        화면 녹화로 설명하기
      </div>
      <div style={{ ...btn, marginTop: 8, background: "#eaeaea", transform: `scale(${capPress})`, ...t(16, 600, C.ink) }}>
        <CaptureIcon />
        화면 캡처로 설명하기
      </div>
      <p style={t(13, 400, C.grey500, { textAlign: "center", marginTop: 12 })}>최대 3분이에요. 글로 남기려면 아래에 적어 주세요</p>
    </div>
  );
}

/** 고른 영역을 그대로 잘라 보여 주는 썸네일 */
function Shot({ h }: { h: number }) {
  const zoom = h / REGION.h;
  return (
    <div style={{ width: REGION.w * zoom, height: h, borderRadius: 10, overflow: "hidden", border: `1px solid ${C.grey200}` }}>
      <HostCrop w={REGION.w * zoom} h={h} cx={REGION.x + REGION.w / 2} cy={REGION.y + REGION.h / 2} zoom={zoom} />
    </div>
  );
}

/** 입력창: 캡처가 붙으면 위에 미리보기 줄이 생긴다(WidgetComposer capturePreview) */
function Composer({ attach, text, sendActive, sendPress }: { attach: number; text: string; sendActive: boolean; sendPress: number }) {
  const previewH = 128 * attach;
  return (
    <div style={{ position: "absolute", left: PANEL.x, width: PANEL.w, top: PANEL.y + PANEL.h - 74 - previewH, height: 74 + previewH, background: C.surface, border: `1px solid ${C.grey200}`, borderRadius: "0 0 20px 20px", overflow: "hidden", boxSizing: "border-box" }}>
      {attach > 0 ? (
        <div style={{ position: "absolute", left: 20, top: 12, opacity: attach, transform: `scale(${0.9 + 0.1 * attach})`, transformOrigin: "0 0", display: "flex", gap: 8 }}>
          <Shot h={104} />
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: C.grey200, display: "flex", alignItems: "center", justifyContent: "center", ...t(14, 600, C.grey700, { lineHeight: 1 }) }}>×</div>
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 26, bottom: 25, color: C.grey700 }}>
        <ScreenIcon size={22} />
      </div>
      <div style={{ position: "absolute", left: 68, right: 16, bottom: 15, height: 44, borderRadius: 22, background: C.grey100, display: "flex", alignItems: "center", padding: "0 6px 0 14px" }}>
        <span style={t(14, 400, text ? C.ink : C.grey500, { flex: 1 })}>{text || "메시지를 입력해 주세요"}</span>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: sendActive ? C.accent : C.grey300, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", transform: `scale(${sendPress})` }}>
          <SendIcon size={18} stroke={2.2} />
        </div>
      </div>
    </div>
  );
}

/** 전송 전 확인 카드(WidgetAttachmentReview) */
function Review({ k, confirmPress }: { k: number; confirmPress: number }) {
  const b = { minHeight: 44, padding: "0 16px", borderRadius: 12, display: "inline-flex", alignItems: "center" } as const;
  return (
    <section style={{ padding: 16, borderRadius: 20, background: C.grey50, textAlign: "center", opacity: k, transform: `translateY(${20 * (1 - k)}px)` }}>
      <p style={t(14, 400, C.grey700)}>선택한 영역에 ‘체결 여부’ 문구가 보여요.</p>
      <p style={t(14, 400, C.grey700, { marginTop: 8 })}>작성한 설명 · {DESC}</p>
      <p style={t(15, 600, C.ink, { margin: "12px 0" })}>이대로 피드백을 전송할까요?</p>
      <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
        <span style={{ ...b, background: C.grey100, ...t(15, 600, C.ink) }}>수정하기</span>
        <span style={{ ...b, background: C.accent, transform: `scale(${confirmPress})`, ...t(15, 600, "#fff") }}>전송 확인</span>
      </div>
    </section>
  );
}

/** 보낸 캡처(MessageList capture): 오른쪽 정렬 사진 + 설명 말풍선 */
function Sent({ k }: { k: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, opacity: k, transform: `translateY(${24 * (1 - k)}px)` }}>
      <Shot h={220} />
      <div style={{ maxWidth: 280, padding: "11px 14px", borderRadius: 18, background: C.accent, ...t(15, 500, "#fff") }}>{DESC}</div>
    </div>
  );
}

const press = (f: number, at: number) => (f < at ? 1 : kf(f, [[at, 1], [at + 3, 0.94], [at + 10, 1]], E_OUT));

export function S22b() {
  const f = useCurrentFrame();

  // 위젯 보이기/숨기기
  const inK = soft(f, 0);
  const hideK = tw(f, HIDE[0], HIDE[1], 1, 0, E_INOUT);
  const backK = f < BACK[0] ? 0 : tw(f, BACK[0], BACK[1], 0, 1, E_OUT);
  const panelK = f < HIDE[1] ? hideK : backK;
  const panelOn = panelK > 0.001;

  // 선택 오버레이
  const dim = f < DIM_OUT[0] ? tw(f, DIM_IN[0], DIM_IN[1], 0, 1) : tw(f, DIM_OUT[0], DIM_OUT[1], 1, 0);
  const a = { x: REGION.x, y: REGION.y };
  const b = { x: REGION.x + REGION.w, y: REGION.y + REGION.h };
  const dragK = tw(f, DOWN, UP, 0, 1, E_INOUT);
  const sel = f < DOWN ? null : { x: a.x, y: a.y, w: (b.x - a.x) * dragK, h: (b.y - a.y) * dragK };
  const flash = f >= UP && f < UP + 10 ? tw(f, UP, UP + 10, 0.55, 0, E_OUT) : 0;

  // 입력·전송
  const attach = f < BACK[1] ? 0 : tw(f, BACK[1], BACK[1] + 10, 0, 1, E_OUT);
  const typed = f < TYPE[0] ? "" : DESC.slice(0, Math.round(tw(f, TYPE[0], TYPE[1], 0, DESC.length, LINEAR)));
  const composerAttach = f < SENT ? attach : tw(f, SENT, SENT + 8, 1, 0, E_INOUT);
  const composerText = f < SENT ? typed : "";
  const reviewK = f < REVIEW_IN ? 0 : f < SENT ? tw(f, REVIEW_IN, REVIEW_IN + 10, 0, 1) : tw(f, SENT, SENT + 6, 1, 0);
  const sentK = f < SENT + 2 ? 0 : tw(f, SENT + 2, SENT + 14, 0, 1);
  const noteK = tw(f, SENT + 12, SENT + 22, 0, 1);

  // 커서(프레임 좌표)
  const capBtn = panelPt(PANEL.w / 2, PANEL.h - 74 - 82);
  const sendBtn = panelPt(PANEL.w - 39, PANEL.h - 37);
  const confirmBtn = panelPt(PANEL.w / 2 + 52, 84 + 8 + 168);
  const pA = ui(a.x, a.y);
  const pB = ui(b.x, b.y);

  // 카메라: 위젯 확대 → 고객사 화면(선택 영역) → 위젯 → 보낸 사진
  const panelCam = cam(1.45, ...panelPt(PANEL.w / 2, PANEL.h / 2 + 40), 160);
  const regionCam = cam(1.55, (pA[0] + pB[0]) / 2 - 150, (pA[1] + pB[1]) / 2 + 60, 60);
  const sentCam = cam(1.75, ...panelPt(PANEL.w / 2 + 40, 84 + 8 + 150), 160);
  let c: Cam = panelCam;
  if (f >= HIDE[0]) c = camLerp(panelCam, regionCam, tw(f, HIDE[0], DIM_IN[1] + 6, 0, 1, E_INOUT));
  if (f >= DIM_OUT[0]) c = camLerp(regionCam, panelCam, tw(f, DIM_OUT[0], BACK[1] + 6, 0, 1, E_INOUT));
  if (f >= SENT) c = camLerp(panelCam, sentCam, tw(f, SENT, SENT + 24, 0, 1, E_INOUT));
  const drift = f >= SENT + 24 ? tw(f, SENT + 24, CAPTURE_LEN, 0, 0.05, LINEAR) : 0;
  c = { ...c, s: c.s + drift };

  const captions: [number, number, string][] = [
    [0, BACK[0], "말로 하기 어려우면, 화면을 잘라 보내요"],
    [BACK[0], SENT, "고른 부분이 사진으로 붙어요"],
    [SENT, CAPTURE_LEN, "설명과 함께 바로 전달돼요"],
  ];

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Camera cam={c}>
        <UILayer style={{ opacity: Math.min(1, inK * 1.4) }}>
          <HostPage />
          {/* 선택 오버레이 */}
          {dim > 0 ? (
            <div style={{ position: "absolute", inset: 0, opacity: dim }}>
              <svg style={{ position: "absolute", left: 0, top: 0 }} width={UI.w} height={UI.h}>
                <path fillRule="evenodd" fill="rgba(0,20,45,0.46)" d={sel && sel.w > 0 ? `M0 0H${UI.w}V${UI.h}H0Z M${sel.x} ${sel.y}h${sel.w}v${sel.h}h${-sel.w}Z` : `M0 0H${UI.w}V${UI.h}H0Z`} />
              </svg>
              {sel && sel.w > 0 ? <div style={{ position: "absolute", left: sel.x, top: sel.y, width: sel.w, height: sel.h, border: "2px solid #4695ff", background: `rgba(255,255,255,${flash})` }} /> : null}
              <div style={{ position: "absolute", top: 12, left: UI.w / 2, transform: "translateX(-50%)", padding: "12px 16px", borderRadius: 12, background: "#fff", width: 440 }}>
                <p style={t(14, 700, "#172b4d")}>캡처 영역 선택</p>
                <p style={t(14, 400, "#172b4d", { margin: "4px 0 8px" })}>드래그하거나 방향키로 이동해 Enter로 두 모서리를 선택해 주세요.</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ minHeight: 40, padding: "0 12px", borderRadius: 8, background: "#1957c2", display: "inline-flex", alignItems: "center", ...t(14, 500, "#fff") }}>{f < DOWN ? "시작점 선택" : "선택 완료"}</span>
                  <span style={{ minHeight: 40, padding: "0 12px", borderRadius: 8, border: "1px solid #385980", display: "inline-flex", alignItems: "center", ...t(14, 500, "#172b4d") }}>취소</span>
                </div>
              </div>
            </div>
          ) : null}
          {panelOn ? (
            <div style={{ position: "absolute", inset: 0, opacity: panelK, transform: `translateY(${16 * (1 - panelK)}px)` }}>
              {f < HIDE[1] ? (
                <Panel>
                  <Actions capPress={press(f, CLICK_CAPTURE)} />
                </Panel>
              ) : (
                <>
                  <Panel footer={false}>
                    <div style={{ height: 8 }} />
                    {reviewK > 0 ? <Review k={reviewK} confirmPress={press(f, CLICK_CONFIRM)} /> : null}
                    {sentK > 0 ? <Sent k={sentK} /> : null}
                    {noteK > 0 ? <p style={t(13, 400, C.grey600, { textAlign: "center", marginTop: 14, opacity: noteK })}>피드백을 전송했어요.</p> : null}
                  </Panel>
                  <Composer attach={composerAttach} text={composerText} sendActive={typed.length > 0 && f < SENT} sendPress={press(f, CLICK_SEND)} />
                </>
              )}
            </div>
          ) : null}
        </UILayer>
        <Launcher x={LF[0]} y={LF[1]} size={56 * UI.s} open={panelOn ? 1 : 0} scale={panelOn ? 1 : tw(f, HIDE[1], HIDE[1] + 4, 1, 0)} />
        <Cursor
          f={f}
          start={[capBtn[0] - 220, capBtn[1] + 160]}
          moves={[
            { at: 14, to: [capBtn[0] + 10, capBtn[1] + 6], dur: 24 },
            { at: 66, to: [pA[0], pA[1]], dur: 26 },
            { at: DOWN, to: [pB[0], pB[1]], dur: UP - DOWN, bend: 0 },
            { at: 150, to: [sendBtn[0] - 120, sendBtn[1] - 60], dur: 24 },
            { at: 208, to: [sendBtn[0], sendBtn[1]], dur: 12 },
            { at: 240, to: [confirmBtn[0], confirmBtn[1]], dur: 20 },
            { at: 290, to: [confirmBtn[0] + 160, confirmBtn[1] + 200], dur: 20 },
          ]}
          clicks={[CLICK_CAPTURE, DOWN, CLICK_SEND, CLICK_CONFIRM]}
          opacity={f < 300 ? 1 : tw(f, 300, 306, 1, 0, LINEAR)}
        />
      </Camera>
      {captions.map(([from, to, text]) => (f >= from && f < to ? <Caption key={text} text={text} f={f - from} /> : null))}
      <TileWipe f={f} start={CAPTURE_LEN - 12} />
    </AbsoluteFill>
  );
}
