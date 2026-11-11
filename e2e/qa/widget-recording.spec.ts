import { expect, test, type FrameLocator, type Page } from "@playwright/test";
// eslint-disable-next-line no-restricted-imports -- @/ 별칭은 src/만 가리켜서 e2e 도우미는 상대 경로로 가져온다.
import {
  IS_DEPLOYED,
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
  saveDiagnostics,
} from "./qa-helpers";

// 녹화 QA: 시작·끝내기, 화면 공유/마이크 거부, 화면 공유 중단(자동 종료), 최대 시간 자동 종료,
// 업로드 실패 → 다시 보내기, 녹화·업로드 중 새로고침.
// 화면 공유는 playwright.config.ts의 크롬 플래그(--auto-accept-this-tab-capture 등)로 자동 수락된다.
test.afterAll(async () => {
  await cleanupQaUsers("qa-rec-");
});

const STORAGE_UPLOAD_PATTERN = /\/storage\/v1\/object\/upload\/sign\//;
const SHORT_MAX_RECORDING_MS = 5_000;
const SERVER_RECORDING_STATUS = /정리하고 있어요|정리를 마쳤어요|문제 \d+건을 정리했어요|받았어요. 담당자가 직접 볼게요/;

function getWidgetFrame(page: Page) {
  const frame = page.frames().find((candidate) => candidate.url().startsWith(`${SDK_ORIGIN}/widget`));
  if (!frame) {
    throw new Error("위젯 iframe을 찾지 못했어요");
  }
  return frame;
}

async function startRecording(widget: FrameLocator): Promise<void> {
  await widget.getByRole("button", { name: "화면 녹화로 설명하기" }).click();
  await expect(widget.getByRole("status", { name: "화면 녹화 중" })).toBeVisible({ timeout: 10_000 });
}

async function countRecordings(userId: string): Promise<{ status: string; id: string }[]> {
  const conversationId = await findConversationIdForUser(userId);
  const { data } = await getQaDatabase().from("recordings").select("id, status").eq("conversation_id", conversationId);
  return (data ?? []) as { status: string; id: string }[];
}

test("녹화를 시작하고 끝내면 업로드되고 '정리하고 있어요' 상태의 녹화 메시지가 남는다", async ({ page }) => {
  const diagnostics = collectDiagnostics(page);
  const user = createQaUser("rec-basic");
  const widget = await openWidget(page, user);
  await startRecording(widget);
  await expect(page.locator(WIDGET_FRAME)).toHaveAttribute("data-mode", "recording");
  await expect(page.getByRole("button", { name: /피드백 보내기/ })).toBeHidden();
  await captureQaScreen(page, "rec-01-recording-pill");
  await page.getByRole("button", { name: "계약서 등록" }).click();
  await page.waitForTimeout(4_000);
  await widget.getByRole("button", { name: "끝내고 보내기" }).click();
  await expect(widget.getByText(/화면 녹화 · 0:0[3-9]/)).toBeVisible({ timeout: 60_000 });
  await expect(widget.getByText(/정리하고 있어요|정리를 마쳤어요|문제 \d+건을 정리했어요|받았어요. 담당자가 직접 볼게요/)).toBeVisible();
  await captureQaScreen(page, "rec-01-uploaded");
  const recordings = await countRecordings(user.id);
  expect(recordings).toHaveLength(1);
  expect(["uploaded", "analyzing", "analyzed", "failed"]).toContain(recordings[0].status);
  saveDiagnostics("rec-01-basic", diagnostics);
});

test("녹화 중에는 취소(올리지 않고 버리기) 버튼이 있다", async ({ page }) => {
  const user = createQaUser("rec-cancel");
  const widget = await openWidget(page, user);
  await startRecording(widget);
  const pillButtons = await widget.getByRole("status", { name: "화면 녹화 중" }).getByRole("button").allTextContents();
  console.log(`[qa] recording pill buttons: ${JSON.stringify(pillButtons)}`);
  await widget.getByRole("button", { name: "끝내고 보내기" }).click();
  await expect(widget.getByText(/화면 녹화 · /)).toBeVisible({ timeout: 60_000 });
  expect(pillButtons.some((label) => /취소|버리기/.test(label)), "녹화 취소 수단이 없다").toBe(true);
});

