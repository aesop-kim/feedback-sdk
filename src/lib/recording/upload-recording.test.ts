import { describe, expect, it } from "vitest";
import { getUploadProgress, runWithConcurrency } from "@/lib/recording/upload-recording";

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
