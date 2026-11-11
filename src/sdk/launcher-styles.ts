// Shadow DOM 안에 넣는 런처·패널 스타일. 고객사 CSS와 섞이지 않게 값은 여기 안에서만 정한다.
// 색 값은 src/styles/tokens.css의 TDS 토큰과 같은 값을 Shadow DOM용 변수로 다시 둔다.
export const LAUNCHER_STYLES = `
:host {
  all: initial;
  --lattice-blue-500: #1b64da;
  --lattice-blue-600: #1957c2;
  --lattice-red-500: #d22030;
  --lattice-white: #ffffff;
  --lattice-hairline: rgba(0, 27, 55, 0.08);
  --lattice-shadow-launcher: 0 2px 10px rgba(0, 27, 55, 0.14);
  --lattice-shadow-panel: 0 8px 28px rgba(0, 27, 55, 0.1);
  --lattice-ease-expo: cubic-bezier(.16, 1, .3, 1);
  --lattice-ease-out: cubic-bezier(.25, .1, .25, 1);
  --lattice-inset: 24px;
  --lattice-launcher-size: 56px;
}
* { box-sizing: border-box; }
.launcher {
  position: fixed;
  right: var(--lattice-inset);
  bottom: var(--lattice-inset);
  z-index: 2147483646;
  width: var(--lattice-launcher-size);
  height: var(--lattice-launcher-size);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  padding: 0;
  margin: 0;
  background: var(--lattice-blue-500);
  color: var(--lattice-white);
  box-shadow: var(--lattice-shadow-launcher);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 200ms var(--lattice-ease-out), background-color 150ms;
}
.launcher:hover { background: var(--lattice-blue-600); }
.launcher:active { transform: scale(0.96); transition-duration: 120ms; }
.launcher:focus-visible { outline: 2px solid var(--lattice-blue-500); outline-offset: 3px; }
.launcher svg { width: 28px; height: 28px; }
.launcher[data-hidden="true"] { display: none; }
.badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  border: 2px solid var(--lattice-white);
  background: var(--lattice-red-500);
  color: var(--lattice-white);
  font: 700 12px/18px 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif;
  font-variant-numeric: tabular-nums;
  text-align: center;
}
.badge[data-count="0"] { display: none; }
.frame {
  position: fixed;
  z-index: 2147483647;
  right: var(--lattice-inset);
  bottom: calc(var(--lattice-inset) + var(--lattice-launcher-size) + 16px);
  width: 380px;
  height: 640px;
  max-height: calc(100vh - var(--lattice-inset) - var(--lattice-launcher-size) - 32px);
  border: 1px solid var(--lattice-hairline);
  border-radius: 20px;
  background: var(--lattice-white);
  box-shadow: var(--lattice-shadow-panel);
  color-scheme: light;
  transform-origin: bottom right;
  transition: opacity 200ms var(--lattice-ease-expo), transform 200ms var(--lattice-ease-expo);
}
.frame[data-mode="closed"] {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
  visibility: hidden;
  pointer-events: none;
  transition: opacity 150ms var(--lattice-ease-out), transform 150ms var(--lattice-ease-out), visibility 0s linear 150ms;
}
.frame[data-mode="open"] { opacity: 1; transform: none; }
.frame[data-mode="recording"] {
  bottom: var(--lattice-inset);
  width: 220px;
  height: 52px;
  max-height: none;
  border: 0;
  border-radius: 26px;
  transition: none;
}
@media (max-width: 480px) {
  .frame[data-mode="open"], .frame[data-mode="closed"] {
    right: 8px;
    width: calc(100vw - 16px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .launcher, .frame, .frame[data-mode="closed"] { transition: none; }
  .launcher:active { transform: none; }
}
`;

// 말풍선 + 음성 파형: "화면을 보여주며 말로 설명한다"는 이 위젯의 쓰임을 그대로 그린다.
export const LAUNCHER_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4.5h10a3.5 3.5 0 0 1 3.5 3.5v6a3.5 3.5 0 0 1-3.5 3.5h-5l-3.5 3v-3H7A3.5 3.5 0 0 1 3.5 14V8A3.5 3.5 0 0 1 7 4.5Z"/><path d="M9 10v2M12 8.5v5M15 10v2"/></svg>`;

export const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;