test("화면 공유를 거부하면 안내 토스트가 뜨고 다시 시도할 수 있다", async ({ page }) => {
  await page.addInitScript(() => {
    if (location.pathname.startsWith("/widget")) {
      navigator.mediaDevices.getDisplayMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    }
  });
  const user = createQaUser("rec-screen-denied");
  const widget = await openWidget(page, user);
  await widget.getByRole("button", { name: "화면 녹화로 설명하기" }).click();
  await expect(widget.getByText("화면 공유를 시작하지 않았어요")).toBeVisible();
  await captureQaScreen(page, "rec-02-screen-denied");
  await expect(page.locator(WIDGET_FRAME)).toHaveAttribute("data-mode", "open");
  await expect(widget.getByRole("button", { name: "화면 녹화로 설명하기" })).toBeEnabled();
  await widget.getByRole("button", { name: "화면 녹화", exact: true }).click();
  await expect(widget.getByText("화면 공유를 시작하지 않았어요")).toBeVisible();
});

test("마이크를 거부하면 안내 토스트가 뜨고, 이미 받은 화면 공유는 바로 멈춘다", async ({ page }) => {
  await page.addInitScript(() => {
    if (location.pathname.startsWith("/widget")) {
      const original = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getDisplayMedia = async (options) => {
        const stream = await original(options);
        (window as unknown as { __qaDisplay: MediaStream }).__qaDisplay = stream;
        return stream;
      };
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    }
  });
  const user = createQaUser("rec-mic-denied");
  const widget = await openWidget(page, user);
  await widget.getByRole("button", { name: "화면 녹화로 설명하기" }).click();
  // UX-20: 해결 방법까지 알려 주는 문구로 바뀌었다.
  await expect(widget.getByText("마이크를 쓸 수 없어요. 주소창 왼쪽 자물쇠에서 마이크를 허용해 주세요")).toBeVisible();
  await captureQaScreen(page, "rec-03-mic-denied");
  await expect(page.locator(WIDGET_FRAME)).toHaveAttribute("data-mode", "open");
  const trackStates = await getWidgetFrame(page).evaluate(() =>
    (window as unknown as { __qaDisplay?: MediaStream }).__qaDisplay?.getTracks().map((track) => track.readyState) ?? [],
  );
  console.log(`[qa] display tracks after mic denied: ${JSON.stringify(trackStates)}`);
  expect(trackStates.length).toBeGreaterThan(0);
  expect(trackStates.every((state) => state === "ended")).toBe(true);
});

test("크롬의 '공유 중지'로 화면 공유가 끊기면 녹화가 자동으로 끝나고 올라간다", async ({ page }) => {
  await page.addInitScript(() => {
    if (location.pathname.startsWith("/widget")) {
      const original = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getDisplayMedia = async (options) => {
        const stream = await original(options);
        (window as unknown as { __qaDisplay: MediaStream }).__qaDisplay = stream;
        return stream;
      };
    }
  });
  const user = createQaUser("rec-track-ended");
  const widget = await openWidget(page, user);
  await startRecording(widget);
  await page.waitForTimeout(3_000);
  // track.stop()은 'ended' 이벤트를 내지 않으므로, 브라우저가 공유를 끊을 때처럼 이벤트를 직접 보낸다.
  await getWidgetFrame(page).evaluate(() => {
    const track = (window as unknown as { __qaDisplay: MediaStream }).__qaDisplay.getVideoTracks()[0];
    track.stop();
    track.dispatchEvent(new Event("ended"));
  });
  await expect(widget.getByText(/화면 녹화 · 0:0[2-9]/)).toBeVisible({ timeout: 60_000 });
  await captureQaScreen(page, "rec-04-share-stopped");
});

// 실제 3분을 기다리지 않는다. 개발 서버의 /widget은 maxRecordingMs로 한도를 줄일 수 있다(운영에서는 무시, get-max-recording-ms.test.ts).
test("최대 녹화 시간에 닿으면 자동으로 끝나고 올라간다(개발 서버에서 한도를 5초로 줄여 확인)", async ({ page }) => {
  const diagnostics = collectDiagnostics(page);
  await page.route(
    (url) => url.origin === SDK_ORIGIN && url.pathname === "/widget",
    (route) => {
      const url = new URL(route.request().url());
      url.searchParams.set("maxRecordingMs", String(SHORT_MAX_RECORDING_MS));
      return route.continue({ url: url.toString() });
    },
  );
  const user = createQaUser("rec-max");
  const widget = await openWidget(page, user);
  await startRecording(widget);
  const pill = widget.getByRole("status", { name: "화면 녹화 중" });
  await expect(pill.getByText("/ 0:05")).toBeVisible();
  // 끝내기를 누르지 않는다. 한도에 닿으면 알약이 스스로 사라져야 한다.
  await expect(pill).toHaveCount(0, { timeout: SHORT_MAX_RECORDING_MS + 10_000 });
  // 업로드 카드("보내는 중")가 서버 녹화 카드로 바뀐 뒤에 DB를 본다.
  await expect(widget.getByText(/보내는 중/)).toHaveCount(0, { timeout: 60_000 });
  await expect(widget.getByText(/화면 녹화 · 0:0[45]/)).toBeVisible();
  await expect(widget.getByText(SERVER_RECORDING_STATUS)).toBeVisible();
  await captureQaScreen(page, "rec-05-max-duration");
  const conversationId = await findConversationIdForUser(user.id);
  const { data: recordings } = await getQaDatabase().from("recordings").select("status, duration_ms").eq("conversation_id", conversationId);
  console.log(`[qa] max-duration recordings: ${JSON.stringify(recordings)}`);
  expect(recordings).toHaveLength(1);
  expect(recordings?.[0].status).not.toBe("uploading");
  expect(recordings?.[0].duration_ms).toBeGreaterThanOrEqual(SHORT_MAX_RECORDING_MS - 1_000);
  expect(recordings?.[0].duration_ms).toBeLessThanOrEqual(SHORT_MAX_RECORDING_MS + 1_000);
  saveDiagnostics("rec-05-max", diagnostics);
});

