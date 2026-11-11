import { afterEach, describe, expect, it, vi } from "vitest";
import type { CaptureResult } from "@/lib/recording/capture-session";
import {
  RecordingRequestError,
  RecordingUploadError,
  getUploadProgress,
  isAlreadyUploadedError,
  runWithConcurrency,
  uploadRecording,
} from "@/lib/recording/upload-recording";

describe("upload-recording", () => {
  it("동시에 limit개까지만 돌린다", async () => {
    let running = 0;
    let maxRunning = 0;
    const tasks = Array.from({ length: 20 }, (_, index) => index);
    await runWithConcurrency(tasks, 6, 1, async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
    });
    expect(maxRunning).toBe(6);
  });

  it("실패한 작업은 한 번 더 시도한다", async () => {
    const attemptsByTask = new Map<string, number>();
    const done: string[] = [];
    await runWithConcurrency(
      ["video", "audio"],
      6,
      2,
      async (task) => {
        const attempts = (attemptsByTask.get(task) ?? 0) + 1;
        attemptsByTask.set(task, attempts);
        if (task === "video" && attempts === 1) {
          throw new Error("일시적 실패");
        }
      },
      (task) => done.push(task),
    );
    expect(attemptsByTask.get("video")).toBe(2);
    expect(attemptsByTask.get("audio")).toBe(1);
    expect(done.sort()).toEqual(["audio", "video"]);
  });

  it("두 번 다 실패하면 reject한다", async () => {
    let attempts = 0;
    await expect(
      runWithConcurrency(["video"], 6, 2, async () => {
        attempts += 1;
        throw new Error("계속 실패");
      }),
    ).rejects.toThrow("계속 실패");
    expect(attempts).toBe(2);
  });

  it("진행률은 0..1 사이다", () => {
    expect(getUploadProgress(0, 100)).toBe(0);
    expect(getUploadProgress(62, 100)).toBe(0.62);
    expect(getUploadProgress(150, 100)).toBe(1);
    expect(getUploadProgress(0, 0)).toBe(1);
  });
});

describe("다시 보내기", () => {
  const capture: CaptureResult = {
    videoBlob: new Blob(["v"]),
    audioBlob: new Blob(["a"]),
    frames: [],
    t0: 1_700_000_000_000,
    audioOffsetMs: 0,
    durationMs: 3_000,
  };
  const baseInput = {
    conversationToken: "token",
    capture,
    page: { url: "https://example.com", title: "" },
    viewport: { width: 1280, height: 800 },
    rrwebEvents: [],
    contexts: [],
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("앞선 녹화 id를 같은 본문에 실어 보내고, 409면 이미 올라간 것으로 본다", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "이미 보낸 녹화예요." }), { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(uploadRecording({ ...baseInput, recordingId: "rec-1" })).resolves.toEqual({ recordingId: "rec-1" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ recordingId: "rec-1", durationMs: 3_000 });
  });

  it("처음 보낼 때는 recordingId를 싣지 않고, 실패하면 RecordingUploadError", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "업로드를 준비하지 못했어요." }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(uploadRecording(baseInput)).rejects.toBeInstanceOf(RecordingUploadError);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).not.toHaveProperty("recordingId");
  });

  it("409는 다시 보낼 때만 성공으로 본다", () => {
    expect(isAlreadyUploadedError(new RecordingRequestError("이미 보낸 녹화예요.", 409), "rec-1")).toBe(true);
    expect(isAlreadyUploadedError(new RecordingRequestError("이미 보낸 녹화예요.", 409), null)).toBe(false);
    expect(isAlreadyUploadedError(new RecordingRequestError("실패", 500), "rec-1")).toBe(false);
  });
});
