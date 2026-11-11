// 관리자 화면 미리보기용 샘플 데이터. 실행: npx tsx scripts/seed-admin-preview.ts
// - 김데모: 메시지 + 분석 끝난 녹화 1개(문제 3건, 그중 1건은 질문 카드 초안 3지선다)
// - 박지훈: 정리 중인 녹화, 최유나: 정리 실패한 녹화, 이수진: 채팅만
// 장면 이미지와 영상은 Playwright로 가짜 고객사 화면을 띄워 실제로 만들어 올린다(webm, jpeg).
// 같은 외부 ID의 기존 대화는 지우고 다시 만든다.
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium, type Browser, type Page } from "@playwright/test";

const PROJECT_KEY = "lattice-demo";
const BUCKET = "recordings";
const VIEWPORT = { width: 1280, height: 800 };
const PAGE_URL = "https://shop.lattice-demo.kr/settings/delivery";
const PAGE_TITLE = "배송지 설정 · 래티스 스토어";

type ElementBox = { selector: string; text: string; tagName: string; rect: { x: number; y: number; width: number; height: number } };

function loadEnv(): Record<string, string> {
  const content = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  const entries = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const separatorIndex = line.indexOf("=");
      return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1).replace(/^"|"$/g, "")] as const;
    });
  return Object.fromEntries(entries);
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

async function check<TData>(label: string, promise: PromiseLike<{ data: TData; error: { message: string } | null }>): Promise<TData> {
  const { data, error } = await promise;
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  return data;
}

async function getRow<TData>(label: string, promise: PromiseLike<{ data: TData; error: { message: string } | null }>): Promise<NonNullable<TData>> {
  const data = await check(label, promise);
  if (data === null || data === undefined) {
    throw new Error(`${label}: no row`);
  }
  return data;
}