test("업로드가 실패하면 다시 보내기 버튼이 뜨고, 다시 보내면 녹화가 하나만 남는다", async ({ page, browser }) => {
  const diagnostics = collectDiagnostics(page);
  const user = createQaUser("rec-retry");
  const widget = await openWidget(page, user);
  await page.route(STORAGE_UPLOAD_PATTERN, (route) => route.abort("failed"));
  await startRecording(widget);
  await page.waitForTimeout(3_000);
  await widget.getByRole("button", { name: "끝내고 보내기" }).click();
  const retryButton = widget.getByRole("button", { name: "다시 보내기" });
  await expect(retryButton).toBeVisible({ timeout: 30_000 });
  // 카드 상태와 토스트("녹화를 보내지 못했어요. ‘다시 보내기’를 눌러 주세요")가 둘 다 보인다.
  await expect(widget.locator('[data-status="upload_failed"]')).toHaveText("보내지 못했어요");
  await expect(widget.getByText("녹화를 보내지 못했어요. ‘다시 보내기’를 눌러 주세요")).toBeVisible();
  await captureQaScreen(page, "rec-06-upload-failed");

  await page.unroute(STORAGE_UPLOAD_PATTERN);
  await retryButton.click();
  // 업로드 카드("보내는 중")가 서버 녹화 메시지("정리하고 있어요" 등)로 바뀔 때까지 기다린다.
  await expect(widget.getByText(/보내는 중/)).toHaveCount(0, { timeout: 90_000 });
  await expect(widget.getByText(/정리하고 있어요|정리를 마쳤어요|문제 \d+건을 정리했어요/)).toBeVisible({ timeout: 30_000 });
  await expect(retryButton).toBeHidden();
  await captureQaScreen(page, "rec-06-upload-retried");

  const recordings = await countRecordings(user.id);
  console.log(`[qa] recordings after retry: ${JSON.stringify(recordings.map((recording) => recording.status))}`);
  const adminContext = await browser.newContext();
  const adminPage = await loginAdmin(adminContext);
  await adminPage.goto(`${SDK_ORIGIN}/admin/${await findConversationIdForUser(user.id)}`);
  await expect(adminPage.getByRole("complementary", { name: "녹화 분석" })).toBeVisible();
  await captureQaScreen(adminPage, "rec-06-admin-after-retry");
  await adminContext.close();
  saveDiagnostics("rec-06-retry", diagnostics);
  expect(recordings, "다시 보내기가 녹화 행을 새로 만들어 고아 'uploading' 녹화가 남는다").toHaveLength(1);
});

test("업로드 실패 카드는 '정리하지 못했어요'가 아니라 '보내지 못했어요'라고 안내한다", async ({ page }) => {
  const user = createQaUser("rec-failcopy");
  const widget = await openWidget(page, user);
  await page.route(STORAGE_UPLOAD_PATTERN, (route) => route.abort("failed"));
  await startRecording(widget);
  await page.waitForTimeout(2_000);
  await widget.getByRole("button", { name: "끝내고 보내기" }).click();
  await expect(widget.getByRole("button", { name: "다시 보내기" })).toBeVisible({ timeout: 30_000 });
  const statusText = await widget.locator('[data-status="upload_failed"]').textContent();
  console.log(`[qa] upload-failed status copy: ${statusText}`);
  expect(statusText).not.toBe("정리하지 못했어요");
});

