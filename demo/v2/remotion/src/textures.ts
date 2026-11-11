// 실제 화면 캡처를 텍스처로 쓰고 싶을 때 여기 경로를 채운다(public/ 기준).
// 비워 두면 React로 다시 그린 레이어를 쓴다. 기본값은 다시 그린 레이어(스토리보드 0장 "카메라" 규칙).
// 예: host: "ui/host-closed.png"  → public/ui/host-closed.png (1440x900 캡처) 를 고객사 화면 배경으로 쓴다.
// 텍스처를 쓰면 버그 표시(점선 상자, 밑줄)는 그대로 위에 겹쳐 그려진다.
export const TEXTURES: { host: string | null } = {
  host: null,
};
