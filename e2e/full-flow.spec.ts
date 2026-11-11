import { expect, test, type Locator, type Page } from "@playwright/test";

// 전체 흐름: 고객 녹화 → 업로드 → 로컬 워커 분석 → 관리자 이슈 확인·답장·되묻기 → 고객 한 번에 답변 → 관리자 반영.
// 준비: `npm run db:reset`, `npm run dev`, `npm run demo:host`, `npm run worker`,
//       `E2E_FAKE_AUDIO=$(pwd)/fixtures/demo-recording/narration.wav npm run e2e`
const DEMO_PAGE_URL = "http://localhost:3001/";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "lattice-demo";
const NARRATION_LEAD_MS = 2_000;
const ANALYSIS_TIMEOUT_MS = 4 * 60 * 1000;

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
  await launcher.click();
  const widget = customerPage.frameLocator('iframe[title="피드백 보내기"]');
  await expect(widget.getByText("김데모님", { exact: false })).toBeVisible();

  // 1. 녹화하며 말로 설명 (대본 타임라인: docs/demo-script.md, 앞 2초 무음)
  await widget.getByRole("button", { name: "화면 녹화로 설명하기" }).click();
  const recordingStartedAt = Date.now();
  await expect(widget.getByRole("status", { name: "화면 녹화 중" })).toBeVisible();

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

  await widget.getByRole("button", { name: "끝내기" }).click();
  await expect(widget.getByText(/화면 녹화 · \d+:\d{2}/)).toBeVisible({ timeout: 60_000 });

  // 2. 관리자: 로그인 → 대화 → 분석 결과
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/admin/login");
  await adminPage.getByPlaceholder("비밀번호를 입력해 주세요").fill(ADMIN_PASSWORD);
  await adminPage.getByRole("button", { name: "로그인하기" }).click();
  await adminPage.getByRole("navigation", { name: "받은 대화" }).getByText("김데모").first().click();

  const analysis = adminPage.getByRole("complementary", { name: "녹화 분석" });
  await expect(analysis.getByText(/문제 3건/)).toBeVisible({ timeout: ANALYSIS_TIMEOUT_MS });
  await expect(analysis.getByText(/확인 필요 1건/)).toBeVisible();

  // 3. 관리자 답장 → 고객 위젯에 실시간 표시
  await adminPage.getByPlaceholder("김데모 님에게 답장하기").fill("말씀하신 세 가지 확인했어요. 등록 버튼부터 바로 고칠게요.");
  await adminPage.keyboard.press("Enter");
  await expect(widget.getByText("등록 버튼부터 바로 고칠게요")).toBeVisible({ timeout: 20_000 });

  // 4. 애매한 이슈를 고객에게 되묻기
  await analysis.getByRole("button", { name: "고객에게 물어보기" }).click();
  await expect(analysis.getByText("고객 답변을 기다리고 있어요")).toBeVisible({ timeout: 20_000 });

  // 5. 고객: 장면 위 질문 카드에서 한 번에 답하기
  const card = widget.getByRole("region", { name: "확인 질문" });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole("radio").first().click();
  await card.getByRole("button", { name: "답변 보내기" }).click();
  await expect(widget.getByText("답변을 보냈어요")).toBeVisible();

  // 6. 관리자 화면에 고객 답변 반영
  await expect(analysis.getByText(/고객 답변/)).toBeVisible({ timeout: 20_000 });

  await adminContext.close();
  await customerContext.close();
});
