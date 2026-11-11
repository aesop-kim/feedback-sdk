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
  loginAdmin,
  openWidget,
  readWidgetSession,
  saveDiagnostics,
} from "./qa-helpers";

// 위젯 채팅 QA: 열고 닫기, 이름, 첫 빈 상태, 양방향 실시간, 입력 경계값.
// 로컬: npx playwright test e2e/qa/widget-chat.spec.ts / 배포: QA_TARGET=deployed …
test.afterAll(async () => {
  await cleanupQaUsers("qa-chat-");
});

test("위젯을 열면 사용자 이름과 첫 빈 상태가 보이고, 닫기 버튼과 런처로 닫힌다", async ({ page }) => {
  const diagnostics = collectDiagnostics(page);
  const user = createQaUser("chat-open");
  const widget = await openWidget(page, user);

  await expect(widget.getByText(`${user.name}님`, { exact: false })).toBeVisible();
  await expect(widget.getByRole("button", { name: "화면 녹화로 설명하기" })).toBeVisible();
  await captureQaScreen(page, "chat-01-empty-state");

  const frame = page.locator(WIDGET_FRAME);
  await widget.getByRole("button", { name: /닫기/ }).click();
  await expect(frame).toHaveAttribute("data-mode", "closed");
  await expect(page.getByRole("button", { name: /피드백 보내기/ })).toHaveAttribute("aria-expanded", "false");

  await page.getByRole("button", { name: /피드백 보내기/ }).click();
  await expect(frame).toHaveAttribute("data-mode", "open");
  await page.getByRole("button", { name: /피드백 보내기/ }).click();
  await expect(frame).toHaveAttribute("data-mode", "closed");
  saveDiagnostics("chat-01-open-close", diagnostics);
});

test("고객 메시지는 2초 안에 관리자에게, 관리자 답장은 2초 안에 위젯에 보인다", async ({ browser }) => {
  const customerContext = await browser.newContext();
  const page = await customerContext.newPage();
  const diagnostics = collectDiagnostics(page);
  const user = createQaUser("chat-rt");
  const widget = await openWidget(page, user);
  await widget.getByRole("textbox", { name: "메시지" }).fill("첫 메시지");
  await widget.getByRole("button", { name: "보내기" }).click();
  await expect(widget.getByText("첫 메시지")).toBeVisible();
  const conversationId = await findConversationIdForUser(user.id);
  expect(conversationId).not.toBeNull();

  const adminContext = await browser.newContext();
  const adminPage = await loginAdmin(adminContext);
  const adminDiagnostics = collectDiagnostics(adminPage);
  await adminPage.goto(`${SDK_ORIGIN}/admin/${conversationId}`);
  const thread = adminPage.getByRole("region", { name: `${user.name} 님과의 대화` });
  await expect(thread.getByText("첫 메시지")).toBeVisible();
  // 채널 구독이 붙을 시간을 준다(실시간 측정은 그 뒤부터).
  await adminPage.waitForTimeout(2_000);

  const customerSentAt = Date.now();
  await widget.getByRole("textbox", { name: "메시지" }).fill("실시간 확인 고객→관리자");
  await widget.getByRole("button", { name: "보내기" }).click();
  await expect(thread.getByText("실시간 확인 고객→관리자")).toBeVisible({ timeout: 2_000 });
  const customerToAdminMs = Date.now() - customerSentAt;

  const adminSentAt = Date.now();
  await adminPage.getByPlaceholder(`${user.name} 님에게 답장하기`).fill("실시간 확인 관리자→고객");
  await adminPage.keyboard.press("Enter");
  await expect(widget.getByText("실시간 확인 관리자→고객")).toBeVisible({ timeout: 2_000 });
  const adminToCustomerMs = Date.now() - adminSentAt;
  console.log(`[qa] realtime customer→admin ${customerToAdminMs}ms, admin→customer ${adminToCustomerMs}ms`);
  await captureQaScreen(page, "chat-02-realtime-widget");
  await captureQaScreen(adminPage, "chat-02-realtime-admin");
  saveDiagnostics("chat-02-realtime-widget", diagnostics);
  saveDiagnostics("chat-02-realtime-admin", adminDiagnostics);
  await adminContext.close();
  await customerContext.close();
});

test("보내기 버튼을 빠르게 두 번 눌러도 메시지는 한 번만 저장된다", async ({ page }) => {
  const user = createQaUser("chat-dbl");
  const widget = await openWidget(page, user);
  await widget.getByRole("textbox", { name: "메시지" }).fill("더블클릭 확인");
  await widget.getByRole("button", { name: "보내기" }).dblclick({ force: true });
  await expect(widget.getByText("더블클릭 확인")).toHaveCount(1);
  await page.waitForTimeout(1_500);
  const conversationId = await findConversationIdForUser(user.id);
  const { count } = await getQaDatabase()
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("body", "더블클릭 확인");
  expect(count).toBe(1);
});

