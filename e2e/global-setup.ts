import { chromium, expect } from "@playwright/test";
// eslint-disable-next-line no-restricted-imports -- @/ 별칭은 src/만 가리켜서 e2e 도우미는 상대 경로로 가져온다.
import { DEMO_URL, SDK_ORIGIN, WIDGET_FRAME, getQaDatabase, pinQaUserOnDemoPage } from "./qa/qa-helpers";

// `npm run db:reset` 바로 뒤에는 Supabase 컨테이너가 다시 뜨는 중이라 첫 위젯이 빈 화면으로 멈출 수 있다(NEW-02).
// 테스트를 시작하기 전에 API와 실제 위젯이 열리는지 확인하고, 준비될 때까지 기다린다.
const READINESS_TIMEOUT_MS = 3 * 60 * 1000;
const RETRY_INTERVAL_MS = 2_000;
const READINESS_USER = { id: "qa-readiness", name: "QA준비확인" };

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilReady(label: string, check: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + READINESS_TIMEOUT_MS;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      if (await check()) {
        return;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await wait(RETRY_INTERVAL_MS);
  }
  throw new Error(`[e2e 준비] ${label}이(가) ${READINESS_TIMEOUT_MS / 1000}초 안에 준비되지 않았어요 ${lastError}`.trim());
}

async function isWidgetOpenable(): Promise<boolean> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await pinQaUserOnDemoPage(page, READINESS_USER);
    await page.goto(DEMO_URL);
    await page.getByRole("button", { name: /피드백 보내기/ }).click({ timeout: 15_000 });
    const recordButton = page.frameLocator(WIDGET_FRAME).getByRole("button", { name: "화면 녹화", exact: true });
    // 대화는 위젯을 처음 열 때 만들어지므로, 버튼이 보인 뒤 켜질 때까지 기다린다.
    await expect(recordButton).toBeEnabled({ timeout: 15_000 });
    return true;
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(): Promise<void> {
  const startedAt = Date.now();
  await waitUntilReady("위젯 페이지", async () => (await fetch(`${SDK_ORIGIN}/widget`)).ok);
  await waitUntilReady("데모 페이지", async () => (await fetch(DEMO_URL)).ok);
  await waitUntilReady("대화 API", async () => {
    const response = await fetch(`${SDK_ORIGIN}/api/conversations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectKey: "lattice-demo", hostOrigin: new URL(DEMO_URL).origin, user: READINESS_USER }),
    });
    return response.ok;
  });
  await waitUntilReady("위젯 열기", isWidgetOpenable);
  await getQaDatabase().from("end_users").delete().eq("external_id", READINESS_USER.id);
  console.log(`[e2e 준비] 위젯·API 준비 확인 ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}
