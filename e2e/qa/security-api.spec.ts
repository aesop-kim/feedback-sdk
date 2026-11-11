import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
// eslint-disable-next-line no-restricted-imports -- @/ 별칭은 src/만 가리켜서 e2e는 상대 경로로 가져온다.
import { createSignedToken } from "../../src/lib/auth/signed-token";
// eslint-disable-next-line no-restricted-imports -- @/ 별칭은 src/만 가리켜서 e2e 도우미는 상대 경로로 가져온다.
import {
  ADMIN_PASSWORD,
  DEMO_URL,
  IS_DEPLOYED,
  SDK_ORIGIN,
  approveCardInDatabase,
  cleanupQaUsers,
  createQaUser,
  getQaDatabase,
  readEnvFile,
  seedAnalyzedRecording,
  startConversationViaApi,
} from "./qa-helpers";

// 보안·API QA: Bearer 토큰, 다른 대화 리소스, CSP frame-ancestors, 관리자 API 쿠키 가드.
test.afterAll(async () => {
  await cleanupQaUsers("qa-sec-");
});

const FORGED_TOKENS = {
  missing: undefined,
  notBearer: "Token abc",
  garbage: "Bearer not-a-token",
  forgedSignature: `Bearer ${Buffer.from(JSON.stringify({ subject: "00000000-0000-0000-0000-000000000000", expiresAt: Date.now() + 1e9 })).toString("base64url")}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
};

for (const [label, authorization] of Object.entries(FORGED_TOKENS)) {
  test(`위젯 API는 ${label} 토큰을 401로 거절한다`, async ({ request }) => {
    const headers = authorization ? { authorization } : undefined;
    const responses = await Promise.all([
      request.get(`${SDK_ORIGIN}/api/messages`, { headers }),
      request.post(`${SDK_ORIGIN}/api/messages`, { headers, data: { body: "x" } }),
      request.post(`${SDK_ORIGIN}/api/recordings`, { headers, data: {} }),
      request.patch(`${SDK_ORIGIN}/api/recordings/00000000-0000-0000-0000-000000000000`, { headers, data: { status: "uploaded" } }),
      request.post(`${SDK_ORIGIN}/api/clarifications/00000000-0000-0000-0000-000000000000/answer`, { headers, data: { optionId: "a" } }),
    ]);
    expect(responses.map((response) => response.status())).toEqual([401, 401, 401, 401, 401]);
  });
}

test("서명은 맞지만 만료된 대화 토큰과 관리자 쿠키는 401", async ({ request, playwright }) => {
  test.skip(IS_DEPLOYED, "운영 서명 비밀값은 QA 러너에 없어서, 만료 토큰은 .env.local의 테스트 비밀값으로 로컬에서만 만든다");
  const secrets = readEnvFile(".env.local");
  const owner = await startConversationViaApi(request, createQaUser("sec-expired"));
  // expiresAt = now + ttl이라 ttl을 음수로 주면 1분 전에 만료된 토큰이 된다.
  const expiredToken = createSignedToken(owner.conversationId, -60_000, secrets.WIDGET_TOKEN_SECRET);
  const freshToken = createSignedToken(owner.conversationId, 60_000, secrets.WIDGET_TOKEN_SECRET);

  const fresh = await request.get(`${SDK_ORIGIN}/api/messages`, { headers: { authorization: `Bearer ${freshToken}` } });
  expect(fresh.status(), "같은 비밀값으로 만든 유효한 토큰은 통과해야 만료 검사가 의미 있다").toBe(200);
  const headers = { authorization: `Bearer ${expiredToken}` };
  const responses = await Promise.all([
    request.get(`${SDK_ORIGIN}/api/messages`, { headers }),
    request.post(`${SDK_ORIGIN}/api/messages`, { headers, data: { body: "x" } }),
    request.post(`${SDK_ORIGIN}/api/recordings`, { headers, data: {} }),
    request.post(`${SDK_ORIGIN}/api/clarifications/00000000-0000-0000-0000-000000000000/answer`, { headers, data: { optionId: "a" } }),
  ]);
  expect(responses.map((response) => response.status())).toEqual([401, 401, 401, 401]);

  const adminStatuses: number[] = [];
  for (const ttlMs of [60_000, -60_000]) {
    const session = createSignedToken("admin", ttlMs, secrets.ADMIN_SESSION_SECRET);
    const adminContext = await playwright.request.newContext({ extraHTTPHeaders: { cookie: `lattice_admin_session=${session}` } });
    adminStatuses.push((await adminContext.get(`${SDK_ORIGIN}/api/admin/conversations`)).status());
    await adminContext.dispose();
  }
  expect(adminStatuses, "유효한 관리자 쿠키는 200, 만료된 쿠키는 401").toEqual([200, 401]);
});

test("다른 대화의 토큰으로 질문 카드에 답하면 404", async ({ request }) => {
  const owner = await startConversationViaApi(request, createQaUser("sec-owner"));
  const intruder = await startConversationViaApi(request, createQaUser("sec-intruder"));
  const seeded = await seedAnalyzedRecording(owner.conversationId);
  await approveCardInDatabase(seeded.cardId!, owner.conversationId);

  const response = await request.post(`${SDK_ORIGIN}/api/clarifications/${seeded.cardId}/answer`, {
    headers: { authorization: `Bearer ${intruder.conversationToken}` },
    data: { optionId: "option-1" },
  });
  expect(response.status()).toBe(404);
});

test("승인 전 질문 카드에는 대화 주인도 답할 수 없다(404)", async ({ request }) => {
  const owner = await startConversationViaApi(request, createQaUser("sec-unapproved"));
  const seeded = await seedAnalyzedRecording(owner.conversationId);
  const response = await request.post(`${SDK_ORIGIN}/api/clarifications/${seeded.cardId}/answer`, {
    headers: { authorization: `Bearer ${owner.conversationToken}` },
    data: { optionId: "option-1" },
  });
  expect(response.status()).toBe(404);
});

test("다른 대화의 이슈를 재확인 녹화로 연결하면 404", async ({ request }) => {
  const owner = await startConversationViaApi(request, createQaUser("sec-reverify-owner"));
  const intruder = await startConversationViaApi(request, createQaUser("sec-reverify-intruder"));
  const seeded = await seedAnalyzedRecording(owner.conversationId, { ambiguous: false });
  const response = await request.post(`${SDK_ORIGIN}/api/recordings`, {
    headers: { authorization: `Bearer ${intruder.conversationToken}` },
    data: {
      pageUrl: DEMO_URL,
      viewport: { width: 1440, height: 900 },
      t0EpochMs: Date.now(),
      durationMs: 1000,
      audioOffsetMs: 0,
      frames: [],
      reverifyIssueId: seeded.issueId,
    },
  });
  expect(response.status()).toBe(404);
});

test("다른 대화의 녹화를 완료 처리해도 바뀌지 않는다", async ({ request }) => {
  const owner = await startConversationViaApi(request, createQaUser("sec-rec-owner"));
  const intruder = await startConversationViaApi(request, createQaUser("sec-rec-intruder"));
  const { data: recording } = await getQaDatabase()
    .from("recordings")
    .insert({ conversation_id: owner.conversationId, status: "uploading", duration_ms: 1000, frames: [] })
    .select("id")
    .single();
  const response = await request.patch(`${SDK_ORIGIN}/api/recordings/${recording!.id}`, {
    headers: { authorization: `Bearer ${intruder.conversationToken}` },
    data: { status: "uploaded" },
  });
  console.log(`[qa] cross-conversation recording PATCH → ${response.status()} ${await response.text()}`);
  const { data: after } = await getQaDatabase().from("recordings").select("status").eq("id", recording!.id).single();
  expect(after?.status).toBe("uploading");
  // 200 changed:false 이지만 404가 더 정확하다(존재 여부를 숨기려면 둘 다 괜찮음) — 상태가 바뀌지 않는 것만 강제한다.
});

// 다시 보내기도 스키마상 녹화 정보가 필요하다. 서버는 recordingId가 있으면 나머지를 무시한다.
function createRetryBody(recordingId: string) {
  return { pageUrl: DEMO_URL, viewport: { width: 1440, height: 900 }, t0EpochMs: Date.now(), durationMs: 1000, audioOffsetMs: 0, frames: [], recordingId };
}

test("업로드 다시 보내기는 그사이 워커가 가져간 녹화를 uploading으로 되돌리지 않는다", async ({ request }) => {
  const owner = await startConversationViaApi(request, createQaUser("sec-retry-race"));
  const headers = { authorization: `Bearer ${owner.conversationToken}` };
  const database = getQaDatabase();
  for (let round = 0; round < 5; round += 1) {
    const { data: recording } = await database
      .from("recordings")
      .insert({ conversation_id: owner.conversationId, status: "uploading", duration_ms: 1000, frames: [] })
      .select("id")
      .single();
    // 다시 보내기와 워커의 가져가기(analyzing, attempt 1)를 동시에 보낸다.
    const [retry] = await Promise.all([
      request.post(`${SDK_ORIGIN}/api/recordings`, { headers, data: createRetryBody(recording!.id) }),
      database.from("recordings").update({ status: "analyzing", analysis_attempt: 1 }).eq("id", recording!.id),
    ]);
    const { data: after } = await database.from("recordings").select("status, analysis_attempt").eq("id", recording!.id).single();
    console.log(`[qa] retry race round ${round} → ${retry.status()} ${JSON.stringify(after)}`);
    expect([200, 409]).toContain(retry.status());
    expect(after).toEqual({ status: "analyzing", analysis_attempt: 1 });
  }
});

test("이미 분석에 넘어간 녹화를 다시 보내면 409이고 상태는 그대로다", async ({ request }) => {
  const owner = await startConversationViaApi(request, createQaUser("sec-retry-taken"));
  const { data: recording } = await getQaDatabase()
    .from("recordings")
    .insert({ conversation_id: owner.conversationId, status: "analyzing", analysis_attempt: 1, duration_ms: 1000, frames: [] })
    .select("id")
    .single();
  const response = await request.post(`${SDK_ORIGIN}/api/recordings`, {
    headers: { authorization: `Bearer ${owner.conversationToken}` },
    data: createRetryBody(recording!.id),
  });
  expect(response.status()).toBe(409);
  const { data: after } = await getQaDatabase().from("recordings").select("status").eq("id", recording!.id).single();
  expect(after?.status).toBe("analyzing");
});

test("같은 질문에 두 번 답하면 두 번째는 409", async ({ request }) => {
  const owner = await startConversationViaApi(request, createQaUser("sec-409"));
  const seeded = await seedAnalyzedRecording(owner.conversationId);
  await approveCardInDatabase(seeded.cardId!, owner.conversationId);
  const headers = { authorization: `Bearer ${owner.conversationToken}` };
  const first = await request.post(`${SDK_ORIGIN}/api/clarifications/${seeded.cardId}/answer`, { headers, data: { optionId: "option-1" } });
  const second = await request.post(`${SDK_ORIGIN}/api/clarifications/${seeded.cardId}/answer`, { headers, data: { optionId: "option-2" } });
  expect([first.status(), second.status()]).toEqual([200, 409]);
});

test("같은 질문에 동시에 두 번 답해도 답변은 하나만 저장된다", async ({ request }) => {
  const owner = await startConversationViaApi(request, createQaUser("sec-race"));
  const seeded = await seedAnalyzedRecording(owner.conversationId);
  await approveCardInDatabase(seeded.cardId!, owner.conversationId);
  const headers = { authorization: `Bearer ${owner.conversationToken}` };
  const responses = await Promise.all(
    ["option-1", "option-2", "option-1", "option-2"].map((optionId) =>
      request.post(`${SDK_ORIGIN}/api/clarifications/${seeded.cardId}/answer`, { headers, data: { optionId } }),
    ),
  );
  const statuses = responses.map((response) => response.status());
  const { count: answerCount } = await getQaDatabase()
    .from("clarification_answers")
    .select("id", { count: "exact", head: true })
    .eq("card_id", seeded.cardId);
  const { count: messageCount } = await getQaDatabase()
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", owner.conversationId)
    .eq("type", "text");
  console.log(`[qa] concurrent answers statuses=${JSON.stringify(statuses)} answers=${answerCount} textMessages=${messageCount}`);
  expect(answerCount).toBe(1);
  expect(messageCount).toBe(1);
});

test("허용되지 않은 hostOrigin으로는 대화를 열 수 없다(403)", async ({ request }) => {
  const response = await request.post(`${SDK_ORIGIN}/api/conversations`, {
    data: { projectKey: "lattice-demo", hostOrigin: "https://evil.example", user: createQaUser("sec-origin") },
  });
  expect(response.status()).toBe(403);
});

test("위젯 iframe CSP는 허용된 사이트만 frame-ancestors로 연다", async ({ request }) => {
  const allowed = await request.get(`${SDK_ORIGIN}/widget?projectKey=lattice-demo`);
  const unknown = await request.get(`${SDK_ORIGIN}/widget?projectKey=does-not-exist`);
  const missing = await request.get(`${SDK_ORIGIN}/widget`);
  const allowedCsp = allowed.headers()["content-security-policy"] ?? "";
  console.log(`[qa] widget CSP (${IS_DEPLOYED ? "deployed" : "local"}): ${allowedCsp}`);
  expect(allowedCsp).toContain("frame-ancestors");
  expect(allowedCsp).toContain(new URL(DEMO_URL).origin);
  expect(unknown.headers()["content-security-policy"]).toBe("frame-ancestors 'none'");
  expect(missing.headers()["content-security-policy"]).toBe("frame-ancestors 'none'");
  if (IS_DEPLOYED) {
    // 운영 허용 목록에 개발용 localhost가 남아 있으면 안 된다.
    expect(allowedCsp, "운영 CSP에 localhost가 허용돼 있다").not.toContain("localhost");
  }
});

test("허용되지 않은 사이트에 넣은 위젯 iframe은 브라우저가 막는다", async ({ page }) => {
  // 허용 목록에 없는 origin에서 iframe으로 띄운다. 로컬은 127.0.0.1:3005에 직접 띄우고, 배포는 example.com을 route로 흉내 낸다.
  const hostHtml = `<!doctype html><title>not-allowed</title><iframe id="w" src="${SDK_ORIGIN}/widget?projectKey=lattice-demo"></iframe>`;
  const blocked: string[] = [];
  page.on("console", (message) => {
    if (/frame-ancestors|Refused to frame/i.test(message.text())) {
      blocked.push(message.text());
    }
  });
  let server: Server | null = null;
  const hostUrl = IS_DEPLOYED ? "https://example.com/" : "http://127.0.0.1:3005/";
  if (IS_DEPLOYED) {
    await page.route(hostUrl, (route) => route.fulfill({ contentType: "text/html", body: hostHtml }));
  } else {
    server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(hostHtml);
    });
    await new Promise<void>((resolve) => server!.listen(3005, "127.0.0.1", resolve));
  }
  try {
    await page.goto(hostUrl);
    await page.waitForTimeout(3_000);
    const frame = page.frames().find((candidate) => candidate.url().includes("/widget"));
    const renderedLength = frame ? await frame.evaluate(() => document.body?.innerHTML.length ?? 0).catch(() => 0) : 0;
    console.log(`[qa] blocked messages: ${blocked.length}, rendered length: ${renderedLength}`);
    expect(blocked.length).toBeGreaterThan(0);
  } finally {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  }
});

test("관리자 API는 쿠키가 없거나 위조되면 401", async ({ playwright }) => {
  for (const cookie of [undefined, "lattice_admin_session=forged.value", "lattice_admin_session=eyJzdWJqZWN0IjoiYWRtaW4iLCJleHBpcmVzQXQiOjk5OTk5OTk5OTk5OTl9.AAAA"]) {
    const context = await playwright.request.newContext({ extraHTTPHeaders: cookie ? { cookie } : {} });
    const id = "00000000-0000-0000-0000-000000000000";
    const responses = await Promise.all([
      context.get(`${SDK_ORIGIN}/api/admin/conversations`),
      context.get(`${SDK_ORIGIN}/api/admin/conversations/${id}`),
      context.post(`${SDK_ORIGIN}/api/admin/conversations/${id}/messages`, { data: { body: "x" } }),
      context.patch(`${SDK_ORIGIN}/api/admin/issues/${id}`, { data: { status: "resolved" } }),
      context.post(`${SDK_ORIGIN}/api/admin/clarifications/${id}/approve`, { data: {} }),
      context.post(`${SDK_ORIGIN}/api/admin/recordings/${id}/reanalyze`),
    ]);
    expect(responses.map((response) => response.status()), `cookie=${cookie ?? "none"}`).toEqual([401, 401, 401, 401, 401, 401]);
    await context.dispose();
  }
});

test("관리자 화면을 쿠키 없이 열면 로그인으로 보낸다", async ({ page }) => {
  await page.goto(`${SDK_ORIGIN}/admin`);
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto(`${SDK_ORIGIN}/admin/00000000-0000-0000-0000-000000000000`);
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("위조된 관리자 쿠키로 화면을 열면 결국 로그인으로 보낸다", async ({ page, context }) => {
  await context.addCookies([{ name: "lattice_admin_session", value: "forged.value", url: SDK_ORIGIN }]);
  await page.goto(`${SDK_ORIGIN}/admin`);
  await expect(page).toHaveURL(/\/admin\/login$/, { timeout: 10_000 });
});

// 제한은 IP(x-forwarded-for)별이다. 로컬에는 프록시가 없어 모든 요청이 한 덩어리("unknown")로 세어지므로,
// 이 테스트만의 IP를 붙인다. 그러지 않으면 5분 동안 뒤 스펙의 loginAdmin이 모두 429로 막힌다.
test("관리자 비밀번호를 연속으로 틀리면 그 IP만 시도 제한(429)이 걸린다", async ({ request }) => {
  test.skip(IS_DEPLOYED, "Vercel은 x-forwarded-for를 실제 IP로 덮어써서, 배포에서는 QA 러너의 IP가 5분 동안 막힌다");
  const testIp = `198.51.100.${Math.floor(Math.random() * 254) + 1}`;
  const statuses: number[] = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await request.post(`${SDK_ORIGIN}/api/admin/session`, {
      headers: { "x-forwarded-for": testIp },
      data: { password: `wrong-${attempt}` },
    });
    statuses.push(response.status());
  }
  console.log(`[qa] 6 wrong logins → ${JSON.stringify(statuses)}`);
  expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);
  const blockedLogin = await request.post(`${SDK_ORIGIN}/api/admin/session`, {
    headers: { "x-forwarded-for": testIp },
    data: { password: ADMIN_PASSWORD },
  });
  expect(blockedLogin.status(), "막힌 IP는 맞는 비밀번호도 잠시 받지 않는다").toBe(429);
  const otherIpLogin = await request.post(`${SDK_ORIGIN}/api/admin/session`, { data: { password: ADMIN_PASSWORD } });
  expect(otherIpLogin.status(), "다른 IP의 로그인은 막히지 않는다").toBe(200);
});
