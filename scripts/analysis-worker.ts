// 로컬 분석 워커: 업로드된 녹화를 집어 받아쓰기(whisper.cpp) → 컨텍스트 → claude -p 분석 → 이슈 저장까지 한다.
// 사용: npm run worker [-- --once] [-- --recording <id>] [-- --keep]
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { extractElementContexts, shiftTranscript, type TimedElementContext } from "@/lib/analysis/align-timeline";
import { buildAnalysisContext, type AnalysisContext, type FrameReference } from "@/lib/analysis/build-analysis-context";
import { buildAnalysisPrompt } from "@/lib/analysis/build-analysis-prompt";
import { analysisResultSchema, getAnalysisJsonSchema, type AnalysisIssue } from "@/lib/analysis/issue-schema";
import { mapIssuesToRows } from "@/lib/analysis/map-issues-to-rows";
import { findMeanVolumeDb, isSilentAudio } from "@/lib/analysis/detect-silence";
import { parseWhisperJson, type ParsedTranscript } from "@/lib/analysis/parse-whisper-json";
import { getAdminChannelName, getConversationChannelName } from "@/lib/realtime/realtime-signal";
import { sendChannelSignal } from "@/lib/realtime/send-channel-signal";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const TEMPORARY_ROOT = path.join(PROJECT_ROOT, ".worker-tmp");
const RECORDINGS_BUCKET = "recordings";
const POLL_INTERVAL_MS = 3_000;
const CLAUDE_TIMEOUT_MS = 240_000;
const WHISPER_TIMEOUT_MS = 300_000;
const WHISPER_MODEL_PATH = path.join(homedir(), ".cache/whisper-cpp/ggml-large-v3-turbo.bin");
const MAX_ERROR_LENGTH = 1_000;
const STALE_UPLOAD_MINUTES = 30;
const STALE_UPLOAD_CHECK_INTERVAL_MS = 60_000;

type Stage = "load" | "download" | "transcribe" | "analyze" | "save";

const STAGE_ERROR_MESSAGES: Record<Stage, string> = {
  load: "녹화 정보를 불러오지 못했어요",
  download: "녹화 파일을 내려받지 못했어요",
  transcribe: "음성을 받아쓰지 못했어요",
  analyze: "이슈를 분석하지 못했어요",
  save: "분석 결과를 저장하지 못했어요",
};

type RecordingRow = {
  id: string;
  conversation_id: string;
  page_url: string | null;
  page_title: string | null;
  viewport: { width: number; height: number } | null;
  t0_epoch_ms: number | null;
  audio_offset_ms: number;
  frames: FrameReference[] | null;
};

type ClaimedRecording = { id: string; attempt: number };

type CommandResult = { stdout: string; stderr: string };

class StageError extends Error {
  constructor(
    readonly stage: Stage,
    readonly detail: string,
  ) {
    super(`${STAGE_ERROR_MESSAGES[stage]}: ${detail}`);
  }
}

function getErrorDetail(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function runStage<TResult>(stage: Stage, task: () => Promise<TResult>): Promise<TResult> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof StageError) {
      throw error;
    }
    throw new StageError(stage, getErrorDetail(error));
  }
}

function runCommand(
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs: number; input?: string },
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      command,
      args,
      { cwd: options.cwd, timeout: options.timeoutMs, maxBuffer: 50 * 1024 * 1024, encoding: "utf8" },
      (error, stdout, stderr) => {
        if (error) {
          const tail = (stderr || stdout).trim().split("\n").slice(-3).join(" / ");
          reject(new Error(`${command} 실패(${error.killed ? "시간 초과" : `code ${error.code}`}) ${tail}`.trim()));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
    child.stdin?.end(options.input ?? "");
  });
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

async function measure<TResult>(task: () => Promise<TResult>): Promise<{ result: TResult; elapsedMs: number }> {
  const startedAt = performance.now();
  const result = await task();
  return { result, elapsedMs: performance.now() - startedAt };
}

