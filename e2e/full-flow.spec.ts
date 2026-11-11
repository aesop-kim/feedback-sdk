import { expect, test, type Locator, type Page } from "@playwright/test";

// 전체 흐름: 고객 녹화 → 업로드 → 로컬 워커 분석 → 관리자 이슈 확인·답장·되묻기 → 고객 한 번에 답변 → 관리자 반영.
// 준비: `npm run db:reset`, `npm run dev`, `npm run demo:host`, `npm run worker`,
//       `E2E_FAKE_AUDIO=$(pwd)/fixtures/demo-recording/narration.wav npm run e2e`
const DEMO_PAGE_URL = "http://localhost:3001/";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "lattice-demo";
const NARRATION_LEAD_MS = 2_000;
const ANALYSIS_TIMEOUT_MS = 4 * 60 * 1000;
const REALTIME_TIMEOUT_MS = 2_000;

const SCREENS_DIRECTORY = process.env.E2E_SCREENS ? ".screens/flow" : null;

// E2E_SCREENS=1이면 단계마다 화면을 남긴다(디자인 리뷰·데모 영상 소스).
async function captureScreen(page: Page, name: string): Promise<void> {
  if (!SCREENS_DIRECTORY) {
    return;
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SCREENS_DIRECTORY}/${name}.png` });
}

async function moveMouseTo(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("가리킬 요소를 찾지 못했어요");
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 30 });
}

async function waitUntil(page: Page, startedAt: number, recordingMs: number): Promise<void> {
  const remaining = startedAt + recordingMs - Date.now();
  if (remaining > 0) {
    await page.waitForTimeout(remaining);
  }
}

test("고객이 말로 설명한 문제가 이슈 카드가 되고, 애매한 건 장면 위에서 되묻는다", async ({ browser }) => {
  const customerContext = await browser.newContext();
  const customerPage = await customerContext.newPage();
  await customerPage.goto(DEMO_PAGE_URL);

  const launcher = customerPage.getByRole("button", { name: "피드백 보내기" });
  await expect(launcher).toBeVisible();
  await captureScreen(customerPage, "01-host-closed");
  await launcher.click();
  const widget = customerPage.frameLocator('iframe[title="피드백 보내기"]');
  await expect(widget.getByText("김데모님", { exact: false })).toBeVisible();
  await captureScreen(customerPage, "02-widget-empty");

  // 1. 녹화하며 말로 설명 (대본 타임라인: docs/demo-script.md, 앞 2초 무음)
  await widget.getByRole("button", { name: "화면 녹화로 설명하기" }).click();
  const recordingStartedAt = Date.now();
  await expect(widget.getByRole("status", { name: "화면 녹화 중" })).toBeVisible();
  await captureScreen(customerPage, "03-recording");

  const registerButton = customerPage.getByRole("button", { name: "계약서 등록" });
  const typoHeader = customerPage.getByText("계약 긍액", { exact: true });
  const pageTitle = customerPage.getByRole("main").getByText("전체 계약서", { exact: true });

  await waitUntil(customerPage, recordingStartedAt, NARRATION_LEAD_MS + 8_500);
  await moveMouseTo(customerPage, registerButton);
  await waitUntil(customerPage, recordingStartedAt, NARRATION_LEAD_MS + 13_000);
  await registerButton.click();
  await waitUntil(customerPage, recordingStartedAt, NARRATION_LEAD_MS + 17_000);
  await registerButton.click();
  await waitUntil(customerPage, recordingStartedAt, NARRATION_LEAD_MS + 25_000);
  await moveMouseTo(customerPage, typoHeader);
  await waitUntil(customerPage, recordingStartedAt, NARRATION_LEAD_MS + 37_000);
  await moveMouseTo(customerPage, pageTitle);
  await waitUntil(customerPage, recordingStartedAt, NARRATION_LEAD_MS + 51_500);
  await moveMouseTo(customerPage, registerButton);
  await waitUntil(customerPage, recordingStartedAt, NARRATION_LEAD_MS + 66_000);

  await widget.getByRole("button", { name: "끝내고 보내기" }).click();
  await expect(widget.getByText(/화면 녹화 · \d+:\d{2}/)).toBeVisible({ timeout: 60_000 });
  await captureScreen(customerPage, "04-widget-uploaded");

  // 2. 관리자: 로그인 → 대화 → 분석 결과
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/admin/login");
  await adminPage.getByPlaceholder("비밀번호를 입력해 주세요").fill(ADMIN_PASSWORD);
  await adminPage.getByRole("button", { name: "로그인하기" }).click();
  await adminPage.getByRole("navigation", { name: "받은 의견" }).getByText("김데모").first().click();

  const analysis = adminPage.getByRole("complementary", { name: "녹화 분석" });
  await expect(analysis.getByText(/문제 3건/)).toBeVisible({ timeout: ANALYSIS_TIMEOUT_MS });
  await expect(analysis.getByText(/확인 필요 1건/)).toBeVisible();
  await captureScreen(adminPage, "05-admin-analysis");
  const fullViewToggle = analysis.getByRole("button", { name: "전체 보기" }).first();
  if (SCREENS_DIRECTORY && (await fullViewToggle.count()) > 0) {
    await fullViewToggle.click();
    await captureScreen(adminPage, "05b-admin-issue-full-view");
    await analysis.getByRole("button", { name: "크게 보기" }).first().click();
  }

  // 3. 실시간 왕복(AC2: 2초 안). 15초 주기 재조회로는 통과할 수 없게 2초로 잰다.
  const thread = adminPage.getByRole("region", { name: "김데모 님과의 대화" });
  const customerSentAt = Date.now();
  await widget.getByRole("textbox", { name: "메시지" }).fill("등록 버튼이 제일 급해요");
  await widget.getByRole("button", { name: "보내기" }).click();
  await expect(thread.getByText("등록 버튼이 제일 급해요")).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });
  console.log(`[e2e] 고객 → 관리자 ${Date.now() - customerSentAt}ms`);

  const adminSentAt = Date.now();
  await adminPage.getByPlaceholder("김데모 님에게 답장하기").fill("말씀하신 세 가지 확인했어요. 등록 버튼부터 바로 고칠게요.");
  await adminPage.keyboard.press("Enter");
  await expect(widget.getByText("등록 버튼부터 바로 고칠게요")).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });
  console.log(`[e2e] 관리자 → 고객 ${Date.now() - adminSentAt}ms`);
  await captureScreen(customerPage, "06-widget-reply");

  // 4. 애매한 이슈를 고객에게 되묻기
  await analysis.getByRole("button", { name: "고객에게 물어보기" }).click();
  await expect(analysis.getByText("고객 답변을 기다리고 있어요")).toBeVisible({ timeout: 20_000 });
  await captureScreen(adminPage, "07-admin-asked");

  // 5. 고객: 장면 위 질문 카드에서 한 번에 답하기
  const card = widget.getByRole("region", { name: "확인 질문" });
  await expect(card).toBeVisible({ timeout: 20_000 });
  // 스크롤은 위젯이 맞춘 그대로 찍는다(새 질문 카드는 윗부분이 보이도록 위젯이 직접 맞춘다).
  await captureScreen(customerPage, "08-widget-question");
  await card.getByRole("radio").first().click();
  await captureScreen(customerPage, "08b-widget-question-selected");
  await card.getByRole("button", { name: "답변 보내기" }).click();
  await expect(widget.getByText("답변 고마워요")).toBeVisible();
  await captureScreen(customerPage, "09-widget-answered");

  // 6. 관리자 화면에 고객 답변 반영
  await expect(analysis.getByText("고객 답변", { exact: true })).toBeVisible({ timeout: 20_000 });
  await captureScreen(adminPage, "10-admin-answered");

  await adminContext.close();
  await customerContext.close();
});
