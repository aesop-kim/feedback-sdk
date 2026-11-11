import { expect, test } from "@playwright/test";
// eslint-disable-next-line no-restricted-imports -- @/ 별칭은 src/만 가리켜서 e2e 도우미는 상대 경로로 가져온다.
import {
  SDK_ORIGIN,
  WIDGET_FRAME,
  captureQaScreen,
  cleanupQaUsers,
  collectDiagnostics,
  createQaUser,
  findConversationIdForUser,
  getQaDatabase,
  getWidgetFrame,
  loginAdmin,
  openWidget,
  runAxeRules,
  startConversationViaApi,
} from "./qa-helpers";

// 접근성·배치 회귀: 메시지 목록 의미(NEW-05), 360px 녹화 알약(NEW-06), 카메라 정책 콘솔 오류(NEW-09),
// 보내는 중 말풍선 대비(V3-03), 관리자 랜드마크(V3-04), 긴 대화의 키보드 스크롤(V4-01).

test.afterAll(async () => {
  await cleanupQaUsers("qa-layout-");
});


test("메시지 목록은 log 래퍼 안에서 ol/li 의미를 지키고, axe 목록 규칙 위반이 없다", async ({ page }) => {
  const user = createQaUser("layout-a11y");
  const widget = await openWidget(page, user);
  await widget.getByRole("textbox", { name: "메시지" }).fill("목록 접근성 확인");
  await widget.getByRole("button", { name: "보내기" }).click();
  const log = widget.getByRole("log", { name: "대화" });
  await expect(log.getByRole("listitem").filter({ hasText: "목록 접근성 확인" })).toBeVisible();
  await expect(log.getByRole("list")).toHaveCount(1);
  const violations = await runAxeRules(getWidgetFrame(page), ["list", "listitem", "aria-allowed-role"]);
  console.log(`[qa] axe list rules: ${JSON.stringify(violations.map((violation) => `${violation.id}×${violation.nodes.length}`))}`);
  expect(violations).toEqual([]);
});

test("360px 화면에서 녹화 알약이 화면 안에 있고, 카메라 정책 오류가 콘솔에 없다", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const diagnostics = collectDiagnostics(page);
  const user = createQaUser("layout-pill");
  const widget = await openWidget(page, user);
  await widget.getByRole("button", { name: "화면 녹화로 설명하기" }).click();
  await expect(widget.getByRole("status", { name: "화면 녹화 중" })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
  const box = await page.locator(WIDGET_FRAME).boundingBox();
  await captureQaScreen(page, "layout-360-pill");
  console.log(`[qa] 360 pill box: ${JSON.stringify(box)}`);
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  await widget.getByRole("button", { name: "취소" }).click();
  expect(diagnostics.consoleErrors.filter((line) => line.includes("Permissions policy violation"))).toEqual([]);
});

test("보내는 중 말풍선도 글자 대비 4.5:1을 지킨다", async ({ page }) => {
  const user = createQaUser("layout-pending");
  const widget = await openWidget(page, user);
  // 보내기 요청을 붙잡아 '보내는 중' 상태를 유지한다.
  let releaseSend: () => void = () => undefined;
  const sendHeld = new Promise<void>((resolve) => {
    releaseSend = resolve;
  });
  await page.route(`${SDK_ORIGIN}/api/messages`, async (route) => {
    if (route.request().method() === "POST") {
      await sendHeld;
    }
    await route.continue();
  });
  await widget.getByRole("textbox", { name: "메시지" }).fill("보내는 중 대비 확인");
  await widget.getByRole("button", { name: "보내기" }).click();
  await expect(widget.locator('[data-pending="true"]')).toHaveText("보내는 중 대비 확인");
  const violations = await runAxeRules(getWidgetFrame(page), ["color-contrast"]);
  await captureQaScreen(page, "layout-pending-bubble");
  releaseSend();
  expect(violations).toEqual([]);
  await expect(widget.locator('[data-pending="true"]')).toHaveCount(0);
});

test("관리자 화면은 main 하나와 h1이 있고 모든 내용이 랜드마크 안에 있다", async ({ browser, request }) => {
  const context = await browser.newContext();
  const adminPage = await loginAdmin(context);
  const rules = ["landmark-one-main", "page-has-heading-one", "region", "landmark-complementary-is-top-level", "landmark-no-duplicate-main"];
  await expect(adminPage.getByRole("heading", { level: 1 })).toBeVisible();
  const homeViolations = await runAxeRules(adminPage.mainFrame(), rules);
  console.log(`[qa] admin home landmarks: ${JSON.stringify(homeViolations.map((violation) => violation.id))}`);
  expect(homeViolations).toEqual([]);

  const user = createQaUser("layout-admin");
  const { conversationId } = await startConversationViaApi(request, user);
  await adminPage.goto(`${SDK_ORIGIN}/admin/${conversationId}`);
  await expect(adminPage.getByRole("main", { name: `${user.name} 님과의 대화` })).toBeVisible();
  const conversationViolations = await runAxeRules(adminPage.mainFrame(), rules);
  console.log(`[qa] admin conversation landmarks: ${JSON.stringify(conversationViolations.map((violation) => violation.id))}`);
  expect(conversationViolations).toEqual([]);
  await context.close();
});

test("긴 대화에서도 메시지 영역을 키보드로 스크롤할 수 있다", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const user = createQaUser("layout-scroll");
  await openWidget(page, user);
  const conversationId = await findConversationIdForUser(user.id);
  expect(conversationId).not.toBeNull();
  // 누를 것이 없는 말풍선만 10개 쌓는다. 버튼이 남아 있으면 탭으로 스크롤이 되어 문제가 가려진다.
  const rows = Array.from({ length: 10 }, (_, index) => ({
    conversation_id: conversationId!,
    sender: index % 2 === 0 ? "user" : "admin",
    type: "text",
    body: `긴 대화 스크롤 확인 ${index + 1}번째 메시지예요. 화면을 넘길 만큼 길게 써요.`,
    created_at: new Date(Date.now() - (10 - index) * 1000).toISOString(),
  }));
  const { error } = await getQaDatabase().from("messages").insert(rows);
  expect(error).toBeNull();

  const widget = await openWidget(page, user);
  await expect(widget.getByText("긴 대화 스크롤 확인 10번째")).toBeVisible();
  const scrollRegion = widget.getByRole("region", { name: "대화 내용" });
  const { scrollHeight, clientHeight } = await scrollRegion.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(scrollHeight, "스크롤이 생길 만큼 길어야 시험이 의미 있다").toBeGreaterThan(clientHeight);

  const violations = await runAxeRules(getWidgetFrame(page), ["scrollable-region-focusable"]);
  console.log(`[qa] scrollable-region-focusable: ${JSON.stringify(violations.map((violation) => `${violation.id}×${violation.nodes.length}`))}`);
  expect(violations).toEqual([]);

  await scrollRegion.focus();
  await expect(scrollRegion).toBeFocused();
  await scrollRegion.press("End");
  const bottom = await scrollRegion.evaluate((element) => element.scrollTop);
  await scrollRegion.press("Home");
  await expect.poll(() => scrollRegion.evaluate((element) => element.scrollTop)).toBeLessThan(bottom);
  await captureQaScreen(page, "layout-long-history-focus");
});
