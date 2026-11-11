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
  await expect(page.getByRole("navigation", { name: "받은 의견" })).toBeVisible();

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

test("받은 의견이 없으면 실제 프로젝트 키가 든 설치 코드를 가로 넘침 없이 보여 준다", async ({ browser }) => {
  const context = await browser.newContext();
  const adminPage = await loginAdmin(context);
  await adminPage.route(`${SDK_ORIGIN}/api/admin/conversations`, (route) =>
    route.fulfill({ json: { projectId: null, projectName: "래티스 주식회사", projectKey: "lattice-demo", conversations: [] } }),
  );
  await adminPage.reload();
  // UX(#47): 목록이 비면 가운데 칸은 "골라 주세요" 대신 위젯 설치 방법을 보여 준다.
  await expect(adminPage.getByRole("navigation", { name: "받은 의견" }).getByText("아직 받은 의견이 없어요")).toBeVisible();
  const placeholder = adminPage.getByRole("main");
  await expect(placeholder.getByText("아직 받은 의견이 없어요")).toBeVisible();
  const snippet = placeholder.locator("pre code");
  await expect(snippet).toContainText("Feedback.init(");
  // NEW-11: 자리표시 대신 이 프로젝트의 키가 들어가고, 긴 줄은 상자 안에서 줄을 바꾼다.
  await expect(snippet).toContainText('projectKey: "lattice-demo"');
  const overflow = await placeholder.locator("pre").evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(placeholder.getByRole("button", { name: "코드 복사하기" })).toBeVisible();
  await expect(adminPage.getByText("의견을 골라 주세요")).toHaveCount(0);
  await captureQaScreen(adminPage, "admin-02-empty-list");
  await context.close();
});

