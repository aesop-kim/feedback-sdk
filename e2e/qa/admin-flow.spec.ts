import { expect, test, type Page } from "@playwright/test";
// eslint-disable-next-line no-restricted-imports -- @/ 별칭은 src/만 가리켜서 e2e 도우미는 상대 경로로 가져온다.
import {
  ADMIN_PASSWORD,
  SDK_ORIGIN,
  approveCardInDatabase,
  captureQaScreen,
  cleanupQaUsers,
  collectDiagnostics,
  createQaUser,
  findConversationIdForUser,
  getQaDatabase,
  loginAdmin,
  openWidget,
  saveDiagnostics,
  seedAnalyzedRecording,
  startConversationViaApi,
} from "./qa-helpers";

// 관리자 QA: 로그인/로그아웃, 빈 상태, 대화 선택, 답장, 분석 상태, 반영 완료→재확인, 되묻기 승인→답변→409.
test.afterAll(async () => {
  await cleanupQaUsers("qa-adm-");
});

async function openConversation(adminPage: Page, conversationId: string) {
  await adminPage.goto(`${SDK_ORIGIN}/admin/${conversationId}`);
  return adminPage.getByRole("complementary", { name: "녹화 분석" });
}

test("틀린 비밀번호는 안내하고, 맞는 비밀번호로 들어가고, 로그아웃하면 다시 못 들어간다", async ({ page }) => {
  const diagnostics = collectDiagnostics(page);
  await page.goto(`${SDK_ORIGIN}/admin/login`);
  await page.getByPlaceholder("비밀번호를 입력해 주세요").fill("wrong-password");
  await page.getByRole("button", { name: "로그인하기" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "비밀번호가 맞지 않아요" })).toBeVisible();
  await captureQaScreen(page, "admin-01-wrong-password");

  await page.getByPlaceholder("비밀번호를 입력해 주세요").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "로그인하기" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("navigation", { name: "받은 대화" })).toBeVisible();

  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto(`${SDK_ORIGIN}/admin`);
  await expect(page).toHaveURL(/\/admin\/login$/);
  // 브라우저 뒤로 가기로도 대화 목록이 다시 보이면 안 된다.
  await page.goBack();
  await page.waitForTimeout(1_500);
  await expect(page.getByText("받은 의견")).toHaveCount(0);
  const badResponses = diagnostics.badResponses.filter((line) => !line.includes("/api/admin/session"));
  saveDiagnostics("admin-01-login", diagnostics);
  expect(badResponses).toEqual([]);
});

test("받은 대화가 없으면 빈 상태를 보여 준다", async ({ browser }) => {
  const context = await browser.newContext();
  const adminPage = await loginAdmin(context);
  await adminPage.route(`${SDK_ORIGIN}/api/admin/conversations`, (route) =>
    route.fulfill({ json: { projectId: null, projectName: "래티스 주식회사", conversations: [] } }),
  );
  await adminPage.reload();
  await expect(adminPage.getByText("아직 받은 의견이 없어요")).toBeVisible();
  await expect(adminPage.getByText("대화를 골라 주세요")).toBeVisible();
  await captureQaScreen(adminPage, "admin-02-empty-list");
  await context.close();
});

test("메시지가 없는 대화를 고르면 빈 대화·빈 녹화 안내가 보이고, 대화를 바꿔 고를 수 있다", async ({ browser, request }) => {
  const first = createQaUser("adm-select-a");
  const second = createQaUser("adm-select-b");
  const firstConversation = await startConversationViaApi(request, first);
  const secondConversation = await startConversationViaApi(request, second);
  await request.post(`${SDK_ORIGIN}/api/messages`, {
    headers: { authorization: `Bearer ${secondConversation.conversationToken}` },
    data: { body: "두 번째 대화 메시지" },
  });
  const context = await browser.newContext();
  const adminPage = await loginAdmin(context);
  const diagnostics = collectDiagnostics(adminPage);
  await openConversation(adminPage, firstConversation.conversationId);
  await expect(adminPage.getByText("아직 주고받은 메시지가 없어요")).toBeVisible();
  await expect(adminPage.getByText("아직 받은 녹화가 없어요")).toBeVisible();
  await captureQaScreen(adminPage, "admin-03-empty-conversation");

  await adminPage.getByRole("navigation", { name: "받은 대화" }).getByText(second.name).click();
  await expect(adminPage).toHaveURL(new RegExp(secondConversation.conversationId));
  await expect(adminPage.getByRole("region", { name: `${second.name} 님과의 대화` }).getByText("두 번째 대화 메시지")).toBeVisible();
  saveDiagnostics("admin-03-select", diagnostics);
  await context.close();
});