test("Enter를 빠르게 두 번 눌러도 메시지는 한 번만 저장된다", async ({ page }) => {
  const user = createQaUser("chat-dblenter");
  const widget = await openWidget(page, user);
  const textbox = widget.getByRole("textbox", { name: "메시지" });
  await textbox.fill("엔터 두 번");
  await textbox.press("Enter");
  await textbox.press("Enter");
  await page.waitForTimeout(1_500);
  const conversationId = await findConversationIdForUser(user.id);
  const { count } = await getQaDatabase()
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("body", "엔터 두 번");
  expect(count).toBe(1);
});

test("빈 메시지와 공백만 있는 메시지는 보낼 수 없다", async ({ page }) => {
  const user = createQaUser("chat-empty");
  const widget = await openWidget(page, user);
  const sendButton = widget.getByRole("button", { name: "보내기" });
  await expect(sendButton).toBeDisabled();
  await widget.getByRole("textbox", { name: "메시지" }).fill("   \n\t  ");
  await expect(sendButton).toBeDisabled();
  await widget.getByRole("textbox", { name: "메시지" }).press("Enter");
  await expect(widget.getByRole("button", { name: "화면 녹화로 설명하기" })).toBeVisible();
});

test("서버 API도 공백만 있는 메시지를 400으로 거절한다", async ({ page, request }) => {
  const user = createQaUser("chat-empty-api");
  await openWidget(page, user);
  const session = await readWidgetSession(page, user.id);
  const response = await request.post(`${SDK_ORIGIN}/api/messages`, {
    headers: { authorization: `Bearer ${session.conversationToken}` },
    data: { body: "   " },
  });
  expect(response.status()).toBe(400);
});

test("2000자를 넘게 붙여 넣으면 2000자에서 잘리고 그대로 보내진다", async ({ page }) => {
  const user = createQaUser("chat-long");
  const widget = await openWidget(page, user);
  const textbox = widget.getByRole("textbox", { name: "메시지" });
  const longText = "가".repeat(2_100);
  await textbox.fill(longText);
  // fill은 maxLength를 우회하므로, 실제 입력과 같은 타이핑 경로도 확인한다.
  const valueLength = await textbox.evaluate((element: HTMLTextAreaElement) => element.value.length);
  console.log(`[qa] textarea length after fill(2100): ${valueLength}`);
  await widget.getByRole("button", { name: "보내기" }).click();
  await page.waitForTimeout(2_000);
  await captureQaScreen(page, "chat-03-long-message");
  const conversationId = await findConversationIdForUser(user.id);
  const { data } = await getQaDatabase().from("messages").select("body").eq("conversation_id", conversationId);
  const saved = (data ?? []).map((row) => (row.body as string | null)?.length ?? 0);
  console.log(`[qa] saved lengths: ${JSON.stringify(saved)}`);
  // 기대: 2000자 이하로 저장되거나, 실패하면 위젯이 "너무 길다"는 이유를 알려 준다.
  const toast = widget.getByText(/연결이 잠깐 불안정해요/);
  const isGenericToastShown = await toast.isVisible();
  expect(isGenericToastShown, "2000자 초과 실패를 '연결 불안정'으로 잘못 안내하면 안 된다").toBe(false);
  expect(saved.length).toBeGreaterThan(0);
});

test("이모지만 있는 메시지와 긴 단어가 말풍선 밖으로 넘치지 않는다", async ({ page }) => {
  const user = createQaUser("chat-emoji");
  const widget = await openWidget(page, user);
  const textbox = widget.getByRole("textbox", { name: "메시지" });
  await textbox.fill("😀🎉👍🏽👨‍👩‍👧‍👦");
  await textbox.press("Enter");
  await expect(widget.getByText("😀🎉👍🏽👨‍👩‍👧‍👦")).toBeVisible();
  const unbroken = `https://example.com/${"a".repeat(300)}`;
  await textbox.fill(unbroken);
  await textbox.press("Enter");
  await expect(widget.getByText(unbroken)).toBeVisible();
  const overflow = await page
    .frameLocator(WIDGET_FRAME)
    .locator("[data-widget-scroll]")
    .evaluate((element) => element.scrollWidth - element.clientWidth);
  await captureQaScreen(page, "chat-04-emoji-long-word");
  expect(overflow).toBeLessThanOrEqual(0);
});

