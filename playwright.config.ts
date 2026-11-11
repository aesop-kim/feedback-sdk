import { defineConfig } from "@playwright/test";

// 전체 흐름 E2E. 미리 띄워 둘 것: 로컬 Supabase, `npm run dev`(3000), `npm run demo:host`(3001), `npm run worker`.
// 가짜 마이크 입력은 E2E_FAKE_AUDIO(wav) 파일을 쓴다. 없으면 크롬 기본 비프음.
const fakeAudioPath = process.env.E2E_FAKE_AUDIO;

export default defineConfig({
  testDir: "e2e",
  // 데모 영상 촬영(demo-recording.spec.ts)은 `npm run demo:record`(DEMO_RECORD=1)에서만 돈다.
  testIgnore: process.env.DEMO_RECORD ? [] : ["**/demo-recording.spec.ts"],
  // db:reset 직후에도 첫 테스트가 빈 위젯을 보지 않도록 위젯·API가 준비될 때까지 기다린다.
  globalSetup: "./e2e/global-setup.ts",
  timeout: 6 * 60 * 1000,
  expect: { timeout: 15_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1440, height: 900 },
    video: process.env.E2E_VIDEO ? { mode: "on", size: { width: 1440, height: 900 } } : "off",
    screenshot: "only-on-failure",
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--auto-accept-this-tab-capture",
        "--auto-select-tab-capture-source-by-title=래티스",
        "--autoplay-policy=no-user-gesture-required",
        ...(fakeAudioPath ? [`--use-file-for-fake-audio-capture=${fakeAudioPath}`] : []),
      ],
    },
  },
});
