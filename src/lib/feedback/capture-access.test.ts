import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "@/lib/testing/fake-supabase";

vi.mock("server-only", () => ({}));

const { client, signPaths } = vi.hoisted(() => ({ client: { current: null as unknown }, signPaths: vi.fn() }));
vi.mock("@/lib/supabase/server-client", () => ({
  RECORDINGS_BUCKET: "recordings",
  getServerSupabase: () => client.current,
}));

const { getConversationMessages } = await import("@/lib/feedback/feedback-repository");

const firstDevice = "a".repeat(64);
const secondDevice = "b".repeat(64);

describe("캡처 이미지 열람 권한", () => {
  beforeEach(() => {
    signPaths.mockReset();
    signPaths.mockImplementation(async (paths: string[]) => ({
      data: paths.map((path) => ({ path, signedUrl: `https://storage.example.test/${path}` })),
    }));

    const captures = [firstDevice, secondDevice, null].map((key, index) => ({
      id: `message-${index}`,
      type: "capture",
      sender: "user",
      capture_path: `captures/${index}.jpg`,
      capture_device_hash: key,
    }));
    const fake = createFakeSupabase({ messages: [{ data: captures }] });
    client.current = { ...fake, storage: { from: () => ({ createSignedUrls: signPaths }) } };
  });

  it("보낸 브라우저에서 그 브라우저의 캡처만 열 수 있다", async () => {
    const messages = await getConversationMessages("conversation", "widget", firstDevice);
    expect(signPaths).toHaveBeenCalledWith(["captures/0.jpg"], 3600);
    expect(messages.map((message) => message.captureUrl)).toEqual([
      "https://storage.example.test/captures/0.jpg", undefined, undefined,
    ]);
  });

  it("브라우저 키가 없으면 URL을 발급하지 않는다", async () => {
    const messages = await getConversationMessages("conversation", "widget");
    expect(signPaths).not.toHaveBeenCalled();
    expect(messages.every((message) => !("captureUrl" in message))).toBe(true);
  });

  it("관리자는 기존 캡처를 포함해 대화의 모든 캡처를 볼 수 있다", async () => {
    const messages = await getConversationMessages("conversation", "admin");
    expect(messages.every((message) => message.captureUrl)).toBe(true);
  });
});
