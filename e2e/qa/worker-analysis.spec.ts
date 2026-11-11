import { expect, test, type Locator, type Page } from "@playwright/test";
// eslint-disable-next-line no-restricted-imports -- @/ 별칭은 src/만 가리켜서 e2e 도우미는 상대 경로로 가져온다.
import {
  SDK_ORIGIN,
  captureQaScreen,
  cleanupQaUsers,
  collectDiagnostics,
  createQaUser,
  findConversationIdForUser,
  getQaDatabase,
  loginAdmin,
  openWidget,
  saveDiagnostics,
} from "./qa-helpers";

// 실제 분석 워커를 거치는 QA. 가짜 마이크 입력을 QA_AUDIO로 고른다.
//   QA_AUDIO=narration E2E_FAKE_AUDIO=$(pwd)/fixtures/demo-recording/narration.wav npx playwright test e2e/qa/worker-analysis.spec.ts
//   QA_AUDIO=silent    E2E_FAKE_AUDIO=<무음 wav>                                  npx playwright test e2e/qa/worker-analysis.spec.ts
// 김데모 대화와 섞이지 않게 QA 사용자로 녹화한다(db:reset 불필요).
const QA_AUDIO = process.env.QA_AUDIO;
const ANALYSIS_TIMEOUT_MS = 5 * 60 * 1000;
const NARRATION_LEAD_MS = 2_000;

test.afterAll(async () => {
  await cleanupQaUsers("qa-wrk-");
});

async function moveMouseTo(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
  }
}

async function waitUntil(page: Page, startedAt: number, offsetMs: number): Promise<void> {
  const remaining = startedAt + offsetMs - Date.now();
  if (remaining > 0) {
    await page.waitForTimeout(remaining);
  }
}

test("무음 녹화: 위젯이 '목소리가 들리지 않아요'를 알리고, 워커는 실패로 표시하며 관리자는 그 이유를 본다", async ({ browser }) => {
  test.skip(QA_AUDIO !== "silent", "QA_AUDIO=silent 일 때만");
  test.setTimeout(ANALYSIS_TIMEOUT_MS + 60_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);
  const user = createQaUser("wrk-silent");
  const widget = await openWidget(page, user);
  await widget.getByRole("button", { name: "화면 녹화로 설명하기" }).click();
  await expect(widget.getByRole("status", { name: "화면 녹화 중" })).toBeVisible();
  // 무음 경고는 녹화 4초 뒤 한 번. 녹화 중 위젯은 알약 모양이라 토스트가 보이는지가 관건이다.
  await page.waitForTimeout(6_000);
  const silentToastCount = await widget.getByText(/목소리가 들리지 않아요/).count();
  await captureQaScreen(page, "wrk-01-silent-during-recording");
  await widget.getByRole("button", { name: "끝내고 보내기" }).click();
  await expect(widget.getByText(/화면 녹화 · 0:0\d/)).toBeVisible({ timeout: 60_000 });

  const adminContext = await browser.newContext();
  const adminPage = await loginAdmin(adminContext);
  const adminDiagnostics = collectDiagnostics(adminPage);
  await adminPage.goto(`${SDK_ORIGIN}/admin/${await findConversationIdForUser(user.id)}`);
  const analysis = adminPage.getByRole("complementary", { name: "녹화 분석" });
  // 워커가 빠르면 관리자 화면을 열기 전에 이미 끝나 있을 수 있다.
  await expect(analysis.getByText(/말한 내용을 정리하고 있어요|말한 내용을 정리하지 못했어요/)).toBeVisible();
  await captureQaScreen(adminPage, "wrk-01-admin-analyzing");
  await expect(analysis.getByText("말한 내용을 정리하지 못했어요")).toBeVisible({ timeout: ANALYSIS_TIMEOUT_MS });
  await expect(widget.getByText("받았어요. 담당자가 직접 볼게요")).toBeVisible({ timeout: 20_000 });
  await captureQaScreen(adminPage, "wrk-01-admin-failed");
  await captureQaScreen(page, "wrk-01-widget-failed");
  const conversationId = await findConversationIdForUser(user.id);
  const { data: recording } = await getQaDatabase().from("recordings").select("status, error").eq("conversation_id", conversationId).single();
  console.log(`[qa] silent recording → ${JSON.stringify(recording)}; silent toast while recording=${silentToastCount}`);
  saveDiagnostics("wrk-01-widget", diagnostics);
  saveDiagnostics("wrk-01-admin", adminDiagnostics);
  expect(recording?.error ?? "").toContain("목소리가 녹음되지 않았어요");
  expect.soft(silentToastCount, "녹화 중 무음 경고 토스트가 보이지 않는다").toBeGreaterThan(0);
  await expect(analysis.getByText(/목소리가 녹음되지 않았어요/), "관리자 실패 화면에 무음 이유가 없다").toBeVisible();
  await adminContext.close();
  await context.close();
});