const DEMO_PAGE_HTML = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, 'Apple SD Gothic Neo', sans-serif; background: #f6f7f9; color: #191f28; }
  header { height: 64px; display: flex; align-items: center; padding: 0 40px; background: #fff; border-bottom: 1px solid #e5e8eb; font-weight: 700; font-size: 18px; }
  header nav { margin-left: auto; display: flex; gap: 28px; font-weight: 400; font-size: 14px; color: #6b7684; }
  main { width: 720px; margin: 40px auto; background: #fff; border-radius: 16px; padding: 36px 40px; }
  h1 { margin: 0 0 6px; font-size: 24px; }
  p.lead { margin: 0 0 28px; color: #6b7684; font-size: 14px; }
  label { display: block; font-size: 13px; color: #4e5968; margin: 18px 0 6px; }
  input { width: 100%; height: 44px; border: 1px solid #d1d6db; border-radius: 8px; padding: 0 12px; font-size: 15px; }
  .row { display: flex; gap: 12px; }
  .row input:first-child { width: 160px; }
  .hint { font-size: 10px; color: #b0b8c1; margin-top: 6px; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 32px; }
  button { height: 44px; padding: 0 20px; border-radius: 8px; border: 0; font-size: 15px; font-weight: 600; }
  #cancel { background: #f2f4f6; color: #4e5968; }
  #save-address { background: #3182f6; color: #fff; }
  #save-address.pressed { background: #1b64da; }
  .toast { position: fixed; left: 50%; bottom: 40px; transform: translateX(-50%); background: #333d4b; color: #fff; padding: 12px 18px; border-radius: 10px; font-size: 14px; display: none; }
</style></head><body>
  <header>래티스 스토어<nav><span>주문 내역</span><span>배송지 관리</span><span>내 정보</span></nav></header>
  <main>
    <h1>배송지 설정</h1>
    <p class="lead">자주 쓰는 배송지를 저장해 두면 주문할 때 바로 불러올 수 있어요.</p>
    <label for="name">받는 분</label><input id="name" value="김데모">
    <label for="zip">주소</label>
    <div class="row"><input id="zip" value="06236"><input id="address" value="서울 강남구 테헤란로 152"></div>
    <label for="detail">상세 주소</label><input id="detail" placeholder="동, 호수를 입력해 주세요">
    <p class="hint">* 상세 주소를 입력하지 않으면 배송이 늦어질 수 있습니다. 공동현관 비밀번호는 배송 요청사항에 적어주세요.</p>
    <label for="phone">연락처</label><input id="phone" value="010-1234-5678">
    <div class="actions"><button id="cancel">취소</button><button id="save-address">저장</button></div>
  </main>
  <div class="toast" id="toast">저장 중...</div>
</body></html>`;

async function getElementBox(page: Page, selector: string): Promise<ElementBox> {
  const box = await page.locator(selector).boundingBox();
  if (!box) {
    throw new Error(`element not found: ${selector}`);
  }
  const { text, tagName } = await page.locator(selector).evaluate((element) => ({
    text: (element.textContent ?? "").trim().slice(0, 80),
    tagName: element.tagName.toLowerCase(),
  }));
  return { selector, text, tagName, rect: { x: box.x, y: box.y, width: box.width, height: box.height } };
}

// Playwright가 만든 webm은 길이 정보가 없어서, 브라우저에서 끝까지 탐색해 실제 길이를 잰다.
async function measureVideoDuration(browser: Browser, video: Buffer): Promise<number> {
  const probePage = await browser.newPage();
  const durationSeconds = await probePage.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const element = document.createElement("video");
    element.src = URL.createObjectURL(new Blob([bytes], { type: "video/webm" }));
    await new Promise((resolve) => element.addEventListener("loadedmetadata", resolve, { once: true }));
    if (!Number.isFinite(element.duration)) {
      element.currentTime = 1e6;
      await new Promise((resolve) => element.addEventListener("durationchange", resolve, { once: true }));
    }
    return element.duration;
  }, video.toString("base64"));
  await probePage.close();
  return Math.round(durationSeconds * 1000);
}

// 가짜 고객사 화면을 띄워 영상(webm)과 장면 이미지(jpeg) 3장을 만든다.
async function captureDemoMedia() {
  const videoDirectory = mkdtempSync(join(tmpdir(), "lattice-seed-"));
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: videoDirectory, size: VIEWPORT } });
  const page = await context.newPage();
  const startedAt = Date.now();
  await page.setContent(DEMO_PAGE_HTML);
  const elapsed = () => Date.now() - startedAt;

  await page.waitForTimeout(1500);
  await page.mouse.move(400, 330, { steps: 12 });
  await page.waitForTimeout(1200);
  const hintFrame = { tMs: elapsed(), image: await page.screenshot({ type: "jpeg", quality: 72 }) };
  const hintBox = await getElementBox(page, "p.hint");
  await page.mouse.move(640, 470, { steps: 12 });
  await page.waitForTimeout(1500);
  await page.click("#detail");
  await page.keyboard.type("1203호", { delay: 120 });
  await page.waitForTimeout(800);
  const saveBox = await getElementBox(page, "#save-address");
  await page.mouse.move(saveBox.rect.x + 30, saveBox.rect.y + 20, { steps: 15 });
  await page.evaluate(() => {
    document.querySelector("#save-address")?.classList.add("pressed");
    const toast = document.querySelector<HTMLElement>("#toast");
    if (toast) {
      toast.style.display = "block";
    }
  });
  await page.waitForTimeout(600);
  const saveFrame = { tMs: elapsed(), image: await page.screenshot({ type: "jpeg", quality: 72 }) };
  await page.waitForTimeout(2500);
  const zipBox = await getElementBox(page, "#zip");
  await page.mouse.move(zipBox.rect.x + 40, zipBox.rect.y + 20, { steps: 12 });
  await page.waitForTimeout(900);
  const zipFrame = { tMs: elapsed(), image: await page.screenshot({ type: "jpeg", quality: 72 }) };
  await page.waitForTimeout(2500);
  const elapsedMs = elapsed();

  await context.close();
  const videoFile = readdirSync(videoDirectory).find((name) => name.endsWith(".webm"));
  if (!videoFile) {
    throw new Error("video was not recorded");
  }
  const video = readFileSync(join(videoDirectory, videoFile));
  const durationMs = await measureVideoDuration(browser, video);
  await browser.close();
  // 녹화는 페이지가 뜬 뒤 조금 늦게 시작하므로, 그만큼 장면 시각을 당겨 영상 시각과 맞춘다.
  const startLagMs = Math.max(0, elapsedMs - durationMs);
  const alignFrame = (frame: { tMs: number; image: Buffer }) => ({ ...frame, tMs: Math.max(0, frame.tMs - startLagMs) });
  return {
    video,
    durationMs,
    frames: { hint: alignFrame(hintFrame), save: alignFrame(saveFrame), zip: alignFrame(zipFrame) },
    elements: { hint: hintBox, save: saveBox, zip: zipBox },
  };
}

async function upload(path: string, body: Buffer, contentType: string) {
  await check(`upload ${path}`, supabase.storage.from(BUCKET).upload(path, body, { contentType, upsert: true }));
}

async function resetEndUser(projectId: string, externalId: string, name: string, email: string | null): Promise<string> {
  const endUser = await getRow(
    `end user ${externalId}`,
    supabase
      .from("end_users")
      .upsert({ project_id: projectId, external_id: externalId, name, email }, { onConflict: "project_id,external_id" })
      .select("id")
      .single(),
  );
  await check(`reset ${externalId}`, supabase.from("conversations").delete().eq("end_user_id", endUser.id));
  return endUser.id;
}

async function createConversation(input: {
  projectId: string;
  endUserId: string;
  createdAt: string;
  lastMessageAt: string;
  preview: string;
  unreadCount: number;
}): Promise<string> {
  const conversation = await getRow(
    "conversation",
    supabase
      .from("conversations")
      .insert({
        project_id: input.projectId,
        end_user_id: input.endUserId,
        created_at: input.createdAt,
        last_message_at: input.lastMessageAt,
        last_message_preview: input.preview,
        admin_unread_count: input.unreadCount,
      })
      .select("id")
      .single(),
  );
  return conversation.id;
}

type SeedMessage = {
  sender: "user" | "admin" | "system";
  type: "text" | "recording" | "system";
  body: string | null;
  createdAt: string;
  recordingId?: string;
};

async function insertMessages(conversationId: string, messages: SeedMessage[]) {
  await check(
    "messages",
    supabase.from("messages").insert(
      messages.map((message) => ({
        conversation_id: conversationId,
        sender: message.sender,
        type: message.type,
        body: message.body,
        created_at: message.createdAt,
        recording_id: message.recordingId ?? null,
      })),
    ),
  );
}

async function seedKimDemo(projectId: string) {
  console.log("김데모: 가짜 고객사 화면을 녹화하는 중…");
  const media = await captureDemoMedia();
  const endUserId = await resetEndUser(projectId, "demo-user-0142", "김데모", "demo.kim@lattice-demo.kr");
  const conversationId = await createConversation({
    projectId,
    endUserId,
    createdAt: minutesAgo(52),
    lastMessageAt: minutesAgo(3),
    preview: "화면 녹화를 보냈어요",
    unreadCount: 2,
  });

  const recording = await getRow(
    "recording",
    supabase
      .from("recordings")
      .insert({
        conversation_id: conversationId,
        status: "analyzed",
        page_url: PAGE_URL,
        page_title: PAGE_TITLE,
        viewport: VIEWPORT,
        t0_epoch_ms: Date.now() - 6 * 60_000,
        duration_ms: media.durationMs,
        frames: Object.values(media.frames).map((frame) => ({ tMs: frame.tMs, reason: "interval" })),
        transcript: {
          segments: [
            { startMs: 400, endMs: 3_000, text: "배송지 설정 화면인데요, 몇 가지 불편한 게 있어서 보여드릴게요." },
            { startMs: media.frames.hint.tMs - 600, endMs: media.frames.hint.tMs + 1_800, text: "여기 밑에 안내 문구가 너무 작아서 거의 안 보여요." },
            { startMs: media.frames.save.tMs - 1_800, endMs: media.frames.save.tMs + 300, text: "상세 주소 넣고 저장을 누르면요," },
            { startMs: media.frames.save.tMs + 300, endMs: media.frames.save.tMs + 2_600, text: "여기 저장 버튼 눌러도 안 돼요. 저장 중이라고만 나오고 계속 그대로예요." },
            { startMs: media.frames.zip.tMs - 500, endMs: media.frames.zip.tMs + 2_000, text: "그리고 우편번호 칸이 좀 이상한 것 같아요." },
          ],
        },
        analysis_attempt: 1,
        created_at: minutesAgo(5),
      })
      .select("id")
      .single(),
  );
  const recordingId = recording.id;

  await upload(`${recordingId}/video.webm`, media.video, "video/webm");
  const framePaths = {
    hint: `${recordingId}/frames/${media.frames.hint.tMs}-interval.jpg`,
    save: `${recordingId}/frames/${media.frames.save.tMs}-click.jpg`,
    zip: `${recordingId}/frames/${media.frames.zip.tMs}-interval.jpg`,
  };
  await upload(framePaths.hint, media.frames.hint.image, "image/jpeg");
  await upload(framePaths.save, media.frames.save.image, "image/jpeg");
  await upload(framePaths.zip, media.frames.zip.image, "image/jpeg");

  const withViewport = (element: ElementBox) => ({ ...element, viewport: VIEWPORT });
  const issues = await getRow(
    "issues",
    supabase
      .from("issues")
      .insert([
        {
          recording_id: recordingId,
          conversation_id: conversationId,
          t_ms: media.frames.save.tMs,
          quote: "여기 저장 버튼 눌러도 안 돼요",
          element: withViewport(media.elements.save),
          frame_path: framePaths.save,
          title: "저장 버튼을 눌러도 저장되지 않아요",
          summary: "상세 주소를 입력하고 저장을 누르면 ‘저장 중...’ 안내만 남고 화면이 바뀌지 않아요. 저장 요청이 끝나지 않거나 실패를 알리지 않는 것으로 보여요.",
          suggestion: "저장 요청 결과를 확인해 성공하면 완료 안내를, 실패하면 이유와 다시 해보기 버튼을 보여 주세요.",
          confidence: "clear",
          sort_order: 0,
        },
        {
          recording_id: recordingId,
          conversation_id: conversationId,
          t_ms: media.frames.hint.tMs,
          quote: "여기 밑에 안내 문구가 너무 작아서 거의 안 보여요",
          element: withViewport(media.elements.hint),
          frame_path: framePaths.hint,
          title: "상세 주소 안내 문구가 잘 안 보여요",
          summary: "상세 주소 입력칸 아래 안내 문구가 10px, 옅은 회색이라 읽기 어려워요. 배송 지연과 관련된 중요한 내용이에요.",
          suggestion: "안내 문구를 13px 이상, 본문보다 한 단계 옅은 색으로 바꾸고 입력칸 바로 아래에 붙여 주세요.",
          confidence: "clear",
          sort_order: 1,
        },
        {
          recording_id: recordingId,
          conversation_id: conversationId,
          t_ms: media.frames.zip.tMs,
          quote: "우편번호 칸이 좀 이상한 것 같아요",
          element: withViewport(media.elements.zip),
          frame_path: framePaths.zip,
          title: "우편번호 입력칸이 불편해요",
          summary: "고객이 우편번호 칸을 가리키며 ‘이상하다’고 했지만 무엇이 불편한지는 말하지 않았어요.",
          suggestion: "고객 답을 받은 뒤 정해요. 칸이 좁은 문제라면 너비를 늘리고, 직접 입력이 불편하다면 주소 검색 버튼을 붙여 주세요.",
          confidence: "ambiguous",
          sort_order: 2,
        },
      ])
      .select("id, confidence"),
  );
  const ambiguousIssue = issues.find((issue) => issue.confidence === "ambiguous");
  if (!ambiguousIssue) {
    throw new Error("ambiguous issue missing");
  }
  const zip = media.elements.zip.rect;
  await check(
    "clarification card",
    supabase.from("clarification_cards").insert({
      issue_id: ambiguousIssue.id,
      question: "우편번호 칸에서 어떤 점이 불편하셨어요?",
      options: [
        { id: "option-1", label: "칸이 좁아서 번호가 잘려 보여요" },
        { id: "option-2", label: "주소 검색으로 찾고 싶어요" },
        { id: "option-3", label: "번호를 넣어도 주소가 안 바뀌어요" },
      ],
      highlight: {
        x: (zip.x - 6) / VIEWPORT.width,
        y: (zip.y - 6) / VIEWPORT.height,
        width: (zip.width + 12) / VIEWPORT.width,
        height: (zip.height + 12) / VIEWPORT.height,
      },
    }),
  );

  await insertMessages(conversationId, [
    { sender: "user", type: "text", body: "안녕하세요. 배송지 저장이 안 돼서 문의드려요.", createdAt: minutesAgo(52) },
    { sender: "admin", type: "text", body: "안녕하세요, 래티스 스토어예요. 어떤 화면에서 막히셨는지 녹화로 보여주시면 바로 확인할게요.", createdAt: minutesAgo(48) },
    { sender: "user", type: "text", body: "네 잠시만요", createdAt: minutesAgo(7) },
    { sender: "user", type: "recording", body: null, createdAt: minutesAgo(5), recordingId },
    { sender: "user", type: "text", body: "저장 버튼 누르면 계속 저장 중이라고만 떠요. 그리고 글씨도 너무 작아요.", createdAt: minutesAgo(3) },
  ]);
  return conversationId;
}

async function seedOtherConversations(projectId: string) {
  const parkId = await resetEndUser(projectId, "demo-user-0217", "박지훈", "jihoon.park@lattice-demo.kr");
  const parkConversationId = await createConversation({
    projectId,
    endUserId: parkId,
    createdAt: minutesAgo(30),
    lastMessageAt: minutesAgo(1),
    preview: "화면 녹화를 보냈어요",
    unreadCount: 1,
  });
  const parkRecording = await getRow(
    "park recording",
    supabase
      .from("recordings")
      .insert({
        conversation_id: parkConversationId,
        status: "analyzing",
        page_url: "https://shop.lattice-demo.kr/cart",
        page_title: "장바구니 · 래티스 스토어",
        duration_ms: 38_000,
        analysis_started_at: minutesAgo(0.5),
        created_at: minutesAgo(1),
      })
      .select("id")
      .single(),
  );
  await insertMessages(parkConversationId, [
    { sender: "user", type: "text", body: "쿠폰이 적용이 안 되는 것 같아요", createdAt: minutesAgo(2) },
    { sender: "user", type: "recording", body: null, createdAt: minutesAgo(1), recordingId: parkRecording.id },
  ]);

  const leeId = await resetEndUser(projectId, "demo-user-0098", "이수진", null);
  const leeConversationId = await createConversation({
    projectId,
    endUserId: leeId,
    createdAt: minutesAgo(60 * 5),
    lastMessageAt: minutesAgo(60 * 2 + 10),
    preview: "감사합니다. 확인했어요",
    unreadCount: 0,
  });
  await insertMessages(leeConversationId, [
    { sender: "user", type: "text", body: "주문 내역에서 영수증은 어디서 받을 수 있나요?", createdAt: minutesAgo(60 * 5) },
    { sender: "admin", type: "text", body: "주문 내역에서 주문을 누르면 맨 아래에 ‘영수증 받기’가 있어요.", createdAt: minutesAgo(60 * 4) },
    { sender: "user", type: "text", body: "감사합니다. 확인했어요", createdAt: minutesAgo(60 * 2 + 10) },
  ]);

  const choiId = await resetEndUser(projectId, "demo-user-0311", "최유나", "yuna.choi@lattice-demo.kr");
  const choiConversationId = await createConversation({
    projectId,
    endUserId: choiId,
    createdAt: minutesAgo(60 * 26),
    lastMessageAt: minutesAgo(60 * 25),
    preview: "화면 녹화를 보냈어요",
    unreadCount: 0,
  });
  const choiRecording = await getRow(
    "choi recording",
    supabase
      .from("recordings")
      .insert({
        conversation_id: choiConversationId,
        status: "failed",
        page_url: "https://shop.lattice-demo.kr/products/2291",
        page_title: "린넨 셔츠 · 래티스 스토어",
        duration_ms: 72_000,
        error: "transcription timeout",
        created_at: minutesAgo(60 * 25),
      })
      .select("id")
      .single(),
  );
  await insertMessages(choiConversationId, [
    { sender: "user", type: "text", body: "사이즈표가 안 열려요", createdAt: minutesAgo(60 * 25 + 2) },
    { sender: "user", type: "recording", body: null, createdAt: minutesAgo(60 * 25), recordingId: choiRecording.id },
  ]);
}

async function main() {
  const project = await getRow("project", supabase.from("projects").select("id").eq("project_key", PROJECT_KEY).single());
  const kimConversationId = await seedKimDemo(project.id);
  await seedOtherConversations(project.id);
  console.log(`완료. 김데모 대화: http://localhost:3000/admin/${kimConversationId}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
