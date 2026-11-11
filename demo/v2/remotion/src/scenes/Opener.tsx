// S01~S06: 문제 → 배경 반전 → 소개 (Marker.io식 오프너)
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, E_INOUT, E_OUT, FONT, LINEAR, T, mix, pop, rand, soft, tw, ui } from "../theme";
import { Caption, SylType, springPop, wordPop } from "../motion/Kinetic";
import { HostPage, UILayer } from "../ui/Host";
import { CheckIcon, ChatIcon } from "../ui/Icons";
import { Launcher } from "../ui/Widget";
import { t } from "../ui/Widget";

// ---------- S01 · 새 화면을 배포했어요 ----------
export function S01() {
  const f = useCurrentFrame();
  const drift = tw(f, 28, 90, 1, 1.015, LINEAR);
  const lift = tw(f, 22, 28, 0, 1, E_OUT);
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT }}>
      <div style={{ position: "absolute", left: 200, top: 0, width: 1600, height: 1080, transform: `scale(${drift})`, transformOrigin: "200px 540px" }}>
        <div style={{ position: "absolute", left: 0, top: 540 - 50 - 112 * lift, display: "flex", gap: "0 0.28em", ...T.head, color: C.ink, lineHeight: "100px" }}>
          <span style={{ display: "inline-block", transformOrigin: "left center", ...wordPop(f, 6) }}>새</span>
          <span style={{ display: "inline-block", transformOrigin: "left center", ...wordPop(f, 14) }}>화면을</span>
        </div>
        <div style={{ position: "absolute", left: -6, top: 540 - 50 - 112 * lift + 100, ...T.display, color: C.ink, lineHeight: "190px", transformOrigin: "left center", whiteSpace: "nowrap", ...springPop(f, 22, 1.12) }}>배포했어요.</div>
      </div>
    </AbsoluteFill>
  );
}

// ---------- S02 · 이제 고객사 확인만 남았어요 ----------
export function Toast({ f, at }: { f: number; at: number }) {
  if (f < at) return null;
  const x = tw(f, at, at + 4, 120, 0);
  const o = tw(f, at, at + 4, 0, 1);
  const draw = tw(f, at + 4, at + 10, 0, 1);
  return (
    <div style={{ position: "absolute", right: 1920 - 1700, top: 96, transform: `translateX(${x}px)`, opacity: o, display: "flex", alignItems: "center", gap: 12, height: 64, padding: "0 28px 0 18px", borderRadius: 999, background: C.surface, outline: `1px solid ${C.grey200}` }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CheckIcon size={20} color="#fff" stroke={2.6} draw={draw} />
      </div>
      <span style={t(26, 700, C.ink, { lineHeight: 1 })}>배포 완료</span>
    </div>
  );
}

export function S02() {
  const f = useCurrentFrame();
  const s = tw(f, 0, 6, 0.02, 1, E_OUT) * tw(f, 8, 90, 1, 1.02, LINEAR);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ transform: `scale(${s})`, transformOrigin: "960px 540px" }}>
        <UILayer>
          <HostPage />
        </UILayer>
        <Toast f={f} at={30} />
      </AbsoluteFill>
      <Caption text="이제 고객사 확인만 남았어요" f={f} />
    </AbsoluteFill>
  );
}

// ---------- 메신저 카드 (S03 뒷면, S04) ----------
type Msg = { who: "c" | "u"; text: string; image?: boolean };
export const MESSAGES: Msg[] = [
  { who: "c", text: "등록 버튼이 안 눌려요" },
  { who: "u", text: "어느 화면이요?" },
  { who: "c", text: "계약서 목록이요. 위에 있는 파란 거요" },
  { who: "c", text: "표에 오타도 있어요" },
  { who: "u", text: "캡처 보내 주실 수 있을까요?" },
  { who: "c", text: "위에 글씨도 좀 이상해요" },
  { who: "u", text: "어떤 글씨요?" },
  { who: "c", text: "아까 말씀드린 그거요" },
  { who: "c", text: "여기요", image: true },
  { who: "u", text: "어떤 버튼을 누르셨나요?" },
  { who: "c", text: "다시 한번 볼게요" },
  { who: "c", text: "확인 부탁드려요" },
];
const TIMES = ["오후 2:03", "오후 2:05", "오후 2:11", "오후 2:12", "오후 2:30", "오후 2:41", "오후 3:02", "오후 3:15", "오후 3:16", "오후 3:40", "오후 4:05", "오후 4:06"];