// BUG-18: 녹화·업로드 중에는 고객사 페이지가 떠나기 전에 확인을 묻는다. 확인 창을 닫으면(dismiss) 페이지에 남아
// reload가 끝나지 않으므로, 여기서는 고객이 "떠나기"를 고른 경우(accept)를 본다.
function acceptLeaveConfirmation(page: Page): { readonly types: string[] } {
  const shown = { types: [] as string[] };
  page.on("dialog", async (dialog) => {
    shown.types.push(dialog.type());
    await dialog.accept();
  });
  return shown;
}

test("녹화 중 새로고침하면 떠나기 전에 확인을 묻고, 떠나면 녹화는 사라지고 위젯은 정상으로 돌아온다", async ({ page }) => {
  const user = createQaUser("rec-refresh-recording");
  const widget = await openWidget(page, user);
  await startRecording(widget);
  await page.waitForTimeout(2_000);
  const dialogs = acceptLeaveConfirmation(page);
  await page.reload();
  expect(dialogs.types).toEqual(["beforeunload"]);
  await page.getByRole("button", { name: /피드백 보내기/ }).click();
  const reloadedWidget = page.frameLocator(WIDGET_FRAME);
  await expect(reloadedWidget.getByRole("button", { name: "화면 녹화", exact: true })).toBeEnabled({ timeout: 20_000 });
  await captureQaScreen(page, "rec-07-refresh-mid-recording");
  expect(await countRecordings(user.id)).toHaveLength(0);
  await expect(reloadedWidget.getByRole("status", { name: "화면 녹화 중" })).toHaveCount(0);
});

// BUG-02: 버려진 업로드는 업로드 주소를 받은 지 30분 뒤 워커가 expire_stale_uploads로 실패 처리한다.
// 30분을 기다리지 않도록 이 녹화의 upload_requested_at만 31분 전으로 돌리고, 워커가 1분마다 부르는 같은 RPC를 부른다.
test("업로드 중 새로고침하면 확인을 묻고, 버려진 'uploading' 녹화는 30분이 지나면 관리자에 실패 이유와 함께 보인다", async ({ page, browser }) => {
  test.skip(IS_DEPLOYED, "배포 DB의 다른 녹화까지 만료시키지 않도록 로컬에서만 돈다");
  const user = createQaUser("rec-refresh-upload");
  const widget = await openWidget(page, user);
  // 업로드 요청을 붙잡아 '업로드 중' 상태에서 새로고침한다.
  await page.route(STORAGE_UPLOAD_PATTERN, () => undefined);
  await startRecording(widget);
  await page.waitForTimeout(2_000);
  await widget.getByRole("button", { name: "끝내고 보내기" }).click();
  await expect(widget.getByText(/보내는 중/)).toBeVisible({ timeout: 30_000 });
  await captureQaScreen(page, "rec-08-uploading");
  const dialogs = acceptLeaveConfirmation(page);
  await page.reload();
  expect(dialogs.types).toEqual(["beforeunload"]);
  await page.getByRole("button", { name: /피드백 보내기/ }).click();
  const reloadedWidget = page.frameLocator(WIDGET_FRAME);
  await expect(reloadedWidget.getByRole("button", { name: "화면 녹화", exact: true })).toBeEnabled({ timeout: 20_000 });
  await captureQaScreen(page, "rec-08-after-refresh-widget");
  const recordings = await countRecordings(user.id);
  console.log(`[qa] refresh mid-upload recordings: ${JSON.stringify(recordings)}`);
  expect(recordings.map((recording) => recording.status)).toEqual(["uploading"]);

  const database = getQaDatabase();
  const staleRequestedAt = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  await database.from("recordings").update({ upload_requested_at: staleRequestedAt }).eq("id", recordings[0].id);
  const { data: expired, error } = await database.rpc("expire_stale_uploads", { p_stale_minutes: 30 });
  expect(error).toBeNull();
  expect((expired as { id: string }[]).map((row) => row.id)).toContain(recordings[0].id);

  const adminContext = await browser.newContext();
  const adminPage = await loginAdmin(adminContext);
  await adminPage.goto(`${SDK_ORIGIN}/admin/${await findConversationIdForUser(user.id)}`);
  const analysis = adminPage.getByRole("complementary", { name: "녹화 분석" });
  await expect(analysis.getByText("업로드가 끝나지 않았어요. 고객이 업로드 중에 페이지를 떠났을 수 있어요.", { exact: false })).toBeVisible();
  await expect(analysis.getByText("고객이 영상을 올리고 있어요")).toHaveCount(0);
  await captureQaScreen(adminPage, "rec-08-admin-expired-upload");
  await adminContext.close();
});