test("좁은 화면에서는 PC 안내를 보여 주고 로그아웃은 그대로 누를 수 있다", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const adminPage = await loginAdmin(context);
  await expect(adminPage.getByText("관리자 화면은 PC에서 써 주세요")).toBeVisible();
  await expect(adminPage.getByRole("navigation", { name: "받은 의견" })).toBeHidden();
  const pageOverflow = await adminPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(pageOverflow).toBeLessThanOrEqual(0);
  await captureQaScreen(adminPage, "admin-02-narrow-notice");
  const logout = adminPage.getByRole("button", { name: "로그아웃" });
  await expect(logout).toBeInViewport();
  await logout.click();
  await expect(adminPage).toHaveURL(/\/admin\/login$/);
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

  await adminPage.getByRole("navigation", { name: "받은 의견" }).getByText(second.name).click();
  await expect(adminPage).toHaveURL(new RegExp(secondConversation.conversationId));
  const thread = adminPage.getByRole("main", { name: `${second.name} 님과의 대화` });
  // UX-15: 새 메시지를 읽어 주도록 메시지 영역이 log(aria-live polite)다.
  await expect(thread.getByRole("log", { name: "주고받은 메시지" }).getByText("두 번째 대화 메시지")).toBeVisible();
  await expect(thread.getByRole("log", { name: "주고받은 메시지" })).toHaveAttribute("aria-live", "polite");
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

test("분석 중·무음 실패 상태가 보이고, 무음은 다시 녹화를 먼저 안내한다", async ({ browser, request }) => {
  const user = createQaUser("adm-states");
  const conversation = await startConversationViaApi(request, user);
  const silentMessage = "목소리가 녹음되지 않았어요. 크롬에서 고른 마이크를 확인해 주세요";
  await seedAnalyzedRecording(conversation.conversationId, { status: "analyzing" });
  await seedAnalyzedRecording(conversation.conversationId, { status: "failed", error: silentMessage, withAudio: true });
  const context = await browser.newContext();
  const adminPage = await loginAdmin(context);
  const diagnostics = collectDiagnostics(adminPage);
  const analysis = await openConversation(adminPage, conversation.conversationId);

  // 최신 녹화(failed)가 먼저 열린다.
  await expect(analysis.getByText("말한 내용을 정리하지 못했어요")).toBeVisible();
  await expect(analysis.getByText(silentMessage)).toBeVisible();
  // NEW-10: 무음은 다시 녹화 요청이 먼저고, 다시 정리하기는 보조 버튼으로만 둔다.
  await expect(analysis.getByText(/다시 녹화해 달라고 답장해 주세요/)).toBeVisible();
  await expect(analysis.getByRole("button", { name: "다시 정리하기", exact: true })).toHaveCount(0);
  await expect(analysis.getByRole("button", { name: "그래도 다시 정리하기" })).toBeVisible();
  await captureQaScreen(adminPage, "admin-05-failed-silent");

  await analysis.getByRole("button", { name: "이전 녹화" }).click();
  await expect(analysis.getByText("말한 내용을 정리하고 있어요")).toBeVisible();
  await captureQaScreen(adminPage, "admin-05-analyzing");
  saveDiagnostics("admin-05-states", diagnostics);
  await context.close();
});

test("분석 실패는 다시 정리하기를 누르면 대기열로 돌아간다", async ({ browser, request }) => {
  const user = createQaUser("adm-requeue");
  const conversation = await startConversationViaApi(request, user);
  const failed = await seedAnalyzedRecording(conversation.conversationId, {
    status: "failed",
    error: "이슈를 분석하지 못했어요: 시간 초과",
    withAudio: true,
  });
  const context = await browser.newContext();
  const adminPage = await loginAdmin(context);
  const analysis = await openConversation(adminPage, conversation.conversationId);
  await expect(analysis.getByText("다시 정리하면 보통 1분 안에 끝나요", { exact: false })).toBeVisible();
  await analysis.getByRole("button", { name: "다시 정리하기", exact: true }).click();
  await expect(analysis.getByText(/말한 내용을 정리하고 있어요|말한 내용을 정리하지 못했어요/)).toBeVisible();
  const { data: requeued } = await getQaDatabase().from("recordings").select("status").eq("id", failed.recordingId).single();
  expect(["uploaded", "analyzing", "failed"]).toContain(requeued?.status);
  await context.close();
});

// NEW-01: 업로드가 끝나지 않은 녹화는 "영상을 받아 두었어요"나 다시 정리하기를 보여 주지 않고, API도 409로 거절한다.
test("업로드가 끝나지 않은 녹화는 다시 녹화를 안내하고 다시 정리할 수 없다", async ({ browser, request }) => {
  const user = createQaUser("adm-incomplete");
  const conversation = await startConversationViaApi(request, user);
  const reason = "업로드가 끝나지 않았어요. 고객이 업로드 중에 페이지를 떠났을 수 있어요. 다시 녹화해 달라고 요청해 주세요";
  const incomplete = await seedAnalyzedRecording(conversation.conversationId, { status: "failed", error: reason, analysisAttempt: 0 });
  const context = await browser.newContext();
  const adminPage = await loginAdmin(context);
  const analysis = await openConversation(adminPage, conversation.conversationId);
  await expect(analysis.getByText("녹화를 끝까지 받지 못했어요")).toBeVisible();
  // V4-05: 저장된 이유는 안내 줄과 같은 말이라 따로 보이지 않고, 다시 녹화 안내는 한 번만 나온다.
  await expect(analysis.getByText(reason)).toHaveCount(0);
  await expect(analysis.getByText(/다시 녹화해 달라고/)).toHaveCount(1);
  await expect(analysis.getByText(/안전하게 받아|다시 정리하면/)).toHaveCount(0);
  await expect(analysis.getByRole("button", { name: /다시 정리하기/ })).toHaveCount(0);
  await captureQaScreen(adminPage, "admin-05-upload-incomplete");

  const response = await adminPage.request.post(`${SDK_ORIGIN}/api/admin/recordings/${incomplete.recordingId}/reanalyze`);
  expect(response.status()).toBe(409);
  expect(((await response.json()) as { error: string }).error).toMatch(/다시 녹화해 달라고/);
  const { data: unchanged } = await getQaDatabase().from("recordings").select("status, error").eq("id", incomplete.recordingId).single();
  expect(unchanged).toEqual({ status: "failed", error: reason });
  await context.close();
});

// 분석했던 녹화의 이슈를 반영 완료로 바꾼 뒤 다시 정리가 실패한 상황을 만든다.
async function seedFailedRecordingWithResolvedIssue(conversationId: string) {
  const seeded = await seedAnalyzedRecording(conversationId, { ambiguous: false, withAudio: true });
  const database = getQaDatabase();
  await database.from("issues").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", seeded.issueId);
  await database.from("recordings").update({ status: "failed", error: "이슈를 분석하지 못했어요: 시간 초과" }).eq("id", seeded.recordingId);
  return seeded;
}

test("반영 완료한 이슈가 있는 녹화는 다시 정리하기 대신 이유를 보여 주고 API도 409로 거절한다", async ({ browser, request }) => {
  const conversation = await startConversationViaApi(request, createQaUser("adm-progressed"));
  const seeded = await seedFailedRecordingWithResolvedIssue(conversation.conversationId);
  const context = await browser.newContext();
  const adminPage = await loginAdmin(context);
  const analysis = await openConversation(adminPage, conversation.conversationId);
  await expect(analysis.getByText(/반영 완료했거나 해결된 이슈가 있어서 다시 정리할 수 없어요/)).toBeVisible();
  await expect(analysis.getByRole("button", { name: /다시 정리하기/ })).toHaveCount(0);

  const response = await adminPage.request.post(`${SDK_ORIGIN}/api/admin/recordings/${seeded.recordingId}/reanalyze`);
  expect(response.status()).toBe(409);
  expect(((await response.json()) as { error: string }).error).toMatch(/반영 완료했거나 해결된 이슈/);
  const { data: issue } = await getQaDatabase().from("issues").select("status").eq("id", seeded.issueId).single();
  expect(issue?.status).toBe("resolved");
  await context.close();
});

test("replace_recording_issues는 반영 완료한 이슈가 있으면 지우지 않고 거절한다", async ({ request }) => {
  // 배포에서는 클라우드 service role로 RPC를 직접 불러, 마이그레이션이 빠진 배포를 잡는다(V4-04).
  const conversation = await startConversationViaApi(request, createQaUser("adm-progressed-rpc"));
  const seeded = await seedFailedRecordingWithResolvedIssue(conversation.conversationId);
  const { error } = await getQaDatabase().rpc("replace_recording_issues", {
    p_recording_id: seeded.recordingId,
    p_attempt: 1,
    p_transcript: { segments: [], words: [] },
    p_issues: [],
  });
  expect(error?.message).toContain("progressed issues");
  const { data: issue } = await getQaDatabase().from("issues").select("status").eq("id", seeded.issueId).single();
  expect(issue?.status).toBe("resolved");
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
  // #42: 위젯에 바로 메시지가 가므로 제자리에서 한 번 더 묻는다.
  await analysis.getByRole("group", { name: "반영 완료 확인" }).getByRole("button", { name: "부탁하기" }).click();
  await expect(analysis.getByText("반영 완료", { exact: true })).toBeVisible();
  await expect(analysis.getByText("반영 완료로 바꾸고 고객에게 다시 확인을 부탁했어요")).toBeVisible();
  await captureQaScreen(adminPage, "admin-09-admin-resolved");

  // #60: 회색 안내 대신 이슈 제목과 녹화 버튼이 있는 카드가 뜬다.
  const reverifyCard = widget.getByRole("region", { name: "수정 확인 요청" });
  await expect(reverifyCard.getByText("고쳤어요. 한 번 확인해 주세요")).toBeVisible({ timeout: 5_000 });
  await captureQaScreen(customerPage, "admin-09-widget-reverify-prompt");
  const { data: issue } = await getQaDatabase().from("issues").select("status").eq("id", seeded.issueId).single();
  expect(issue?.status).toBe("resolved");

  // 카드에서 녹화하면 그 녹화가 이 이슈의 재확인 녹화로 올라가고, 이슈는 reverify로 바뀐다.
  await reverifyCard.getByRole("button", { name: "다시 녹화해서 확인하기" }).click();
  await expect(widget.getByRole("status", { name: "화면 녹화 중" })).toBeVisible({ timeout: 10_000 });
  await customerPage.waitForTimeout(2_000);
  await widget.getByRole("button", { name: "끝내고 보내기" }).click();
  // 끝내기 직후에는 아직 업로드 카드가 없다. 카드가 뜬 뒤 사라질 때(업로드 완료)까지 기다린다.
  const uploadingCard = widget.getByText(/보내는 중/);
  await expect(uploadingCard).toBeVisible({ timeout: 10_000 });
  await expect(uploadingCard).toHaveCount(0, { timeout: 60_000 });
  await expect(reverifyCard).toHaveCount(0);
  const { data: reverifyRecordings } = await getQaDatabase()
    .from("recordings")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("reverify_issue_id", seeded.issueId);
  expect(reverifyRecordings).toHaveLength(1);
  const { data: issueAfter } = await getQaDatabase().from("issues").select("status").eq("id", seeded.issueId).single();
  expect(issueAfter?.status).toBe("reverify");

  // V3-02 (a): 관리자는 새 녹화가 어떤 이슈의 재확인 녹화인지 보고, 원래 이슈와 오갈 수 있다.
  await adminPage.reload();
  await expect(adminPage.getByRole("button", { name: /다시 확인 녹화/ })).toBeVisible();
  await expect(analysis.getByText("‘QA 이슈 제목’ 다시 확인 녹화")).toBeVisible();
  await captureQaScreen(adminPage, "admin-09-admin-reverify-recording");
  await analysis.getByRole("button", { name: "원래 이슈 보기" }).click();
  await expect(analysis.getByRole("button", { name: /QA 이슈 제목/ })).toBeFocused();
  await expect(analysis.getByText("다시 확인 중", { exact: true })).toBeVisible();
  await analysis.getByRole("button", { name: "고객이 보낸 다시 확인 녹화 보기" }).click();
  await expect(analysis.getByText("‘QA 이슈 제목’ 다시 확인 녹화")).toBeVisible();
  await analysis.getByRole("button", { name: "원래 이슈 보기" }).click();
  await analysis.getByRole("group", { name: "다시 확인 결과" }).getByRole("button", { name: "해결됨으로 닫기" }).click();
  await analysis.getByRole("group", { name: "해결됨으로 닫기 확인" }).getByRole("button", { name: "닫기" }).click();
  await expect(analysis.getByText("해결됨", { exact: true })).toBeVisible();
  await captureQaScreen(adminPage, "admin-09-admin-reverify-closed");
  const { data: closedIssue } = await getQaDatabase().from("issues").select("status").eq("id", seeded.issueId).single();
  expect(closedIssue?.status).toBe("closed");

  // V4-02: 고객은 재확인 녹화 카드에서 어떤 이슈를 다시 확인했는지 보고, 닫힌 결과를 메시지로 듣는다.
  await expect(widget.getByText("‘QA 이슈 제목’ 다시 확인 녹화")).toBeVisible();
  await expect(widget.getByText("‘QA 이슈 제목’ 확인해 주셔서 고마워요. 해결로 정리했어요.")).toBeVisible({ timeout: 5_000 });
  await captureQaScreen(customerPage, "admin-09-widget-reverify-closed");
  await adminContext.close();
  await customerContext.close();
});

// V3-02 (b)(c): 고객이 재확인 녹화를 보낸 이슈는 반영 완료 버튼 대신 "해결됨으로 닫기"와 "다시 열기"를 고른다.
test("다시 확인 중인 이슈는 해결됨으로 닫거나 다시 열 수 있고, 닫힌 이슈는 남은 문제에서 빠진다", async ({ browser }) => {
  const user = createQaUser("adm-reverify-close");
  const adminContext = await browser.newContext();
  const adminPage = await loginAdmin(adminContext);
  const conversation = await startConversationViaApi(adminPage.request, user);
  const conversationId = conversation.conversationId;
  const seeded = await seedAnalyzedRecording(conversationId, { ambiguous: false });
  const database = getQaDatabase();
  await database.from("issues").update({ status: "reverify" }).eq("id", seeded.issueId);

  const analysis = await openConversation(adminPage, conversationId);
  const listRow = adminPage.getByRole("navigation", { name: "받은 의견" }).getByRole("link", { name: new RegExp(user.name) });
  await expect(listRow).toContainText("남은 문제 1건");
  await expect(analysis.getByText("다시 확인 중", { exact: true })).toBeVisible();
  // V3-02 (c): 재확인 중인 이슈에 반영 완료 버튼(고객에게 재확인 요청이 또 간다)을 다시 보여 주지 않는다.
  await expect(analysis.getByRole("button", { name: "반영 완료로 바꾸기" })).toHaveCount(0);
  const choices = analysis.getByRole("group", { name: "다시 확인 결과" });
  await captureQaScreen(adminPage, "admin-12-reverify-choices");
  // V4-03: 닫기는 제자리에서 한 번 더 묻는다. "다음에"를 누르면 아무것도 바뀌지 않는다.
  await choices.getByRole("button", { name: "해결됨으로 닫기" }).click();
  const closeConfirm = analysis.getByRole("group", { name: "해결됨으로 닫기 확인" });
  await expect(closeConfirm.getByRole("button", { name: "닫기" })).toBeFocused();
  await closeConfirm.getByRole("button", { name: "다음에" }).click();
  const { data: stillReverify } = await database.from("issues").select("status").eq("id", seeded.issueId).single();
  expect(stillReverify?.status).toBe("reverify");
  await choices.getByRole("button", { name: "해결됨으로 닫기" }).click();
  await closeConfirm.getByRole("button", { name: "닫기" }).click();
  await expect(analysis.getByText("해결됨", { exact: true })).toBeVisible();
  await expect(analysis.getByText("고객 확인까지 끝나서 해결됨으로 닫았어요")).toBeVisible();
  await expect(listRow).not.toContainText("남은 문제");
  await captureQaScreen(adminPage, "admin-12-reverify-closed");

  // API는 멱등이다. 다시 닫으면 그대로, 닫힌 이슈를 반영 완료로 되돌리면 409.
  // V4-02: 고객에게는 실제로 닫힌 한 번만 메시지가 간다.
  const issueUrl = `${SDK_ORIGIN}/api/admin/issues/${seeded.issueId}`;
  const closeAgain = await adminPage.request.patch(issueUrl, { data: { status: "closed" } });
  expect(await closeAgain.json()).toEqual({ issueId: seeded.issueId, changed: false });
  expect((await adminPage.request.patch(issueUrl, { data: { status: "resolved" } })).status()).toBe(409);
  const readSystemMessages = async () =>
    (await database.from("messages").select("body").eq("conversation_id", conversationId).eq("type", "system").order("created_at")).data?.map(
      (row) => row.body,
    );
  expect(await readSystemMessages()).toEqual(["‘QA 이슈 제목’ 확인해 주셔서 고마워요. 해결로 정리했어요."]);
  const { data: closedIssue } = await database.from("issues").select("status").eq("id", seeded.issueId).single();
  expect(closedIssue?.status).toBe("closed");

  // V4-03: 닫은 이슈도 다시 열 수 있다. 다시 열면 반영 완료 버튼을 되찾고 남은 문제로 돌아온다.
  await analysis.getByRole("group", { name: "해결된 이슈" }).getByRole("button", { name: "다시 열기" }).click();
  await expect(analysis.getByRole("button", { name: "반영 완료로 바꾸기" })).toBeVisible();
  await expect(listRow).toContainText("남은 문제 1건");
  const { data: reopenedFromClosed } = await database.from("issues").select("status, resolved_at").eq("id", seeded.issueId).single();
  expect(reopenedFromClosed).toEqual({ status: "open", resolved_at: null });
  expect((await readSystemMessages())?.at(-1)).toBe("‘QA 이슈 제목’ 아직 남아 있는 걸 확인했어요. 다시 고칠게요.");

  // 아직 안 고쳐졌으면 다시 열어 반영 완료 버튼을 되찾는다.
  await database.from("issues").update({ status: "reverify" }).eq("id", seeded.issueId);
  await adminPage.reload();
  await analysis.getByRole("group", { name: "다시 확인 결과" }).getByRole("button", { name: "다시 열기" }).click();
  await expect(analysis.getByRole("button", { name: "반영 완료로 바꾸기" })).toBeVisible();
  await expect(listRow).toContainText("남은 문제 1건");
  const { data: reopenedIssue } = await database.from("issues").select("status, resolved_at").eq("id", seeded.issueId).single();
  expect(reopenedIssue).toEqual({ status: "open", resolved_at: null });
  expect(await readSystemMessages()).toHaveLength(3);
  await adminContext.close();
});

// V4-06: 재확인 녹화에서 나온 이슈는 원래 이슈의 재확인 녹화 아래에 묶이고 "남은 문제"를 늘리지 않는다.
test("재확인 녹화에서 나온 이슈는 남은 문제에 세지 않고 그 녹화 아래에 묶인다", async ({ browser }) => {
  const user = createQaUser("adm-reverify-derived");
  const adminContext = await browser.newContext();
  const adminPage = await loginAdmin(adminContext);
  const { conversationId } = await startConversationViaApi(adminPage.request, user);
  const original = await seedAnalyzedRecording(conversationId, { ambiguous: false });
  const database = getQaDatabase();
  await database.from("issues").update({ status: "reverify" }).eq("id", original.issueId);
  const derived = await seedAnalyzedRecording(conversationId, { ambiguous: false });
  await database.from("recordings").update({ reverify_issue_id: original.issueId }).eq("id", derived.recordingId);

  const analysis = await openConversation(adminPage, conversationId);
  const listRow = adminPage.getByRole("navigation", { name: "받은 의견" }).getByRole("link", { name: new RegExp(user.name) });
  await expect(listRow).toContainText("남은 문제 1건");
  // 최신 녹화(재확인 녹화)가 먼저 열린다.
  await expect(analysis.getByText("‘QA 이슈 제목’ 다시 확인 녹화")).toBeVisible();
  await expect(analysis.getByRole("heading", { name: "다시 확인에서 찾은 내용 1건" })).toBeVisible();
  await expect(analysis.getByText("남은 문제에는 세지 않아요. 원래 이슈에서 해결됨으로 닫거나 다시 열어 주세요.")).toBeVisible();
  // V5-02: 대화의 재확인 녹화 칩도 패널처럼 "찾은 내용"이라고 부른다.
  await expect(adminPage.getByRole("button", { name: /다시 확인 녹화.*찾은 내용 1건/ })).toBeVisible();
  await expect(adminPage.getByRole("button", { name: /다시 확인 녹화.*문제 1건/ })).toHaveCount(0);
  // V5-01: 재확인 녹화에서 찾은 이슈는 반영 완료를 받지 않는다. 고객에게 "수정을 반영했어요"가 또 가지 않는다.
  await expect(analysis.getByText("다시 확인 녹화에서 찾은 내용이라 따로 반영하지 않아요. 원래 이슈에서 정해 주세요")).toBeVisible();
  await expect(analysis.getByRole("button", { name: "반영 완료로 바꾸기" })).toHaveCount(0);
  const resolveDerived = await adminPage.request.patch(`${SDK_ORIGIN}/api/admin/issues/${derived.issueId}`, { data: { status: "resolved" } });
  expect(resolveDerived.status()).toBe(409);
  const { data: derivedIssue } = await database.from("issues").select("status").eq("id", derived.issueId).single();
  expect(derivedIssue?.status).toBe("open");
  const { count: systemMessageCount } = await database
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("type", "system");
  expect(systemMessageCount).toBe(0);
  await captureQaScreen(adminPage, "admin-13-reverify-derived");
  await adminContext.close();
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
    await expect(adminPage.getByRole("main", { name: `${user.name} 님과의 대화` })).toBeVisible();
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
