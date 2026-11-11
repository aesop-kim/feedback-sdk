import { mkdir, rm, writeFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";

// 데모 영상 촬영용 흐름. full-flow.spec.ts와 같은 순서를 1920x1080으로 녹화하고, 편집 지점을 demo/raw/cues.json에 남긴다.
// `npm run demo:record`로만 돈다. 준비는 full-flow와 같다(db:reset, dev, demo:host, worker).
test.skip(!process.env.DEMO_RECORD, "데모 촬영은 DEMO_RECORD=1일 때만 돌아요");

const DEMO_PAGE_URL = "http://localhost:3001/";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "lattice-demo";
const NARRATION_LEAD_MS = 2_000;
const ANALYSIS_TIMEOUT_MS = 4 * 60 * 1000;

const RAW_DIRECTORY = "demo/raw";
const VIDEO_WORK_DIRECTORY = `${RAW_DIRECTORY}/.playwright-video`;
const VIEWPORT = { width: 1920, height: 1080 };
const MOUSE_STEPS = 40;
const POINT_PAUSE_MS = 600;
const POINTER_ANCHOR = { x: 0.82, y: 0.78 };
const REPLY_TEXT = "말씀하신 세 가지 확인했어요. 등록 버튼부터 바로 고칠게요.";

type ContextName = "customer" | "admin";
type Point = { x: number; y: number };
type Cue = { context: ContextName; name: string; t: number; x?: number; y?: number };

const cues: Cue[] = [];
const contextCreatedAtMs: Record<ContextName, number> = { customer: 0, admin: 0 };

// t: 그 컨텍스트를 만든 뒤 지난 초. x, y: 가리킨 지점(화면 비율 0~1). 줌 중심으로 쓴다.
function markCue(context: ContextName, name: string, point?: Point): void {
  const cue: Cue = { context, name, t: Math.round(Date.now() - contextCreatedAtMs[context]) / 1000 };
  if (point) {
    cue.x = Math.round((point.x / VIEWPORT.width) * 1000) / 1000;
    cue.y = Math.round((point.y / VIEWPORT.height) * 1000) / 1000;
  }
  cues.push(cue);
}

// 화면에 보이는 커서(화살표 + 클릭 링). 위젯 iframe 안에서 움직이면 부모 문서로 좌표를 넘겨 같은 커서를 움직인다.
function installDemoCursor(): void {
  const CURSOR_NAMESPACE = "lattice-demo-cursor";
  if (window.top !== window) {
    const relay = (type: "move" | "down", event: MouseEvent) =>
      window.parent.postMessage({ namespace: CURSOR_NAMESPACE, type, x: event.clientX, y: event.clientY }, "*");
    window.addEventListener("mousemove", (event) => relay("move", event), true);
    window.addEventListener("mousedown", (event) => relay("down", event), true);
    return;
  }

  const cursor = document.createElement("div");
  cursor.className = "rr-block";
  cursor.setAttribute("aria-hidden", "true");
  cursor.style.cssText =
    "position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2147483647;transform:translate(-200px,-200px);";
  cursor.innerHTML =
    '<div data-ring style="position:absolute;left:-24px;top:-24px;width:48px;height:48px;border-radius:50%;border:2px solid rgba(49,130,246,0.9);background:rgba(49,130,246,0.12);opacity:0;"></div>' +
    '<svg width="28" height="32" viewBox="0 0 28 32" style="position:absolute;left:-4px;top:-3px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.28));">' +
    '<path d="M4 3v22.6l5.7-5.4 3.8 8.8 4.2-1.8-3.8-8.7 8-0.3L4 3z" fill="#191F28" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  const ring = cursor.querySelector<HTMLElement>("[data-ring]");

  const moveTo = (x: number, y: number) => {
    cursor.style.transform = `translate(${x}px, ${y}px)`;
  };
  const pulse = () => {
    ring?.animate(
      [
        { opacity: 1, transform: "scale(0.35)" },
        { opacity: 0, transform: "scale(1.25)" },
      ],
      { duration: 480, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
  };
  // 프레임워크가 html 자식을 다시 그려도 커서가 남도록 주기적으로 다시 붙인다.
  const attach = () => {
    if (!cursor.isConnected && document.documentElement) {
      document.documentElement.appendChild(cursor);
    }
  };
  attach();
  window.setInterval(attach, 500);

  window.addEventListener("mousemove", (event) => moveTo(event.clientX, event.clientY), true);
  window.addEventListener("mousedown", pulse, true);
  window.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { namespace?: string; type?: string; x?: number; y?: number } | null;
    if (!data || data.namespace !== CURSOR_NAMESPACE || typeof data.x !== "number" || typeof data.y !== "number") {
      return;
    }
    const frame = Array.from(document.querySelectorAll("iframe")).find((element) => element.contentWindow === event.source);
    if (!frame) {
      return;
    }
    const rect = frame.getBoundingClientRect();
    moveTo(rect.left + data.x, rect.top + data.y);
    if (data.type === "down") {
      pulse();
    }
  });
}

async function glideTo(page: Page, context: ContextName, locator: Locator, cueName: string): Promise<Point> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`가리킬 요소를 찾지 못했어요: ${cueName}`);
  }
  // 요소 안 오른쪽 아래를 가리킨다. 화살표 몸통이 글자 아래로 빠져서, 가리킨 글자가 가려지지 않는다.
  const point = { x: box.x + box.width * POINTER_ANCHOR.x, y: box.y + box.height * POINTER_ANCHOR.y };
  await page.mouse.move(point.x, point.y, { steps: MOUSE_STEPS });
  markCue(context, cueName, point);
  await page.waitForTimeout(POINT_PAUSE_MS);
  return point;
}

