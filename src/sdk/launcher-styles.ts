// Shadow DOM 안에 넣는 런처·패널 스타일. 고객사 CSS와 섞이지 않게 값은 여기 안에서만 정한다.
// 색 값은 src/styles/tokens.css의 TDS 토큰과 같은 값을 Shadow DOM용 변수로 다시 둔다.
export const LAUNCHER_STYLES = `
:host {
  all: initial;
  --lattice-blue-500: #3182f6;
  --lattice-blue-600: #2272eb;
  --lattice-red-500: #f04452;
  --lattice-white: #ffffff;
  --lattice-shadow-float: 0 4px 16px rgba(0, 27, 55, 0.1);
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
  box-shadow: var(--lattice-shadow-float);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 200ms var(--lattice-ease-out), background-color 150ms;
}
.launcher:hover { background: var(--lattice-blue-600); }
.launcher:active { transform: scale(0.96); transition-duration: 120ms; }
.launcher:focus-visible { outline: 2px solid var(--lattice-blue-500); outline-offset: 3px; }
.launcher svg { width: 26px; height: 26px; }
.launcher[data-hidden="true"] { display: none; }
.badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  border: 2px solid var(--lattice-white);
  background: var(--lattice-red-500);
  color: var(--lattice-white);
  font: 700 11px/16px 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', sans-serif;
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
  border: 0;
  border-radius: 20px;
  background: var(--lattice-white);
  box-shadow: var(--lattice-shadow-float);
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

export const LAUNCHER_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5c0 4.14-3.58 7.5-8 7.5-1.1 0-2.15-.21-3.1-.59L4 19.5l1.2-3.6A7.17 7.17 0 0 1 4 11.5C4 7.36 7.58 4 12 4s8 3.36 8 7.5Z"/></svg>`;

export const CLOSE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;
