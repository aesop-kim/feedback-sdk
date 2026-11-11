import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type APIRequestContext, type BrowserContext, type FrameLocator, type Page } from "@playwright/test";

// QA 회귀 스펙 공통 도우미.
// QA_TARGET=deployed 이면 배포 주소(클라우드 DB)를, 아니면 로컬(3000/3001)을 친다.
// 테스트 사용자는 external_id가 "qa-"로 시작하고, 끝나면 cleanupQaUsers()로 지운다.

export const QA_TARGET = process.env.QA_TARGET === "deployed" ? "deployed" : "local";
export const IS_DEPLOYED = QA_TARGET === "deployed";

export const SDK_ORIGIN = IS_DEPLOYED ? "https://lattice-feedback-sdk.vercel.app" : "http://localhost:3000";
export const DEMO_URL = IS_DEPLOYED ? "https://lattice-feedback-demo.vercel.app/" : "http://localhost:3001/";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "lattice-demo";
export const SCREENS_DIRECTORY = ".screens/qa-v2/functional";
export const WIDGET_FRAME = 'iframe[title="피드백 보내기"]';

function readEnvFile(fileName: string): Record<string, string> {
  try {
    const text = readFileSync(path.join(process.cwd(), fileName), "utf8");
    const entries: Record<string, string> = {};
    for (const line of text.split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (match) {
        entries[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
    return entries;
  } catch {
    return {};
  }
}

let cachedAdminClient: SupabaseClient | null = null;

// 정리·검증용 service role 클라이언트. 키는 출력하지 않는다.
export function getQaDatabase(): SupabaseClient {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }
  const local = readEnvFile(".env.local");
  const cloud = readEnvFile(".env.cloud");
  const url = IS_DEPLOYED ? cloud.CLOUD_SUPABASE_URL : local.NEXT_PUBLIC_SUPABASE_URL;
  const key = IS_DEPLOYED ? cloud.CLOUD_SERVICE_ROLE_KEY : local.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(`QA DB 접속 정보가 없어요 (${QA_TARGET})`);
  }
  cachedAdminClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedAdminClient;
}

export function createQaUser(label: string): { id: string; name: string; email: string } {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { id: `qa-${label}-${suffix}`, name: `QA${label}`, email: `qa+${suffix}@example.com` };
}

// 데모 페이지의 DEMO_USER를 QA 사용자로 고정해서, 다른 작업(디자이너 캡처 등)의 김데모 대화와 섞이지 않게 한다.
// HTML을 route로 바꿔치기하면 크롬 Local Network Access가 localhost sdk.js를 막으므로, init script로 setter를 막는다.
export async function pinQaUserOnDemoPage(page: Page, user: { id: string; name: string; email?: string }): Promise<void> {
  await page.addInitScript((qaUser) => {
    Object.defineProperty(window, "DEMO_USER", { configurable: true, get: () => qaUser, set: () => undefined });
  }, user);
}

export type PageDiagnostics = { consoleErrors: string[]; failedRequests: string[]; badResponses: string[] };

// 페이지(및 그 안의 iframe)의 콘솔 에러·실패 요청·4xx/5xx 응답을 모은다.
export function collectDiagnostics(page: Page): PageDiagnostics {
  const diagnostics: PageDiagnostics = { consoleErrors: [], failedRequests: [], badResponses: [] };
  page.on("console", (message) => {
    if (message.type() === "error") {
      diagnostics.consoleErrors.push(`${message.text()} @ ${message.location().url}`);
    }
  });
  page.on("pageerror", (error) => diagnostics.consoleErrors.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => {
    diagnostics.failedRequests.push(`${request.method()} ${request.url()} → ${request.failure()?.errorText ?? "?"}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      diagnostics.badResponses.push(`${response.request().method()} ${response.url()} → ${response.status()}`);
    }
  });
  return diagnostics;
}

export function saveDiagnostics(name: string, diagnostics: PageDiagnostics): void {
  const directory = path.join(SCREENS_DIRECTORY, "logs");
  mkdirSync(directory, { recursive: true });
  writeFileSync(path.join(directory, `${QA_TARGET}-${name}.json`), JSON.stringify(diagnostics, null, 2));
}

export async function captureQaScreen(page: Page, name: string): Promise<string> {
  const filePath = path.join(SCREENS_DIRECTORY, `${QA_TARGET}-${name}.png`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: filePath });
  return filePath;
}

export async function openWidget(page: Page, user: { id: string; name: string; email?: string }): Promise<FrameLocator> {
  await pinQaUserOnDemoPage(page, user);
  await page.goto(DEMO_URL);
  const launcher = page.getByRole("button", { name: /피드백 보내기/ });
  await expect(launcher).toBeVisible();
  await launcher.click();
  const widget = page.frameLocator(WIDGET_FRAME);
  // 텍스트 상자는 로딩 중에도 활성이라, 세션 준비가 끝나야 켜지는 녹화 아이콘 버튼으로 준비 완료를 판단한다.
  await expect(widget.getByRole("button", { name: "화면 녹화", exact: true })).toBeEnabled({ timeout: 20_000 });
  return widget;
}

export async function loginAdmin(context: BrowserContext): Promise<Page> {
  const adminPage = await context.newPage();
  await adminPage.goto(`${SDK_ORIGIN}/admin/login`);
  await adminPage.getByPlaceholder("비밀번호를 입력해 주세요").fill(ADMIN_PASSWORD);
  await adminPage.getByRole("button", { name: "로그인하기" }).click();
  await adminPage.waitForURL(/\/admin$/);
  return adminPage;
}

// 위젯 iframe의 localStorage에 저장된 대화 토큰을 꺼낸다(API 직접 호출용).
export async function readWidgetSession(page: Page, userId: string): Promise<{ conversationId: string; conversationToken: string }> {
  const frame = page.frames().find((candidate) => candidate.url().startsWith(`${SDK_ORIGIN}/widget`));
  if (!frame) {
    throw new Error("위젯 iframe을 찾지 못했어요");
  }
  const raw = await frame.evaluate((key) => window.localStorage.getItem(key), `lattice-feedback:lattice-demo:${userId}`);
  if (!raw) {
    throw new Error("저장된 위젯 세션이 없어요");
  }
  return JSON.parse(raw) as { conversationId: string; conversationToken: string };
}

export async function findConversationIdForUser(externalId: string): Promise<string | null> {
  const database = getQaDatabase();
  const { data: endUser } = await database.from("end_users").select("id").eq("external_id", externalId).maybeSingle();
  if (!endUser) {
    return null;
  }
  const { data: conversation } = await database.from("conversations").select("id").eq("end_user_id", endUser.id).maybeSingle();
  return (conversation?.id as string | undefined) ?? null;
}

// 녹화 분석 없이 관리자/되묻기 흐름을 시험하려고, 분석이 끝난 녹화·이슈·질문 카드를 DB에 직접 만든다.
export async function seedAnalyzedRecording(
  conversationId: string,
  options: { status?: "analyzed" | "failed" | "analyzing"; error?: string; ambiguous?: boolean } = {},
): Promise<{ recordingId: string; issueId: string | null; cardId: string | null }> {
  const database = getQaDatabase();
  const status = options.status ?? "analyzed";
  const { data: recording, error } = await database
    .from("recordings")
    .insert({
      conversation_id: conversationId,
      page_url: DEMO_URL,
      page_title: "QA seeded",
      viewport: { width: 1440, height: 900 },
      t0_epoch_ms: Date.now(),
      duration_ms: 12_000,
      audio_offset_ms: 0,
      frames: [],
      status,
      error: options.error ?? null,
      transcript: status === "analyzed" ? { segments: [{ startMs: 0, endMs: 2000, text: "QA 시드 발화" }] } : null,
    })
    .select("id")
    .single();
  if (error || !recording) {
    throw new Error(`녹화 시드 실패: ${error?.message}`);
  }
  await database.from("messages").insert({ conversation_id: conversationId, sender: "user", type: "recording", recording_id: recording.id });
  if (status !== "analyzed") {
    return { recordingId: recording.id as string, issueId: null, cardId: null };
  }
  const { data: issue, error: issueError } = await database
    .from("issues")
    .insert({
      recording_id: recording.id,
      conversation_id: conversationId,
      t_ms: 1000,
      quote: "여기 버튼이 이상해요",
      title: "QA 이슈 제목",
      summary: "QA로 만든 이슈 요약",
      suggestion: "QA 수정 제안",
      confidence: options.ambiguous === false ? "clear" : "ambiguous",
      status: "open",
      sort_order: 0,
    })
    .select("id")
    .single();
  if (issueError || !issue) {
    throw new Error(`이슈 시드 실패: ${issueError?.message}`);
  }
  if (options.ambiguous === false) {
    return { recordingId: recording.id as string, issueId: issue.id as string, cardId: null };
  }
  const { data: card, error: cardError } = await database
    .from("clarification_cards")
    .insert({
      issue_id: issue.id,
      question: "어떤 버튼이 문제였나요?",
      options: [
        { id: "option-1", label: "등록 버튼" },
        { id: "option-2", label: "취소 버튼" },
      ],
    })
    .select("id")
    .single();
  if (cardError || !card) {
    throw new Error(`질문 카드 시드 실패: ${cardError?.message}`);
  }
  return { recordingId: recording.id as string, issueId: issue.id as string, cardId: card.id as string };
}

// qa- 사용자와 그 대화·녹화·Storage 파일을 지운다. 지운 사용자 수를 돌려준다.
export async function cleanupQaUsers(prefix = "qa-"): Promise<number> {
  const database = getQaDatabase();
  const { data: endUsers } = await database.from("end_users").select("id").like("external_id", `${prefix}%`);
  const endUserIds = (endUsers ?? []).map((row) => row.id as string);
  if (endUserIds.length === 0) {
    return 0;
  }
  const { data: conversations } = await database.from("conversations").select("id").in("end_user_id", endUserIds);
  const conversationIds = (conversations ?? []).map((row) => row.id as string);
  if (conversationIds.length > 0) {
    const { data: recordings } = await database.from("recordings").select("id").in("conversation_id", conversationIds);
    for (const recording of recordings ?? []) {
      const folder = recording.id as string;
      const { data: files } = await database.storage.from("recordings").list(folder, { limit: 1000 });
      const { data: frameFiles } = await database.storage.from("recordings").list(`${folder}/frames`, { limit: 1000 });
      const paths = [
        ...(files ?? []).filter((file) => file.id).map((file) => `${folder}/${file.name}`),
        ...(frameFiles ?? []).map((file) => `${folder}/frames/${file.name}`),
      ];
      if (paths.length > 0) {
        await database.storage.from("recordings").remove(paths);
      }
    }
  }
  await database.from("end_users").delete().in("id", endUserIds);
  return endUserIds.length;
}

// 위젯 없이 API로 대화를 연다(보안·경계값 시험용). hostOrigin은 허용된 데모 페이지 origin.
export async function startConversationViaApi(
  request: APIRequestContext,
  user: { id: string; name: string; email?: string },
): Promise<{ conversationId: string; conversationToken: string }> {
  const response = await request.post(`${SDK_ORIGIN}/api/conversations`, {
    data: { projectKey: "lattice-demo", hostOrigin: new URL(DEMO_URL).origin, user },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as { conversationId: string; conversationToken: string };
}

export async function approveCardInDatabase(cardId: string, conversationId: string): Promise<void> {
  const database = getQaDatabase();
  await database.from("clarification_cards").update({ approved_at: new Date().toISOString() }).eq("id", cardId);
  await database.from("messages").insert({ conversation_id: conversationId, sender: "admin", type: "clarification", clarification_card_id: cardId });
}
