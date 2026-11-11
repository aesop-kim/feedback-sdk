// S14~S16: AI가 녹화 한 번에서 문제 3건을 찾는다
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, E_INOUT, E_OUT, FONT, LINEAR, pop, soft, tw } from "../theme";
import { Caption, Roll } from "../motion/Kinetic";
import { Camera } from "../motion/Camera";
import { HostCrop } from "../ui/Host";
import { FilmIcon, ListCheckIcon, MicIcon, PointerIcon, SplitIcon, ChevronDown } from "../ui/Icons";
import { DETAIL_SUMMARY, DoneChip, ISSUES, NeedBadge, QUOTE } from "../ui/Admin";
import { SCENE_BOX, t } from "../ui/Widget";

export const S14_ITEMS = ["말한 내용 받아쓰기", "장면 찾기", "가리킨 곳 찾기", "문제별로 나누기", "문제 3건을 찾아요"];
const S14_ICONS = [MicIcon, FilmIcon, PointerIcon, SplitIcon, ListCheckIcon];

// ---------- S14 · 녹화 한 번에서 문제 3건을 찾아요 ----------
export function S14() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Roll f={f} phrase="녹화 한 번에서" phraseStart={0} items={S14_ITEMS} icons={S14_ICONS} moves={[30, 54, 70, 80, 86]} typeStart={8} typeGap={5} lastBold />
    </AbsoluteFill>
  );
}

// 이슈 카드 레이아웃 (프레임 좌표)
export const CARD = { x: 410, w: 1100, h: 150, ys: [292, 462, 632] };
const HEADER = { x: 410, y: 214, size: 52 };
// S14 마지막 줄 위치(Roll: listLeft 900 + 아이콘 48 + 간격 30)
const S14_LAST = { x: 978, y: 540, size: 104 };

export function IssuesHeader({ f, morph = true, sub = true }: { f: number; morph?: boolean; sub?: boolean }) {
  const k = morph ? tw(f, 0, 12, 0, 1, E_INOUT) : 1;
  const x = S14_LAST.x + (HEADER.x - S14_LAST.x) * k;
  const y = S14_LAST.y + (HEADER.y - S14_LAST.y) * k;
  const size = S14_LAST.size + (HEADER.size - S14_LAST.size) * k;
  const weight = 800 - 100 * k;
  const restO = morph ? tw(f, 0, 4, 1, 0, LINEAR) : 0;
  const subO = sub ? (morph ? tw(f, 8, 14, 0, 1, E_OUT) : 1) : 0;
  return (
    <div style={{ position: "absolute", left: x, top: y - size * 0.6, height: size * 1.2, display: "flex", alignItems: "center", fontFamily: FONT, whiteSpace: "nowrap" }}>
      <span style={{ fontSize: size, fontWeight: weight, color: C.ink, letterSpacing: -size * 0.02, lineHeight: 1 }}>문제 3건</span>
      {restO > 0 ? <span style={{ fontSize: size, fontWeight: weight, color: C.ink, letterSpacing: -size * 0.02, lineHeight: 1, opacity: restO }}>을 찾아요</span> : null}
      <span style={{ fontSize: 36, fontWeight: 600, color: C.grey600, marginLeft: 22, opacity: subO, lineHeight: 1 }}>· 확인 필요 1건</span>
    </div>
  );
}