test("없는 대화 주소로 들어가면 안내가 보인다", async ({ browser }) => {
  const context = await browser.newContext();
  const adminPage = await loginAdmin(context);
  await adminPage.goto(`${SDK_ORIGIN}/admin/00000000-0000-0000-0000-000000000000`);
  await expect(adminPage.getByText("대화를 찾을 수 없어요.")).toBeVisible();
  await adminPage.goto(`${SDK_ORIGIN}/admin/not-a-uuid`);
  await expect(adminPage.getByText("대화를 찾을 수 없어요.")).toBeVisible();
  await context.close();
});

test("관리자 답장이 2000자를 넘으면 한국어로 이유를 알려 준다", async ({ browser, request }) => {
  const user = createQaUser("adm-long");
  const conversation = await startConversationViaApi(request, user);
  const context = await browser.newContext();
  const adminPage = await loginAdmin(context);
  await openConversation(adminPage, conversation.conversationId);
  const composer = adminPage.getByPlaceholder(`${user.name} 님에게 답장하기`);
  await composer.fill("나".repeat(2_050));
  const length = await composer.evaluate((element: HTMLTextAreaElement) => element.value.length);
  await adminPage.getByRole("button", { name: "보내기" }).click();
  await adminPage.waitForTimeout(1_500);
  await captureQaScreen(adminPage, "admin-04-long-reply");
  const errorText = (await adminPage.getByRole("alert").allTextContents()).join(" ");
  console.log(`[qa] admin textarea length=${length}, error="${errorText}"`);
  // 기대: 입력이 2000자에서 막히거나, 안내가 한국어 문장이어야 한다(zod 원문 "body: Too big…" 노출 금지).
  expect(length <= 2_000 || /^[^A-Za-z]*$/.test(errorText)).toBe(true);
  await context.close();
});

test("분석 중·실패(무음 안내 포함) 상태가 보이고, 다시 정리하기를 누르면 대기열로 돌아간다", async ({ browser, request }) => {
  const user = createQaUser("adm-states");
  const conversation = await startConversationViaApi(request, user);
  const silentMessage = "목소리가 녹음되지 않았어요. 크롬에서 고른 마이크를 확인해 주세요";
  const analyzing = await seedAnalyzedRecording(conversation.conversationId, { status: "analyzing" });
  const failed = await seedAnalyzedRecording(conversation.conversationId, { status: "failed", error: silentMessage });
  const context = await browser.newContext();
  const adminPage = await loginAdmin(context);
  const diagnostics = collectDiagnostics(adminPage);
  const analysis = await openConversation(adminPage, conversation.conversationId);

  // 최신 녹화(failed)가 먼저 열린다.
  await expect(analysis.getByText("말한 내용을 정리하지 못했어요")).toBeVisible();
  await captureQaScreen(adminPage, "admin-05-failed-silent");
  const isReasonVisible = await analysis.getByText(silentMessage).isVisible();

  await analysis.getByRole("button", { name: "이전 녹화" }).click();
  await expect(analysis.getByText("말한 내용을 정리하고 있어요")).toBeVisible();
  await captureQaScreen(adminPage, "admin-05-analyzing");
  await analysis.getByRole("button", { name: "다음 녹화" }).click();

  await analysis.getByRole("button", { name: "다시 정리하기" }).click();
  await expect(analysis.getByText(/말한 내용을 정리하고 있어요|말한 내용을 정리하지 못했어요/)).toBeVisible();
  const { data: requeued } = await getQaDatabase().from("recordings").select("status").eq("id", failed.recordingId).single();
  console.log(`[qa] after reanalyze status=${requeued?.status}; analyzing seeded id=${analyzing.recordingId}`);
  expect(["uploaded", "analyzing", "failed"]).toContain(requeued?.status);
  saveDiagnostics("admin-05-states", diagnostics);
  expect(isReasonVisible, "실패 이유(무음 안내)가 관리자 화면에 보여야 한다").toBe(true);
  await context.close();
});