async function clickHere(page: Page, context: ContextName, cueName: string, point: Point): Promise<void> {
  markCue(context, cueName, point);
  await page.mouse.down();
  await page.mouse.up();
}

async function glideAndClick(page: Page, context: ContextName, locator: Locator, cueName: string): Promise<Point> {
  const point = await glideTo(page, context, locator, `${cueName}-hover`);
  await clickHere(page, context, `${cueName}-click`, point);
  return point;
}

async function waitUntil(page: Page, startedAt: number, recordingMs: number): Promise<void> {
  const remaining = startedAt + recordingMs - Date.now();
  if (remaining > 0) {
    await page.waitForTimeout(remaining);
  }
}

test("데모 영상 촬영: 고객 녹화부터 반영 완료 후 다시 확인 요청까지", async ({ browser }) => {
  test.setTimeout(12 * 60 * 1000);
  await rm(VIDEO_WORK_DIRECTORY, { recursive: true, force: true });
  await mkdir(RAW_DIRECTORY, { recursive: true });

  // 고객
  const customerContext = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: VIDEO_WORK_DIRECTORY, size: VIEWPORT },
  });
  contextCreatedAtMs.customer = Date.now();
  await customerContext.addInitScript(installDemoCursor);
  const customerPage = await customerContext.newPage();
  await customerPage.goto(DEMO_PAGE_URL);
  await customerPage.mouse.move(VIEWPORT.width * 0.62, VIEWPORT.height * 0.58);

  const launcher = customerPage.getByRole("button", { name: "피드백 보내기" });
  await expect(launcher).toBeVisible();
  markCue("customer", "page-ready");
  await customerPage.waitForTimeout(1_500);

  await glideAndClick(customerPage, "customer", launcher, "launcher");
  const widget = customerPage.frameLocator('iframe[title="피드백 보내기"]');
  await expect(widget.getByText("김데모님", { exact: false })).toBeVisible();
  markCue("customer", "widget-open");
  await customerPage.waitForTimeout(1_200);

  // 1. 녹화하며 말로 설명 (대본 타임라인: docs/demo-script.md, 앞 2초 무음)
  await glideAndClick(customerPage, "customer", widget.getByRole("button", { name: "화면 녹화로 설명하기" }), "record");
  const recordingStartedAt = Date.now();
  markCue("customer", "recording-start");
  await expect(widget.getByRole("status", { name: "화면 녹화 중" })).toBeVisible();
  markCue("customer", "recording-visible");

  const registerButton = customerPage.getByRole("button", { name: "계약서 등록" });
  const typoHeader = customerPage.getByText("계약 긍액", { exact: true });
  const pageTitle = customerPage.getByRole("main").getByText("전체 계약서", { exact: true });

  await waitUntil(customerPage, recordingStartedAt, NARRATION_LEAD_MS + 8_500);
  const registerPoint = await glideTo(customerPage, "customer", registerButton, "bug-1-hover");
  await waitUntil(customerPage, recordingStartedAt, NARRATION_LEAD_MS + 13_000);
  await clickHere(customerPage, "customer", "bug-1-click-first", registerPoint);
  await waitUntil(customerPage, recordingStartedAt, NARRATION_LEAD_MS + 17_000);
  await clickHere(customerPage, "customer", "bug-1-click-second", registerPoint);
  await waitUntil(customerPage, recordingStartedAt, NARRATION_LEAD_MS + 25_000);
  await glideTo(customerPage, "customer", typoHeader, "bug-2-hover");
  await waitUntil(customerPage, recordingStartedAt, NARRATION_LEAD_MS + 37_000);
  await glideTo(customerPage, "customer", pageTitle, "bug-3-hover");
  await waitUntil(customerPage, recordingStartedAt, NARRATION_LEAD_MS + 51_500);
  await glideTo(customerPage, "customer", registerButton, "summary-hover");
  await waitUntil(customerPage, recordingStartedAt, NARRATION_LEAD_MS + 66_000);

  await glideAndClick(customerPage, "customer", widget.getByRole("button", { name: "끝내고 보내기" }), "finish");
  await expect(widget.getByText(/화면 녹화 · \d+:\d{2}/)).toBeVisible({ timeout: 60_000 });
  markCue("customer", "upload-done");
  const analyzingVisible = await widget
    .getByText("정리하고 있어요")
    .waitFor({ timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (analyzingVisible) {
    markCue("customer", "analyzing-visible");
  }

  // 2. 관리자: 로그인 → 대화 → 분석 결과
  const adminContext = await browser.newContext({
    baseURL: "http://localhost:3000",
    viewport: VIEWPORT,
    recordVideo: { dir: VIDEO_WORK_DIRECTORY, size: VIEWPORT },
  });
  contextCreatedAtMs.admin = Date.now();
  await adminContext.addInitScript(installDemoCursor);
  const adminPage = await adminContext.newPage();
  await adminPage.goto("/admin/login");
  await adminPage.mouse.move(VIEWPORT.width * 0.5, VIEWPORT.height * 0.6);
  await adminPage.getByPlaceholder("비밀번호를 입력해 주세요").fill(ADMIN_PASSWORD);
  await adminPage.getByRole("button", { name: "로그인하기" }).click();
  await glideAndClick(
    adminPage,
    "admin",
    adminPage.getByRole("navigation", { name: "받은 대화" }).getByText("김데모").first(),
    "conversation",
  );

  const analysis = adminPage.getByRole("complementary", { name: "녹화 분석" });
  await expect(analysis.getByText(/문제 3건/)).toBeVisible({ timeout: ANALYSIS_TIMEOUT_MS });
  await expect(analysis.getByText(/확인 필요 1건/)).toBeVisible();
  markCue("admin", "analysis-ready");
  const widgetAnalyzed = await widget
    .getByText(/문제 \d+건을 정리했어요/)
    .waitFor({ timeout: 10_000 })
    .then(() => true)
    .catch(() => false);
  if (widgetAnalyzed) {
    markCue("customer", "analysis-done");
  }
  await adminPage.waitForTimeout(1_000);
  const issueItems = analysis.getByRole("list").first().getByRole("listitem");
  await glideTo(adminPage, "admin", issueItems.nth(0), "issue-list-hover");
  await adminPage.waitForTimeout(800);
  await glideTo(adminPage, "admin", issueItems.nth(2), "ambiguous-issue-hover");
  await adminPage.waitForTimeout(800);

  // 3. 관리자 답장 → 고객 위젯에 실시간 표시
  await glideAndClick(adminPage, "admin", adminPage.getByPlaceholder("김데모 님에게 답장하기"), "reply-field");
  await adminPage.keyboard.type(REPLY_TEXT, { delay: 45 });
  markCue("admin", "reply-typed");
  await adminPage.waitForTimeout(400);
  await adminPage.keyboard.press("Enter");
  markCue("admin", "reply-sent");
  await expect(widget.getByText("등록 버튼부터 바로 고칠게요")).toBeVisible({ timeout: 20_000 });
  markCue("customer", "reply-visible");
  await customerPage.waitForTimeout(1_500);

  // 4. 애매한 이슈를 고객에게 되묻기
  await glideAndClick(adminPage, "admin", analysis.getByRole("button", { name: "고객에게 물어보기" }), "ask");
  await expect(analysis.getByText("고객 답변을 기다리고 있어요")).toBeVisible({ timeout: 20_000 });
  markCue("admin", "asked");

  // 5. 고객: 장면 위 질문 카드에서 한 번에 답하기
  const card = widget.getByRole("region", { name: "확인 질문" });
  await expect(card).toBeVisible({ timeout: 20_000 });
  // 스크롤은 위젯이 맞춘 그대로 둔다(새 질문 카드는 윗부분이 보이도록 위젯이 직접 맞춘다).
  await customerPage.waitForTimeout(400);
  const cardBox = await card.boundingBox();
  markCue("customer", "question-visible", cardBox ? { x: cardBox.x + cardBox.width / 2, y: cardBox.y + cardBox.height / 2 } : undefined);
  await customerPage.waitForTimeout(1_500);
  await glideAndClick(customerPage, "customer", card.getByRole("radio").first(), "answer-option");
  await customerPage.waitForTimeout(500);
  await glideAndClick(customerPage, "customer", card.getByRole("button", { name: "답변 보내기" }), "answer-send");
  await expect(widget.getByText("답변을 보냈어요")).toBeVisible();
  markCue("customer", "answered");

  // 6. 관리자 화면에 고객 답변 반영
  await expect(analysis.getByText("고객 답변", { exact: true })).toBeVisible({ timeout: 20_000 });
  markCue("admin", "answer-visible");
  await adminPage.waitForTimeout(1_500);

  // 7. 첫 번째 이슈를 반영 완료로 바꾸면 고객 위젯에 다시 확인해 달라는 안내가 뜬다
  const firstIssue = issueItems.first();
  const firstIssueToggle = firstIssue.getByRole("button").first();
  // 분석 패널 위쪽 영상이 sticky라, '보이는 것처럼' 판정돼도 그 아래에 가려질 수 있다. 가운데로 부드럽게 올린다.
  await firstIssueToggle.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "smooth" }));
  await adminPage.waitForTimeout(900);
  if ((await firstIssueToggle.getAttribute("aria-expanded")) === "true") {
    await glideTo(adminPage, "admin", firstIssueToggle, "issue-1-hover");
  } else {
    await glideAndClick(adminPage, "admin", firstIssueToggle, "issue-1");
  }
  const resolveButton = firstIssue.getByRole("button", { name: "반영 완료로 바꾸기" });
  await expect(resolveButton).toBeVisible();
  await resolveButton.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "smooth" }));
  await adminPage.waitForTimeout(900);
  await glideAndClick(adminPage, "admin", resolveButton, "resolve");
  await expect(firstIssue.getByText("반영 완료", { exact: true })).toBeVisible({ timeout: 20_000 });
  markCue("admin", "resolved");

  const reverifyMessage = widget.getByText(/수정을 반영했어요/);
  await expect(reverifyMessage).toBeVisible({ timeout: 20_000 });
  const messageBox = await reverifyMessage.boundingBox();
  markCue("customer", "reverify-visible", messageBox ? { x: messageBox.x + messageBox.width / 2, y: messageBox.y + messageBox.height / 2 } : undefined);
  await customerPage.waitForTimeout(3_000);
  markCue("customer", "end");
  markCue("admin", "end");

  // 영상 저장: 컨텍스트를 닫아야 파일이 완성된다.
  const customerVideo = customerPage.video();
  const adminVideo = adminPage.video();
  await adminContext.close();
  await customerContext.close();
  await customerVideo?.saveAs(`${RAW_DIRECTORY}/customer.webm`);
  await adminVideo?.saveAs(`${RAW_DIRECTORY}/admin.webm`);
  await rm(VIDEO_WORK_DIRECTORY, { recursive: true, force: true });

  const cueFile = {
    note: "t는 각 컨텍스트를 만든 뒤 지난 초. x, y는 가리킨 지점(화면 비율). narration.wav의 0초는 customer의 recording-start에 맞춘다.",
    viewport: VIEWPORT,
    narrationLeadSeconds: NARRATION_LEAD_MS / 1000,
    contexts: {
      customer: { createdAtMs: contextCreatedAtMs.customer, video: "customer.webm" },
      admin: { createdAtMs: contextCreatedAtMs.admin, video: "admin.webm" },
    },
    cues,
  };
  await writeFile(`${RAW_DIRECTORY}/cues.json`, `${JSON.stringify(cueFile, null, 2)}\n`);
});
