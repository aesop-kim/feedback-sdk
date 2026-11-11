// 녹화 결과를 서버가 발급한 signed upload URL로 올리고, 끝나면 status='uploaded'로 표시한다.
import { getFramePath } from "@/lib/recording/frame-capturer";
import type { CaptureResult } from "@/lib/recording/capture-session";
import { getBrowserSupabase } from "@/lib/supabase/browser-client";
import type { ElementContext } from "@/types/feedback";

const RECORDINGS_BUCKET = "recordings";
const UPLOAD_CONCURRENCY = 6;
const UPLOAD_ATTEMPTS = 2;
const ALREADY_UPLOADED_STATUS = 409;

type UploadTarget = { path: string; token: string; signedUrl: string };

type CreateRecordingResponse = {
  recordingId: string;
  uploads: { video: UploadTarget; audio: UploadTarget; events: UploadTarget; frames: UploadTarget[] };
};

export type RecordedContext = { epochMs: number; context: ElementContext; kind: "click" | "hover" };

export type UploadRecordingInput = {
  conversationToken: string;
  capture: CaptureResult;
  page: { url: string; title: string };
  viewport: { width: number; height: number };
  rrwebEvents: unknown[];
  contexts: RecordedContext[];
  // "다시 보내기"면 앞선 시도의 녹화 id. 서버는 새로 만들지 않고 업로드 주소만 다시 발급한다.
  recordingId?: string | null;
  onProgress?: (progress: number) => void;
};

export type UploadTask = { path: string; token: string; blob: Blob; contentType: string };

export class RecordingUploadError extends Error {
  constructor(
    message: string,
    readonly recordingId: string | null,
  ) {
    super(message);
    this.name = "RecordingUploadError";
  }
}

export class RecordingRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RecordingRequestError";
  }
}

// 다시 보내기에 409("이미 보낸 녹화예요")가 오면 앞선 시도가 끝까지 올라간 것이므로 성공으로 본다.
export function isAlreadyUploadedError(error: unknown, recordingId: string | null | undefined): boolean {
  return Boolean(recordingId) && error instanceof RecordingRequestError && error.status === ALREADY_UPLOADED_STATUS;
}

async function requestWidgetJson<TResponse>(conversationToken: string, path: string, init: RequestInit): Promise<TResponse> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${conversationToken}` },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new RecordingRequestError(body?.error ?? `요청 실패 (${response.status})`, response.status);
  }
  return (await response.json()) as TResponse;
}

// 각 작업을 최대 attempts번 시도하며 limit개씩 동시에 돌린다. 하나라도 끝내 실패하면 reject.
export async function runWithConcurrency<TTask>(
  tasks: TTask[],
  limit: number,
  attempts: number,
  runTask: (task: TTask) => Promise<void>,
  onTaskDone?: (task: TTask) => void,
): Promise<void> {
  let nextIndex = 0;
  const runTaskWithRetry = async (task: TTask) => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        await runTask(task);
        onTaskDone?.(task);
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  };
  const worker = async () => {
    while (nextIndex < tasks.length) {
      const task = tasks[nextIndex];
      nextIndex += 1;
      await runTaskWithRetry(task);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
}

export function getUploadProgress(doneBytes: number, totalBytes: number): number {
  if (totalBytes <= 0) {
    return 1;
  }
  return Math.min(1, doneBytes / totalBytes);
}

async function uploadFile(task: UploadTask): Promise<void> {
  const { error } = await getBrowserSupabase()
    .storage.from(RECORDINGS_BUCKET)
    .uploadToSignedUrl(task.path, task.token, task.blob, { contentType: task.contentType });
  // 재시도 때 앞선 시도가 이미 올라갔으면 "이미 있음"이 오는데, 그건 성공으로 본다.
  if (error && !/exists|duplicate/i.test(error.message)) {
    throw error;
  }
}

export async function uploadRecording(input: UploadRecordingInput): Promise<{ recordingId: string }> {
  const { conversationToken, capture, page, viewport, rrwebEvents, contexts, recordingId, onProgress } = input;
  let created: CreateRecordingResponse;
  try {
    created = await requestWidgetJson<CreateRecordingResponse>(conversationToken, "/api/recordings", {
      method: "POST",
      body: JSON.stringify({
        pageUrl: page.url,
        pageTitle: page.title || undefined,
        viewport,
        t0EpochMs: Math.round(capture.t0),
        durationMs: Math.round(capture.durationMs),
        audioOffsetMs: Math.round(capture.audioOffsetMs),
        frames: capture.frames.map((frame) => ({ tMs: frame.tMs, reason: frame.reason })),
        recordingId: recordingId ?? undefined,
      }),
    });
  } catch (error) {
    if (recordingId && isAlreadyUploadedError(error, recordingId)) {
      onProgress?.(1);
      return { recordingId };
    }
    throw new RecordingUploadError(error instanceof Error ? error.message : "업로드 준비 실패", recordingId ?? null);
  }

  const eventsBlob = new Blob([JSON.stringify({ t0: capture.t0, rrwebEvents, contexts })], { type: "application/json" });
  const framesByPath = new Map(capture.frames.map((frame) => [getFramePath(frame), frame]));
  const tasks: UploadTask[] = [
    { ...created.uploads.video, blob: capture.videoBlob, contentType: "video/webm" },
    { ...created.uploads.audio, blob: capture.audioBlob, contentType: "audio/webm" },
    { ...created.uploads.events, blob: eventsBlob, contentType: "application/json" },
  ];
  for (const target of created.uploads.frames) {
    const frame = framesByPath.get(target.path.slice(target.path.indexOf("/") + 1));
    if (frame) {
      tasks.push({ ...target, blob: frame.blob, contentType: "image/jpeg" });
    }
  }

  const totalBytes = tasks.reduce((sum, task) => sum + task.blob.size, 0);
  let doneBytes = 0;
  onProgress?.(0);
  try {
    await runWithConcurrency(tasks, UPLOAD_CONCURRENCY, UPLOAD_ATTEMPTS, uploadFile, (task) => {
      doneBytes += task.blob.size;
      onProgress?.(getUploadProgress(doneBytes, totalBytes));
    });
    await requestWidgetJson(conversationToken, `/api/recordings/${created.recordingId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "uploaded" }),
    });
  } catch (error) {
    throw new RecordingUploadError(error instanceof Error ? error.message : "업로드 실패", created.recordingId);
  }
  onProgress?.(1);
  return { recordingId: created.recordingId };
}