export function MessengerCard({ i }: { i: number }) {
  const m = MESSAGES[i];
  const mine = m.who === "u";
  return (
    <div style={{ width: 640, height: 200, borderRadius: 20, background: C.surface, border: `1px solid ${C.grey800}`, padding: "22px 28px", boxSizing: "border-box", fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: mine ? "flex-end" : "flex-start" }}>
        {!mine ? <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.grey200 }} /> : null}
        <span style={t(20, 700, C.grey800)}>{mine ? "우리 팀" : "고객사 담당자"}</span>
        <span style={t(18, 500, C.grey500)}>{TIMES[i]}</span>
      </div>
      <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", alignItems: "center", gap: 14, marginTop: 18 }}>
        <div style={{ padding: "16px 24px", borderRadius: 24, background: mine ? C.accent : C.grey100, ...t(30, 600, mine ? "#fff" : C.ink, { lineHeight: 1.2, whiteSpace: "nowrap", letterSpacing: -0.4 }) }}>{m.text}</div>
        {m.image ? (
          <div style={{ position: "relative", width: 150, height: 92, borderRadius: 12, background: C.grey200 }}>
            <div style={{ position: "absolute", left: 40, top: 22, width: 70, height: 40, borderRadius: 6, border: `3px solid ${C.accent}` }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------- S03 · 그런데 (배경 반전 + 플립 휩) ----------
export function S03() {
  const f = useCurrentFrame();
  const wipeY = tw(f, 0, 3, -1080, 0, LINEAR);
  const wordO = f < 18 ? 1 : tw(f, 18, 20, 1, 0, LINEAR);
  const p = tw(f, 20, 27, 0, 1, E_INOUT);
  const flipping = f >= 20;
  const angle = p < 0.5 ? p * 180 : (p - 1) * 180;
  const bw = 1536 + (640 - 1536) * p;
  const bh = 960 + (200 - 960) * p;
  const blur = flipping ? Math.sin(Math.PI * p) * 7 : 0;
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* S02 마지막 상태 */}
      <AbsoluteFill style={{ transform: "scale(1.02)", transformOrigin: "960px 540px" }}>
        <UILayer>
          <HostPage />
        </UILayer>
        <Toast f={99} at={30} />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, top: wipeY, width: 1920, height: 1080, background: C.ink }} />
      {f >= 2 && f < 20 ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
          <span style={{ display: "inline-block", ...T.title, color: "#fff", ...wordPop(f, 2), ...(f >= 18 ? { opacity: wordO } : {}) }}>그런데</span>
        </AbsoluteFill>
      ) : null}
      {flipping ? (
        <AbsoluteFill style={{ perspective: 1600, perspectiveOrigin: "960px 540px" }}>
          <div style={{ position: "absolute", left: 960 - bw / 2, top: 540 - bh / 2, width: bw, height: bh, transform: `rotateY(${angle}deg)`, filter: blur > 0.3 ? `blur(${blur}px)` : undefined, borderRadius: 20, overflow: "hidden", background: C.surface }}>
            {p < 0.5 ? (
              <div style={{ width: 1440, height: 900, transform: `scale(${bw / 1440}, ${bh / 900})`, transformOrigin: "0 0", position: "relative" }}>
                <HostPage />
              </div>
            ) : (
              <div style={{ transform: `scale(${bw / 640}, ${bh / 200})`, transformOrigin: "0 0" }}>
                <MessengerCard i={0} />
              </div>
            )}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
}

// ---------- S04 · 피드백은 이렇게 와요 ----------
export const CARD_T = [0, 20, 38, 54, 68, 80, 91, 101, 110, 118, 125, 131];
const cardPose = (n: number) => {
  if (n === 0) return { x: 0, y: 0, r: -3 };
  const side = n % 2 === 1 ? -1 : 1;
  return {
    x: side * (80 + rand(n * 3.1) * 280),
    y: (rand(n * 7.7) - 0.5) * 400,
    r: (rand(n * 5.3) > 0.5 ? 1 : -1) * (4 + rand(n * 2.9) * 8),
    sx: side * 1100,
    sy: (rand(n * 1.9) - 0.5) * 400,
    sr: side * 18,
  };
};

export function S04() {
  const f = useCurrentFrame();
  const cam = f < 120 ? 1 : tw(f, 120, 180, 1, 1.06, LINEAR);
  const arrived = CARD_T.filter((tt) => f >= tt).length;
  const count = f >= 160 ? "99+" : String(arrived);
  const lastT = CARD_T[arrived - 1] ?? 0;
  const badgeScale = f >= 160 ? (f < 166 ? tw(f, 160, 166, 1, 1.4, E_OUT) : 1.4 - 0.4 * pop(f, 166)) : 1.3 - 0.3 * pop(f, lastT);
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <AbsoluteFill style={{ transform: `scale(${cam})`, transformOrigin: "960px 540px" }}>
        {MESSAGES.map((_, n) => {
          const T0 = CARD_T[n];
          if (f < T0) return null;
          const pose = cardPose(n);
          let x = pose.x;
          let y = pose.y;
          let r = pose.r;
          let s = 1;
          if (n > 0) {
            const p = tw(f, T0, T0 + 5, 0, 1, E_OUT);
            const sp = soft(f, T0);
            x = (pose.sx ?? 0) + (pose.x - (pose.sx ?? 0)) * p;
            y = (pose.sy ?? 0) + (pose.y - (pose.sy ?? 0)) * p;
            r = (pose.sr ?? 0) + (pose.r - (pose.sr ?? 0)) * sp;
            s = 1.15 - 0.15 * sp;
          } else {
            r = tw(f, 0, 5, 0, -3, E_OUT);
          }
          let later = 0;
          for (let j = n + 1; j < CARD_T.length; j++) later += tw(f, CARD_T[j], CARD_T[j] + 5, 0, 1, LINEAR);
          const bright = Math.pow(0.92, later);
          return (
            <div key={n} style={{ position: "absolute", left: 960 - 320 + x, top: 540 - 100 + y - 40, transform: `rotate(${r}deg) scale(${s})`, filter: `brightness(${bright})` }}>
              <MessengerCard i={n} />
            </div>
          );
        })}
      </AbsoluteFill>
      {/* 메신저 아이콘 + 배지 */}
      <div style={{ position: "absolute", left: 1640, top: 70 }}>
        <div style={{ width: 96, height: 96, borderRadius: 26, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", color: C.ink }}>
          <ChatIcon size={54} stroke={2} />
        </div>
        <div style={{ position: "absolute", left: 62, top: -18, minWidth: 54, height: 54, padding: "0 12px", borderRadius: 27, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${badgeScale})`, ...t(28, 800, "#fff", { lineHeight: 1 }) }}>{count}</div>
      </div>
      <Caption text="피드백은 이렇게 와요" f={f} dark />
    </AbsoluteFill>
  );
}

// ---------- S05 · 어느 화면, 어느 버튼인지 / 또 물어봐야 해요. ----------
export const S05_L1 = "어느 화면, 어느 버튼인지";
export const S05_L2 = "또 물어봐야 해요.";
export function S05Text({ f, opacity = 1 }: { f: number; opacity?: number }) {
  const shift = 62 * (1 - tw(f, 30, 36, 0, 1, E_OUT));
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT, opacity }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", transform: `translateY(${shift}px)` }}>
        <div style={{ height: 96, display: "flex", alignItems: "center", ...T.head, opacity: 0.7 }}>
          <SylType text={S05_L1} f={f} start={4} color="#FFFFFF" />
        </div>
        <div style={{ height: 140, display: "flex", alignItems: "center", ...T.title, marginTop: 6 }}>
          <SylType text={S05_L2} f={f} start={30} color="#FFFFFF" />
        </div>
      </div>
    </AbsoluteFill>
  );
}
export function S05() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <S05Text f={f} />
    </AbsoluteFill>
  );
}

// ---------- S06 · 고객 화면에 위젯 하나를 달아요 ----------
export function S06() {
  const f = useCurrentFrame();
  const bg = mix(C.ink, C.bg, tw(f, 0, 10, 0, 1, LINEAR));
  const textO = tw(f, 0, 6, 1, 0, LINEAR);
  const s = f < 2 ? 0 : pop(f, 2);
  const breathe = f < 40 ? 1 : f < 60 ? tw(f, 40, 60, 1, 1.03, E_INOUT) : tw(f, 60, 80, 1.03, 1, E_INOUT);
  const rr = tw(f, 8, 22, 80, 180, E_OUT);
  const ro = f < 8 ? 0 : tw(f, 8, 22, 0.5, 0, E_OUT);
  return (
    <AbsoluteFill style={{ background: bg }}>
      {textO > 0 ? <S05Text f={200} opacity={textO} /> : null}
      {ro > 0 ? <div style={{ position: "absolute", left: 960 - rr, top: 540 - rr, width: rr * 2, height: rr * 2, borderRadius: "50%", border: `4px solid ${C.accent}`, opacity: ro }} /> : null}
      <Launcher x={960} y={540} size={160} scale={s * breathe} />
      <Caption text="고객 화면에 위젯 하나를 달아요" f={f} />
    </AbsoluteFill>
  );
}

export const LAUNCHER_FRAME = ui(1388, 848);