function createWorkerSupabase(): SupabaseClient {
  process.loadEnvFile(path.join(PROJECT_ROOT, ".env.local"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(".env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 필요해요.");
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function claimNextRecording(supabase: SupabaseClient): Promise<ClaimedRecording | null> {
  const { data, error } = await supabase.rpc("claim_next_recording");
  if (error) {
    throw new Error(`claim_next_recording 실패: ${error.message}`);
  }
  const row = (data as ClaimedRecording[] | null)?.[0];
  return row ?? null;
}

type ExpiredUpload = { id: string; conversation_id: string; project_id: string };

// 업로드 중에 고객이 떠나 30분 넘게 'uploading'에 머문 녹화를 failed로 바꾸고 화면들에 알린다.
async function expireStaleUploads(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase.rpc("expire_stale_uploads", { p_stale_minutes: STALE_UPLOAD_MINUTES });
  if (error) {
    throw new Error(`expire_stale_uploads 실패: ${error.message}`);
  }
  const expired = (data as ExpiredUpload[] | null) ?? [];
  await Promise.all(
    expired.flatMap((recording) => {
      console.warn(`[worker] ${recording.id} 업로드가 ${STALE_UPLOAD_MINUTES}분 넘게 끝나지 않아 실패로 바꿨어요`);
      const signal = { type: "recording.updated", id: recording.id } as const;
      return [
        sendChannelSignal(supabase, getConversationChannelName(recording.conversation_id), signal, "[worker]"),
        sendChannelSignal(supabase, getAdminChannelName(recording.project_id), signal, "[worker]"),
      ];
    }),
  );
}

// 디버그용: 상태와 무관하게 지정한 녹화를 다시 집는다.
async function claimSpecificRecording(supabase: SupabaseClient, recordingId: string): Promise<ClaimedRecording> {
  const { data: current, error: readError } = await supabase
    .from("recordings")
    .select("analysis_attempt")
    .eq("id", recordingId)
    .single();
  if (readError || !current) {
    throw new Error(`녹화 ${recordingId}를 찾지 못했어요: ${readError?.message ?? "없음"}`);
  }
  const attempt = (current.analysis_attempt as number) + 1;
  const { error } = await supabase
    .from("recordings")
    .update({ status: "analyzing", analysis_started_at: new Date().toISOString(), analysis_attempt: attempt, error: null })
    .eq("id", recordingId);
  if (error) {
    throw new Error(`녹화 ${recordingId}를 집지 못했어요: ${error.message}`);
  }
  return { id: recordingId, attempt };
}

async function downloadObject(supabase: SupabaseClient, objectPath: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(RECORDINGS_BUCKET).download(objectPath);
  if (error || !data) {
    throw new Error(`${objectPath} 다운로드 실패: ${error?.message ?? "빈 응답"}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

async function downloadInputs(supabase: SupabaseClient, recording: RecordingRow, workDirectory: string) {
  const framesDirectory = path.join(workDirectory, "frames");
  await mkdir(framesDirectory, { recursive: true });
  const audioPath = path.join(workDirectory, "audio.webm");
  await writeFile(audioPath, await downloadObject(supabase, `${recording.id}/audio.webm`));

  let events: unknown = [];
  try {
    events = JSON.parse((await downloadObject(supabase, `${recording.id}/events.json`)).toString("utf8"));
  } catch (error) {
    console.warn(`[worker] ${recording.id} events.json 없이 진행해요: ${getErrorDetail(error)}`);
  }

  const frames: FrameReference[] = [];
  await Promise.all(
    (recording.frames ?? []).map(async (frame) => {
      try {
        const fileName = path.basename(frame.path);
        await writeFile(path.join(framesDirectory, fileName), await downloadObject(supabase, `${recording.id}/${frame.path}`));
        frames.push(frame);
      } catch (error) {
        console.warn(`[worker] ${recording.id} 프레임 건너뜀: ${getErrorDetail(error)}`);
      }
    }),
  );
  frames.sort((left, right) => left.tMs - right.tMs);
  return { audioPath, framesDirectory, events, frames };
}

async function transcribe(audioPath: string, workDirectory: string): Promise<ParsedTranscript> {
  const wavPath = path.join(workDirectory, "audio.wav");
  const outputPrefix = path.join(workDirectory, "transcript");
  await runCommand("ffmpeg", ["-loglevel", "error", "-y", "-i", audioPath, "-ar", "16000", "-ac", "1", wavPath], {
    timeoutMs: WHISPER_TIMEOUT_MS,
  });
  const volume = await runCommand("ffmpeg", ["-hide_banner", "-i", wavPath, "-af", "volumedetect", "-f", "null", "-"], {
    timeoutMs: WHISPER_TIMEOUT_MS,
  });
  if (isSilentAudio(findMeanVolumeDb(volume.stderr))) {
    throw new Error("목소리가 녹음되지 않았어요. 크롬에서 고른 마이크를 확인해 주세요");
  }
  await runCommand(
    "whisper-cli",
    ["-m", WHISPER_MODEL_PATH, "-l", "ko", "-ojf", "-of", outputPrefix, "-np", "-f", wavPath],
    { timeoutMs: WHISPER_TIMEOUT_MS },
  );
  return parseWhisperJson(await readFile(`${outputPrefix}.json`));
}

type ClaudeOutput = { is_error?: boolean; result?: string; structured_output?: unknown; subtype?: string };

function getClaudeArgs(framesDirectory: string): string[] {
  return [
    "-p",
    "--model",
    "sonnet",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(getAnalysisJsonSchema()),
    "--add-dir",
    framesDirectory,
    "--tools",
    "Read",
    "--allowedTools",
    "Read",
    "--permission-mode",
    "dontAsk",
    "--no-session-persistence",
  ];
}

function readStructuredOutput(stdout: string): unknown {
  const output = JSON.parse(stdout) as ClaudeOutput;
  if (output.is_error) {
    throw new Error(`claude 오류(${output.subtype ?? "unknown"}): ${(output.result ?? "").slice(0, 300)}`);
  }
  if (output.structured_output !== undefined) {
    return output.structured_output;
  }
  return JSON.parse(output.result ?? "");
}

async function analyzeWithClaude(input: {
  context: AnalysisContext;
  framesDirectory: string;
  workDirectory: string;
  recording: RecordingRow;
}): Promise<AnalysisIssue[]> {
  let retryReason: string | undefined;
  for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
    const prompt = buildAnalysisPrompt({
      context: input.context,
      framesDirectory: input.framesDirectory,
      pageUrl: input.recording.page_url,
      pageTitle: input.recording.page_title,
      viewport: input.recording.viewport,
      retryReason,
    });
    const { stdout } = await runCommand("claude", getClaudeArgs(input.framesDirectory), {
      cwd: input.workDirectory,
      timeoutMs: CLAUDE_TIMEOUT_MS,
      input: prompt,
    });
    let candidate: unknown;
    try {
      candidate = readStructuredOutput(stdout);
    } catch (error) {
      retryReason = getErrorDetail(error);
      continue;
    }
    const parsed = analysisResultSchema.safeParse(candidate);
    if (parsed.success) {
      return parsed.data.issues;
    }
    retryReason = parsed.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
  }
  throw new Error(`응답 형식 검증 실패(재시도 포함): ${retryReason}`);
}

async function loadRecording(supabase: SupabaseClient, recordingId: string): Promise<{ recording: RecordingRow; projectId: string }> {
  const { data, error } = await supabase
    .from("recordings")
    .select("id, conversation_id, page_url, page_title, viewport, t0_epoch_ms, audio_offset_ms, frames, conversations(project_id)")
    .eq("id", recordingId)
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "녹화가 없어요");
  }
  const conversation = data.conversations as unknown as { project_id: string } | null;
  if (!conversation) {
    throw new Error("대화를 찾지 못했어요");
  }
  return { recording: data as unknown as RecordingRow, projectId: conversation.project_id };
}

async function markFailed(supabase: SupabaseClient, claimed: ClaimedRecording, message: string): Promise<void> {
  const { error } = await supabase
    .from("recordings")
    .update({ status: "failed", error: message.slice(0, MAX_ERROR_LENGTH) })
    .eq("id", claimed.id)
    .eq("analysis_attempt", claimed.attempt);
  if (error) {
    console.error(`[worker] ${claimed.id} 실패 상태 저장도 실패: ${error.message}`);
  }
}

async function processRecording(
  supabase: SupabaseClient,
  claimed: ClaimedRecording,
  options: { keep: boolean },
): Promise<void> {
  const workDirectory = path.join(TEMPORARY_ROOT, claimed.id);
  let conversationId: string | null = null;
  let projectId: string | null = null;
  const timings: string[] = [];
  console.log(`[worker] ${claimed.id} 분석 시작 (attempt ${claimed.attempt})`);
  try {
    const loaded = await runStage("load", () => loadRecording(supabase, claimed.id));
    const { recording } = loaded;
    conversationId = recording.conversation_id;
    projectId = loaded.projectId;

    await rm(workDirectory, { recursive: true, force: true });
    const download = await measure(() => runStage("download", () => downloadInputs(supabase, recording, workDirectory)));
    timings.push(`내려받기 ${formatSeconds(download.elapsedMs)}`);
    const { audioPath, framesDirectory, events, frames } = download.result;

    const transcription = await measure(() => runStage("transcribe", () => transcribe(audioPath, workDirectory)));
    timings.push(`받아쓰기 ${formatSeconds(transcription.elapsedMs)}`);
    const transcript = shiftTranscript(transcription.result, recording.audio_offset_ms ?? 0);

    let contexts: TimedElementContext[] = [];
    if (recording.t0_epoch_ms !== null) {
      contexts = extractElementContexts(events, Number(recording.t0_epoch_ms));
    }
    const context = buildAnalysisContext({ segments: transcript.segments, contexts, frames });

    let issues: AnalysisIssue[] = [];
    if (context.segments.length > 0) {
      const analysis = await measure(() =>
        runStage("analyze", () => analyzeWithClaude({ context, framesDirectory, workDirectory, recording })),
      );
      timings.push(`분석 ${formatSeconds(analysis.elapsedMs)}`);
      issues = analysis.result;
    } else {
      timings.push("분석 건너뜀(말 없음)");
    }

    const rows = mapIssuesToRows({ recordingId: claimed.id, issues, contexts, frames });
    await runStage("save", async () => {
      const { error } = await supabase.rpc("replace_recording_issues", {
        p_recording_id: claimed.id,
        p_attempt: claimed.attempt,
        p_transcript: { segments: transcript.segments, words: transcript.words },
        p_issues: rows,
      });
      if (error) {
        throw new Error(error.message);
      }
    });
    timings.push(`이슈 ${rows.length}건`);
    console.log(`[worker] ${claimed.id} ${timings.join(" · ")} (세그먼트 ${transcript.segments.length}, 컨텍스트 ${contexts.length}, 장면 ${context.frames.length}/${frames.length})`);
  } catch (error) {
    const message = error instanceof StageError ? error.message : `분석 중 오류가 났어요: ${getErrorDetail(error)}`;
    if (message.includes("approved clarification cards")) {
      // 고객에게 이미 질문을 보낸 녹화는 결과를 바꾸지 않는다. 기존 이슈를 그대로 두고 analyzed로 돌린다.
      console.warn(`[worker] ${claimed.id} 이미 고객에게 질문을 보낸 녹화라 기존 결과를 유지해요`);
      await supabase.from("recordings").update({ status: "analyzed" }).eq("id", claimed.id).eq("analysis_attempt", claimed.attempt);
      return;
    }
    console.error(`[worker] ${claimed.id} 실패 · ${[...timings, message].join(" · ")}`);
    await markFailed(supabase, claimed, message);
  } finally {
    const signal = { type: "recording.updated", id: claimed.id } as const;
    const signals: Promise<void>[] = [];
    if (conversationId) {
      signals.push(sendChannelSignal(supabase, getConversationChannelName(conversationId), signal, "[worker]"));
    }
    if (projectId) {
      signals.push(sendChannelSignal(supabase, getAdminChannelName(projectId), signal, "[worker]"));
    }
    await Promise.all(signals);
    if (!options.keep) {
      await rm(workDirectory, { recursive: true, force: true });
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      once: { type: "boolean", default: false },
      recording: { type: "string" },
      keep: { type: "boolean", default: false },
    },
  });
  const supabase = createWorkerSupabase();
  const options = { keep: values.keep ?? false };

  if (values.recording) {
    await processRecording(supabase, await claimSpecificRecording(supabase, values.recording), options);
    return;
  }

  console.log(`[worker] 대기 중 (${POLL_INTERVAL_MS / 1000}초마다 확인${values.once ? ", 한 건만" : ""})`);
  let lastStaleUploadCheckAt = 0;
  for (;;) {
    if (Date.now() - lastStaleUploadCheckAt >= STALE_UPLOAD_CHECK_INTERVAL_MS) {
      lastStaleUploadCheckAt = Date.now();
      try {
        await expireStaleUploads(supabase);
      } catch (error) {
        console.error(`[worker] ${getErrorDetail(error)}`);
      }
    }
    let claimed: ClaimedRecording | null = null;
    try {
      claimed = await claimNextRecording(supabase);
    } catch (error) {
      console.error(`[worker] ${getErrorDetail(error)}`);
    }
    if (claimed) {
      await processRecording(supabase, claimed, options);
      if (values.once) {
        return;
      }
      continue;
    }
    if (values.once) {
      console.log("[worker] 처리할 녹화가 없어요");
      return;
    }
    await wait(POLL_INTERVAL_MS);
  }
}

// supabase-js 실시간 클라이언트 타이머가 이벤트 루프를 붙잡아서, 작업이 끝나면 출력을 비운 뒤 직접 종료한다.
function exitAfterFlush(): void {
  process.stdout.write("", () => process.exit());
}

main()
  .catch((error: unknown) => {
    console.error(`[worker] 종료: ${getErrorDetail(error)}`);
    process.exitCode = 1;
  })
  .finally(exitAfterFlush);