/** 큰 이슈 카드 (S15, S16, S21). 프레임 좌표 크기 */
export function IssueCard({ i, h = CARD.h, badge = 0, badgeO = 1, thumbS = 1, titleColor = C.ink, right, children, thumbO = 1 }: { i: number; h?: number; badge?: number; badgeO?: number; thumbS?: number; titleColor?: string; right?: React.ReactNode; children?: React.ReactNode; thumbO?: number }) {
  const is = ISSUES[i];
  return (
    <div style={{ position: "relative", width: CARD.w, height: h, borderRadius: 20, background: C.surface, border: `1px solid ${C.grey200}`, overflow: "hidden", fontFamily: FONT }}>
      <span style={t(30, 700, C.grey400, { position: "absolute", left: 38, top: 30 })}>{i + 1}</span>
      <div style={{ position: "absolute", left: 84, top: 30, display: "flex", alignItems: "center", gap: 16 }}>
        <span style={t(32, 700, titleColor, { letterSpacing: -0.6, whiteSpace: "nowrap" })}>{is.title}</span>
        {badge > 0 ? <NeedBadge size={22} scale={badge} opacity={badgeO} /> : null}
      </div>
      <p style={t(23, 500, C.grey600, { position: "absolute", left: 84, top: 84, width: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" })}>{is.summary}</p>
      {right ? <div style={{ position: "absolute", right: 268, top: 30 }}>{right}</div> : null}
      {thumbO > 0 ? (
        <div style={{ position: "absolute", right: 12, top: 12, width: 224, height: 126, borderRadius: 12, overflow: "hidden", opacity: thumbO }}>
          <div style={{ transform: `scale(${thumbS})` }}>
            <HostCrop w={224} h={126} cx={is.crop.cx} cy={is.crop.cy} zoom={is.crop.zoom} />
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}

// ---------- S15 · 문제마다 장면과 말한 내용이 남아요 ----------
export function S15() {
  const f = useCurrentFrame();
  const drift = f < 60 ? 1 : tw(f, 60, 180, 1, 1.025, LINEAR);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ transform: `scale(${drift})`, transformOrigin: "960px 520px" }}>
        <IssuesHeader f={f} />
        <AbsoluteFill style={{ perspective: 1600 }}>
          {CARD.ys.map((y, i) => {
            const T0 = 10 + 8 * i;
            if (f < T0) return null;
            const p = soft(f, T0);
            return (
              <div key={i} style={{ position: "absolute", left: CARD.x, top: y + 80 * (1 - p), opacity: Math.min(1, p * 1.6), transform: `rotateX(${12 * (1 - p)}deg)`, transformOrigin: "50% 0%" }}>
                <IssueCard i={i} thumbS={tw(f, T0 + 4, T0 + 14, 1.15, 1)} badge={i === 2 && f >= 44 ? pop(f, 44) : 0} />
              </div>
            );
          })}
        </AbsoluteFill>
      </AbsoluteFill>
      <Caption text="문제마다 장면과 말한 내용이 남아요" f={f} />
    </AbsoluteFill>
  );
}

// ---------- S16 · 확인이 필요한 문제는 따로 표시돼요 ----------
const EXP_H = 600;
export function S16() {
  const f = useCurrentFrame();
  const other = tw(f, 0, 10, 0, 1, E_OUT);
  const hk = f < 6 ? 0 : soft(f, 6);
  const h = CARD.h + (EXP_H - CARD.h) * hk;
  const cy = CARD.ys[2] + EXP_H / 2;
  const k = tw(f, 0, 18, 0, 1, E_INOUT);
  const cam = { s: 1 + 0.35 * k, fx: 960, fy: 520 + (cy - 520) * k };
  const line = (n: number) => ({ opacity: tw(f, 16 + 3 * n, 24 + 3 * n, 0, 1), transform: `translateY(${tw(f, 16 + 3 * n, 24 + 3 * n, 12, 0)}px)` });
  // 썸네일 → 장면 이미지 레이아웃 모프
  const m = tw(f, 6, 20, 0, 1, E_INOUT);
  const img = { x: 1100 - 12 - 224 + (84 - (1100 - 12 - 224)) * m, y: 12 + (112 - 12) * m, w: 224 + (600 - 224) * m, h: 126 + (338 - 126) * m };
  const boxDraw = tw(f, 30, 42, 0, 1);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Camera cam={cam}>
        <AbsoluteFill style={{ transform: `scale(1.025)`, transformOrigin: "960px 520px" }}>
          <IssuesHeader f={99} morph={false} />
          {[0, 1].map((i) => (
            <div key={i} style={{ position: "absolute", left: CARD.x, top: CARD.ys[i] - 20 * other, opacity: 1 - 0.7 * other }}>
              <IssueCard i={i} />
            </div>
          ))}
          <div style={{ position: "absolute", left: CARD.x, top: CARD.ys[2] }}>
            <IssueCard i={2} h={h} badge={1} thumbO={0}>
              <div style={{ position: "absolute", left: img.x, top: img.y, width: img.w, height: img.h, borderRadius: 14, overflow: "hidden" }}>
                <HostCrop w={img.w} h={img.h} cx={330 + 90 * m} cy={60 + 130 * m} zoom={1.2 - 0.3 * m} box={m > 0.5 ? SCENE_BOX : undefined} boxDraw={boxDraw} />
              </div>
              <div style={{ position: "absolute", left: 716, top: 112, width: 350 }}>
                <p style={{ ...t(18, 600, C.grey500), ...line(0) }}>고객이 한 말</p>
                <p style={{ ...t(22, 500, C.grey700, { marginTop: 6, lineHeight: 1.5 }), ...line(1) }}>“{QUOTE}”</p>
                <p style={{ ...t(18, 600, C.grey500, { marginTop: 22 }), ...line(2) }}>요약</p>
                <p style={{ ...t(21, 500, C.ink, { marginTop: 6, lineHeight: 1.5, width: 372 }), ...line(3) }}>{DETAIL_SUMMARY}</p>
              </div>
              <div style={{ position: "absolute", left: 84, right: 36, top: 486, height: 76, borderRadius: 16, background: C.grey50, display: "flex", alignItems: "center", padding: "0 24px", ...line(5) }}>
                <span style={t(24, 700, C.ink, { flex: 1 })}>고객에게 물어볼 질문 초안이 준비됐어요</span>
                <div style={{ color: C.grey500, transform: "rotate(-90deg)" }}>
                  <ChevronDown size={28} />
                </div>
              </div>
            </IssueCard>
          </div>
        </AbsoluteFill>
      </Camera>
      <Caption text="확인이 필요한 문제는 따로 표시돼요" f={f} />
    </AbsoluteFill>
  );
}

export { DoneChip };