test("말로 설명한 녹화: 워커가 이슈를 만들고, 승인한 질문에 고객이 답하면 관리자에 반영된다", async ({ browser }) => {
  test.skip(QA_AUDIO !== "narration", "QA_AUDIO=narration 일 때만");
  test.setTimeout(ANALYSIS_TIMEOUT_MS + 3 * 60_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);
  const user = createQaUser("wrk-narration");
  const widget = await openWidget(page, user);

  await widget.getByRole("button", { name: "화면 녹화로 설명하기" }).click();
  const startedAt = Date.now();
  await expect(widget.getByRole("status", { name: "화면 녹화 중" })).toBeVisible();
  const registerButton = page.getByRole("button", { name: "계약서 등록" });
  const typoHeader = page.getByText("계약 긍액", { exact: true });
  const pageTitle = page.getByRole("main").getByText("전체 계약서", { exact: true });
  await waitUntil(page, startedAt, NARRATION_LEAD_MS + 8_500);
  await moveMouseTo(page, registerButton);
  await waitUntil(page, startedAt, NARRATION_LEAD_MS + 13_000);
  await registerButton.click();
  await waitUntil(page, startedAt, NARRATION_LEAD_MS + 17_000);
  await registerButton.click();
  await waitUntil(page, startedAt, NARRATION_LEAD_MS + 25_000);
  await moveMouseTo(page, typoHeader);
  await waitUntil(page, startedAt, NARRATION_LEAD_MS + 37_000);
  await moveMouseTo(page, pageTitle);
  await waitUntil(page, startedAt, NARRATION_LEAD_MS + 51_500);
  await moveMouseTo(page, registerButton);
  await waitUntil(page, startedAt, NARRATION_LEAD_MS + 66_000);
  await widget.getByRole("button", { name: "끝내고 보내기" }).click();
  await expect(widget.getByText(/화면 녹화 · \d+:\d{2}/)).toBeVisible({ timeout: 60_000 });

  const adminContext = await browser.newContext();
  const adminPage = await loginAdmin(adminContext);
  const adminDiagnostics = collectDiagnostics(adminPage);
  await adminPage.goto(`${SDK_ORIGIN}/admin/${await findConversationIdForUser(user.id)}`);
  const analysis = adminPage.getByRole("complementary", { name: "녹화 분석" });
  await expect(analysis.getByText(/문제 \d+건/)).toBeVisible({ timeout: ANALYSIS_TIMEOUT_MS });
  await captureQaScreen(adminPage, "wrk-02-admin-analyzed");
  await expect(widget.getByText(/문제 \d+건을 정리했어요/)).toBeVisible({ timeout: 20_000 });
  const summary = await analysis.locator("h3").first().textContent();
  console.log(`[qa] narration analysis summary: ${summary}`);

  const askButton = analysis.getByRole("button", { name: "고객에게 물어보기" });
  if ((await askButton.count()) > 0) {
    await askButton.first().click();
    await expect(analysis.getByText("고객 답변을 기다리고 있어요")).toBeVisible({ timeout: 20_000 });
    const card = widget.getByRole("region", { name: "확인 질문" });
    await expect(card).toBeVisible({ timeout: 5_000 });
    await captureQaScreen(page, "wrk-02-widget-card");
    await card.getByRole("radio").first().click();
    await card.getByRole("button", { name: "답변 보내기" }).click();
    await expect(widget.getByText("답변 고마워요")).toBeVisible();
    await expect(analysis.getByText("고객 답변", { exact: true })).toBeVisible({ timeout: 5_000 });
    await captureQaScreen(adminPage, "wrk-02-admin-answered");

    // 질문을 보낸 녹화는 다시 분석할 수 없어야 한다(분석 완료 화면에는 재분석 버튼 자체가 없다).
    const recordingId = (
      await getQaDatabase().from("recordings").select("id").eq("conversation_id", await findConversationIdForUser(user.id)).single()
    ).data?.id;
    const reanalyze = await adminPage.request.post(`${SDK_ORIGIN}/api/admin/recordings/${recordingId}/reanalyze`);
    console.log(`[qa] reanalyze after approved card → ${reanalyze.status()}`);
    expect(reanalyze.status()).toBe(409);
  } else {
    console.log("[qa] 확인 필요 이슈가 없어 되묻기 단계를 건너뜀");
  }
  saveDiagnostics("wrk-02-widget", diagnostics);
  saveDiagnostics("wrk-02-admin", adminDiagnostics);
  await adminContext.close();
  await context.close();
});