test("분석 완료 상태: 문제 수·확인 필요 표시와 이슈 펼침", async ({ browser, request }) => {
  const user = createQaUser("adm-analyzed");
  const conversation = await startConversationViaApi(request, user);
  await seedAnalyzedRecording(conversation.conversationId);
  const context = await browser.newContext();
  const adminPage = await loginAdmin(context);
  const analysis = await openConversation(adminPage, conversation.conversationId);
  await expect(analysis.getByText(/문제 1건/)).toBeVisible();
  await expect(analysis.getByText("확인 필요 1건")).toBeVisible();
  await expect(analysis.getByText("고객에게 물어볼 질문")).toBeVisible();
  await captureQaScreen(adminPage, "admin-06-analyzed");
  await context.close();
});

test("질문을 고쳐 승인하면 위젯에 고친 질문 카드가 뜨고, 한 번 답하면 관리자에 반영된다", async ({ browser }) => {
  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  const customerDiagnostics = collectDiagnostics(customerPage);
  const user = createQaUser("adm-clar");
  const widget = await openWidget(customerPage, user);
  await widget.getByRole("textbox", { name: "메시지" }).fill("질문 흐름 시작");
  await widget.getByRole("button", { name: "보내기" }).click();
  await expect(widget.getByText("질문 흐름 시작")).toBeVisible();
  const conversationId = (await findConversationIdForUser(user.id))!;
  await seedAnalyzedRecording(conversationId);

  const adminContext = await browser.newContext();
  const adminPage = await loginAdmin(adminContext);
  const adminDiagnostics = collectDiagnostics(adminPage);
  const analysis = await openConversation(adminPage, conversationId);
  await analysis.getByLabel("고객에게 물어볼 질문").fill("QA가 고친 질문: 어느 버튼이었나요?");
  await analysis.getByLabel("보기 1", { exact: true }).fill("QA 보기 A");
  await analysis.getByLabel("보기 2", { exact: true }).fill("QA 보기 B");
  await analysis.getByRole("button", { name: "보기 추가하기" }).click();
  await analysis.getByLabel("보기 3", { exact: true }).fill("QA 보기 C");
  await analysis.getByRole("button", { name: "고객에게 물어보기" }).click();
  await expect(analysis.getByText("고객 답변을 기다리고 있어요")).toBeVisible();

  const card = widget.getByRole("region", { name: "확인 질문" });
  await expect(card).toBeVisible({ timeout: 5_000 });
  await expect(card.getByText("QA가 고친 질문: 어느 버튼이었나요?")).toBeVisible();
  await expect(card.getByRole("radio")).toHaveText(["QA 보기 A", "QA 보기 B", "QA 보기 C", "직접 입력할게요"]);
  await captureQaScreen(customerPage, "admin-07-widget-card");

  await card.getByRole("radio", { name: "QA 보기 C" }).click();
  await card.getByRole("button", { name: "답변 보내기" }).click();
  await expect(widget.getByText("답변 고마워요")).toBeVisible();
  await expect(analysis.getByText("고객 답변", { exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(analysis.getByText("QA 보기 C")).toBeVisible();
  await captureQaScreen(adminPage, "admin-07-answer-reflected");
  saveDiagnostics("admin-07-clar-widget", customerDiagnostics);
  saveDiagnostics("admin-07-clar-admin", adminDiagnostics);
  await adminContext.close();
  await customerContext.close();
});

test("다른 탭에서 이미 답한 질문에 다시 답하면 409를 알아듣게 안내하고 카드가 답한 상태로 바뀐다", async ({ browser }) => {
  const context = await browser.newContext();
  const user = createQaUser("adm-409");
  const firstTab = await context.newPage();
  const firstWidget = await openWidget(firstTab, user);
  await firstWidget.getByRole("textbox", { name: "메시지" }).fill("409 흐름");
  await firstWidget.getByRole("button", { name: "보내기" }).click();
  await expect(firstWidget.getByText("409 흐름")).toBeVisible();
  const conversationId = (await findConversationIdForUser(user.id))!;
  const seeded = await seedAnalyzedRecording(conversationId);
  await approveCardInDatabase(seeded.cardId!, conversationId);

  const secondTab = await context.newPage();
  const secondWidget = await openWidget(secondTab, user);
  const firstCard = firstWidget.getByRole("region", { name: "확인 질문" });
  const secondCard = secondWidget.getByRole("region", { name: "확인 질문" });
  await firstTab.reload();
  await firstTab.getByRole("button", { name: /피드백 보내기/ }).click();
  await expect(firstCard).toBeVisible();
  await expect(secondCard).toBeVisible();

  // 두 번째 탭의 실시간/주기 재조회를 막아, 오래된 카드에서 답하는 상황을 만든다.
  await secondTab.route(`${SDK_ORIGIN}/api/messages`, async (route) => {
    if (route.request().method() === "GET") {
      await route.abort();
      return;
    }
    await route.continue();
  });

  await firstCard.getByRole("radio").first().click();
  await firstCard.getByRole("button", { name: "답변 보내기" }).click();
  await expect(firstWidget.getByText("답변 고마워요")).toBeVisible();

  const answerResponse = secondTab.waitForResponse((response) => response.url().includes("/answer"));
  await secondCard.getByRole("radio").nth(1).click();
  await secondCard.getByRole("button", { name: "답변 보내기" }).click();
  expect((await answerResponse).status()).toBe(409);
  await secondTab.unroute(`${SDK_ORIGIN}/api/messages`);
  await secondTab.waitForTimeout(1_000);
  await captureQaScreen(secondTab, "admin-08-widget-409");
  const toastText = await secondWidget.getByText(/이미 답한 질문|연결이 잠깐 불안정해요/).allTextContents();
  console.log(`[qa] 409 toast: ${JSON.stringify(toastText)}`);
  expect.soft(toastText.join(" "), "409인데 '연결 불안정' 안내를 보여 주면 안 된다").not.toContain("연결이 잠깐 불안정해요");
  await expect.soft(secondWidget.getByText("답변 고마워요"), "409를 받으면 카드가 답한 상태로 바뀌어야 한다").toBeVisible({ timeout: 3_000 });
  await context.close();
});

test("반영 완료로 바꾸면 위젯에 재확인 안내가 뜨고, 그 안내에서 이 이슈에 연결된 재확인 녹화를 시작할 수 있다", async ({ browser }) => {
  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  const user = createQaUser("adm-resolve");
  const widget = await openWidget(customerPage, user);
  await widget.getByRole("textbox", { name: "메시지" }).fill("반영 흐름");
  await widget.getByRole("button", { name: "보내기" }).click();
  await expect(widget.getByText("반영 흐름")).toBeVisible();
  const conversationId = (await findConversationIdForUser(user.id))!;
  const seeded = await seedAnalyzedRecording(conversationId, { ambiguous: false });

  const adminContext = await browser.newContext();
  const adminPage = await loginAdmin(adminContext);
  const analysis = await openConversation(adminPage, conversationId);
  await analysis.getByRole("button", { name: "반영 완료로 바꾸기" }).click();
  await expect(analysis.getByText("반영 완료")).toBeVisible();
  await expect(widget.getByText(/수정을 반영했어요\. 같은 화면에서 한 번 더 확인해 주세요/)).toBeVisible({ timeout: 5_000 });
  await captureQaScreen(customerPage, "admin-09-widget-reverify-prompt");
  await captureQaScreen(adminPage, "admin-09-admin-resolved");

  const { data: issue } = await getQaDatabase().from("issues").select("status").eq("id", seeded.issueId).single();
  console.log(`[qa] issue status after resolve: ${issue?.status}`);
  // 재확인 녹화를 이 이슈에 연결할 수 있는 버튼(또는 링크)이 안내 옆에 있어야 한다.
  const messageList = widget.locator("[data-widget-scroll]");
  const reverifyAction = messageList.getByRole("button", { name: /다시 확인|재확인|녹화/ });
  console.log(`[qa] buttons inside widget message list after resolve: ${await messageList.getByRole("button").count()}`);
  expect(await reverifyAction.count(), "재확인 안내에 이슈와 연결된 녹화 시작 동작이 없다").toBeGreaterThan(0);
  await adminContext.close();
  await customerContext.close();
});

test("질문을 보낸 뒤 반영 완료로 바꾼 이슈는 고객이 늦게 답해도 '반영 완료'로 남는다", async ({ request }) => {
  const user = createQaUser("adm-late-answer");
  const conversation = await startConversationViaApi(request, user);
  const seeded = await seedAnalyzedRecording(conversation.conversationId);
  await approveCardInDatabase(seeded.cardId!, conversation.conversationId);
  await getQaDatabase().from("issues").update({ status: "asked" }).eq("id", seeded.issueId);

  const login = await request.post(`${SDK_ORIGIN}/api/admin/session`, { data: { password: ADMIN_PASSWORD } });
  expect(login.status()).toBe(200);
  const resolve = await request.patch(`${SDK_ORIGIN}/api/admin/issues/${seeded.issueId}`, { data: { status: "resolved" } });
  expect(resolve.status()).toBe(200);

  const answer = await request.post(`${SDK_ORIGIN}/api/clarifications/${seeded.cardId}/answer`, {
    headers: { authorization: `Bearer ${conversation.conversationToken}` },
    data: { optionId: "option-1" },
  });
  console.log(`[qa] late answer → ${answer.status()}`);
  const { data: issue } = await getQaDatabase().from("issues").select("status").eq("id", seeded.issueId).single();
  expect(issue?.status).toBe("resolved");
});

for (const width of [1280, 1440]) {
  test(`관리자 화면 ${width}px: 긴 이름·긴 메시지가 가로로 넘치지 않는다`, async ({ browser, request }) => {
    const user = { ...createQaUser(`adm-wide${width}`), name: "아주아주아주긴고객이름입니다아주아주아주긴고객이름입니다아주아주아주긴고객이름" };
    const conversation = await startConversationViaApi(request, user);
    await request.post(`${SDK_ORIGIN}/api/messages`, {
      headers: { authorization: `Bearer ${conversation.conversationToken}` },
      data: { body: `띄어쓰기없는긴글${"가나다라마바사".repeat(60)} https://example.com/${"x".repeat(250)}` },
    });
    await seedAnalyzedRecording(conversation.conversationId);
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const adminPage = await loginAdmin(context);
    const diagnostics = collectDiagnostics(adminPage);
    await openConversation(adminPage, conversation.conversationId);
    await expect(adminPage.getByRole("region", { name: `${user.name} 님과의 대화` })).toBeVisible();
    await adminPage.waitForTimeout(800);
    await captureQaScreen(adminPage, `admin-10-layout-${width}`);
    const overflow = await adminPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const overflowingElements = await adminPage.evaluate(() =>
      [...document.querySelectorAll("main *, nav *, section *, aside *")]
        .filter((element) => element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflowX === "visible")
        .slice(0, 5)
        .map((element) => `${element.tagName}.${element.className}`),
    );
    console.log(`[qa] ${width}px page overflow=${overflow}, overflowing=${JSON.stringify(overflowingElements)}`);
    saveDiagnostics(`admin-10-layout-${width}`, diagnostics);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(overflowingElements, "긴 단어가 말풍선 밖으로 잘려 나간다").toEqual([]);
    await context.close();
  });
}

test("다른 고객 메시지가 1.5초마다 들어와도 열어 둔 대화 상세가 끝내 열린다", async ({ browser, request }) => {
  test.setTimeout(90_000);
  const viewed = await startConversationViaApi(request, createQaUser("adm-busy-viewed"));
  await seedAnalyzedRecording(viewed.conversationId);
  const noisy = await startConversationViaApi(request, createQaUser("adm-busy-noisy"));
  const context = await browser.newContext();
  const adminPage = await loginAdmin(context);
  let isSending = true;
  const noise = (async () => {
    for (let index = 0; isSending && index < 30; index += 1) {
      await request.post(`${SDK_ORIGIN}/api/messages`, {
        headers: { authorization: `Bearer ${noisy.conversationToken}` },
        data: { body: `소음 ${index}` },
      });
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
  })();
  const startedAt = Date.now();
  await adminPage.goto(`${SDK_ORIGIN}/admin/${viewed.conversationId}`);
  const isOpened = await adminPage
    .getByRole("complementary", { name: "녹화 분석" })
    .getByText(/문제 1건/)
    .waitFor({ timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  console.log(`[qa] detail under load opened=${isOpened} after ${Date.now() - startedAt}ms`);
  await captureQaScreen(adminPage, "admin-11-detail-under-load");
  isSending = false;
  await noise;
  await context.close();
  expect(isOpened, "다른 대화 신호가 계속 오면 상세 조회가 매번 취소돼 스켈레톤에서 멈춘다").toBe(true);
});