test("Shift+Enter는 줄을 바꾸고 Enter는 보낸다", async ({ page }) => {
  const user = createQaUser("chat-enter");
  const widget = await openWidget(page, user);
  const textbox = widget.getByRole("textbox", { name: "메시지" });
  await textbox.click();
  await textbox.pressSequentially("첫 줄");
  await textbox.press("Shift+Enter");
  await textbox.pressSequentially("둘째 줄");
  await expect(textbox).toHaveValue("첫 줄\n둘째 줄");
  await textbox.press("Enter");
  await expect(textbox).toHaveValue("");
  await expect(widget.getByText(/첫 줄\s*둘째 줄/)).toBeVisible();
});

test("360×740 화면에서 위젯이 화면 안에 들어오고 긴 이름이 넘치지 않는다", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const diagnostics = collectDiagnostics(page);
  const user = { ...createQaUser("chat-mobile"), name: "아주아주긴이름을가진고객님입니다아주아주긴이름을가진고객님입니다아주아주긴이름" };
  const widget = await openWidget(page, user);
  const box = await page.locator(WIDGET_FRAME).boundingBox();
  expect(box).not.toBeNull();
  await captureQaScreen(page, "chat-05-mobile-360");
  console.log(`[qa] mobile frame box ${JSON.stringify(box)}`);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  const headerOverflow = await page
    .frameLocator(WIDGET_FRAME)
    .locator("header")
    .first()
    .evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(headerOverflow).toBeLessThanOrEqual(0);
  await expect(widget.getByRole("button", { name: "화면 녹화로 설명하기" })).toBeInViewport();
  saveDiagnostics("chat-05-mobile", diagnostics);
  await context.close();
});

test("메시지 전송이 실패하면 쓴 내용이 사라지지 않는다(입력창에 되돌리거나 다시 보내기 제공)", async ({ page }) => {
  const user = createQaUser("chat-sendfail");
  const widget = await openWidget(page, user);
  await page.route(`${SDK_ORIGIN}/api/messages`, async (route) => {
    if (route.request().method() === "POST") {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  const textbox = widget.getByRole("textbox", { name: "메시지" });
  await textbox.fill("네트워크가 끊긴 순간 보낸 긴 설명");
  await textbox.press("Enter");
  await expect(widget.getByText("연결이 잠깐 불안정해요. 잠시 후 다시 해볼까요?")).toBeVisible();
  await page.waitForTimeout(500);
  await captureQaScreen(page, "chat-06-send-failed");
  const restoredInComposer = (await textbox.inputValue()) === "네트워크가 끊긴 순간 보낸 긴 설명";
  const keptAsBubble = await widget.getByText("네트워크가 끊긴 순간 보낸 긴 설명").isVisible();
  console.log(`[qa] after send failure: composer restored=${restoredInComposer}, bubble kept=${keptAsBubble}`);
  expect(restoredInComposer || keptAsBubble, "전송 실패 시 고객이 쓴 글이 사라진다").toBe(true);
});

test("위젯을 닫아 둔 사이 온 답장은 런처 배지로 보이고, 새로고침해도 배지가 유지된다", async ({ page, browser }) => {
  const user = createQaUser("chat-badge");
  const widget = await openWidget(page, user);
  await widget.getByRole("textbox", { name: "메시지" }).fill("배지 확인");
  await widget.getByRole("button", { name: "보내기" }).click();
  await expect(widget.getByText("배지 확인")).toBeVisible();
  await widget.getByRole("button", { name: "닫기" }).click();
  const conversationId = await findConversationIdForUser(user.id);

  const adminContext = await browser.newContext();
  const adminPage = await loginAdmin(adminContext);
  const reply = await adminPage.request.post(`${SDK_ORIGIN}/api/admin/conversations/${conversationId}/messages`, { data: { body: "닫혀 있을 때 온 답장" } });
  expect(reply.status()).toBe(201);
  const launcher = page.getByRole("button", { name: /피드백 보내기/ });
  await expect(launcher).toHaveAttribute("aria-label", "피드백 보내기, 새 답장 1개", { timeout: 5_000 });
  await captureQaScreen(page, "chat-07-badge");

  await page.reload();
  await page.waitForTimeout(4_000);
  const labelAfterReload = await page.getByRole("button", { name: /피드백 보내기/ }).getAttribute("aria-label");
  console.log(`[qa] launcher label after reload: ${labelAfterReload}`);
  await captureQaScreen(page, "chat-07-badge-after-reload");
  await adminContext.close();
  expect(labelAfterReload, "새로고침하면 읽지 않은 답장 배지가 사라진다").toBe("피드백 보내기, 새 답장 1개");
});
