import { beforeEach, describe, expect, it, vi } from "vitest";
import { CAPTURE_MIME_TYPE, MAX_CAPTURE_BYTES } from "@/sdk/capture-image";

const { authorize, bucket, upload, rpc, signal } = vi.hoisted(() => ({
  authorize: vi.fn(),
  bucket: vi.fn(),
  upload: vi.fn(),
  rpc: vi.fn(),
  signal: vi.fn(),
}));
vi.mock("@/lib/auth/request-auth", () => ({ findAuthorizedConversation: authorize }));
vi.mock("@/lib/supabase/server-client", () => ({
  RECORDINGS_BUCKET: "recordings",
  getServerSupabase: () => ({ storage: { from: bucket }, rpc }),
}));
vi.mock("@/lib/realtime/send-signal", () => ({ sendConversationSignal: signal }));

const { POST } = await import("@/app/api/messages/capture/route");

const MESSAGE_ID = "fd07d458-f4f6-43c9-835f-b6399fada8c7";
const SOF = [0xff, 0xc0, 0, 11, 8, 0, 16, 0, 32, 1, 1, 0x11, 0];
const JPEG_HEADERS = new Uint8Array([0xff, 0xd8, ...SOF, 0xff, 0xd9]);

function postCapture(bytes = JPEG_HEADERS, mimeType = CAPTURE_MIME_TYPE, caption = "  ") {
  const form = new FormData();
  form.set("messageId", MESSAGE_ID);
  form.set("body", caption);
  form.set("conversationId", "another-conversation");
  form.set("image", new Blob([bytes], { type: mimeType }), "capture.jpg");
  return POST(new Request("https://example.test/api/messages/capture", { method: "POST", body: form }));
}

describe("POST /api/messages/capture", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authorize.mockResolvedValue({ conversationId: "owned", projectId: "project" });
    bucket.mockReturnValue({ upload });
    upload.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: true, error: null });
  });

  it("대화 토큰 없이 파일을 저장할 수 없다", async () => {
    authorize.mockResolvedValue(null);
    expect((await postCapture()).status).toBe(401);
    expect(bucket).not.toHaveBeenCalled();
  });

  it("다른 파일 형식과 JPEG가 아닌 내용을 거부한다", async () => {
    expect((await postCapture(JPEG_HEADERS, "image/png")).status).toBe(400);
    expect((await postCapture(new Uint8Array([0xff, 0xd8, 0xff, 0xff, 0xd9]))).status).toBe(400);
    expect(bucket).not.toHaveBeenCalled();
  });

  it("용량 또는 픽셀 크기를 초과하는 파일을 거부한다", async () => {
    expect((await postCapture(new Uint8Array(MAX_CAPTURE_BYTES + 1))).status).toBe(413);
    const request = new Request("https://example.test/api/messages/capture", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=upload" },
      duplex: "half",
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(MAX_CAPTURE_BYTES + 32_000));
        },
      }),
    } as RequestInit & { duplex: "half" });
    expect((await POST(request)).status).toBe(413);
    const oversizedFrame = JPEG_HEADERS.slice();
    oversizedFrame[9] = 0xff;
    expect((await postCapture(oversizedFrame)).status).toBe(400);
    expect(bucket).not.toHaveBeenCalled();
  });

  it("대화 토큰의 대화에만 설명 없는 캡처도 저장하고 알린다", async () => {
    expect((await postCapture()).status).toBe(201);
    const path = upload.mock.calls[0][0];
    expect(bucket).toHaveBeenCalledWith("recordings");
    expect(path).toMatch(new RegExp(`^captures/owned/${MESSAGE_ID}-[a-f0-9]{64}\\.jpg$`));
    expect(rpc).toHaveBeenCalledWith("insert_capture_message", {
      p_id: MESSAGE_ID, p_conversation_id: "owned", p_body: null, p_path: path,
    });
    expect(signal).toHaveBeenCalledWith("owned", "project", { type: "message.created", id: MESSAGE_ID });
  });

  it("업로드 오류가 나면 대화에 메시지를 만들지 않는다", async () => {
    upload.mockResolvedValue({ error: { statusCode: "503" } });
    expect((await postCapture()).status).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("동일 요청의 재시도를 허용하고 다른 캡처의 ID 재사용은 거부한다", async () => {
    upload.mockResolvedValue({ error: { code: "ResourceAlreadyExists" } });
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await postCapture(JPEG_HEADERS, CAPTURE_MIME_TYPE, "  설명  ")).status).toBe(200);
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_body: "설명" });

    rpc.mockResolvedValue({ data: null, error: null });
    expect((await postCapture()).status).toBe(409);
  });
});
