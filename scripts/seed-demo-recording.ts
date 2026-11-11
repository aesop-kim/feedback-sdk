// 발표 Plan B: 분석까지 끝난 실제 녹화를 스냅샷으로 저장하고, 언제든 한 번에 다시 넣는다.
//   npx tsx scripts/seed-demo-recording.ts --export [recordingId]   # 최근(또는 지정) analyzed 녹화를 저장
//   npm run seed:demo                                               # 저장한 스냅샷을 김데모 대화로 넣기
// 넣을 때 질문 카드는 "승인 전" 상태로 돌려 두어, 발표에서 승인 → 고객 답변을 라이브로 이어간다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");

const BUCKET = "recordings";
const SNAPSHOT_DIRECTORY = path.join("fixtures", "demo-recording", "snapshot");
const PROJECT_KEY = "lattice-demo";
const DEMO_USER = { id: "u_1024", name: "김데모", email: "demo.user@example.com" };

type RecordingRow = Record<string, unknown> & { id: string; frames: { path: string }[] };
type IssueRow = Record<string, unknown> & { id: string; frame_path: string | null };
type CardRow = Record<string, unknown> & { issue_id: string };
type Snapshot = { recording: RecordingRow; issues: IssueRow[]; cards: CardRow[]; files: string[] };

function getSupabase(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false },
  });
}

async function exportSnapshot(supabase: SupabaseClient, recordingId: string | undefined): Promise<void> {
  const query = supabase.from("recordings").select("*").eq("status", "analyzed").order("created_at", { ascending: false }).limit(1);
  const { data: recordings } = recordingId ? await supabase.from("recordings").select("*").eq("id", recordingId) : await query;
  const recording = recordings?.[0] as RecordingRow | undefined;
  if (!recording) {
    throw new Error("저장할 분석 완료 녹화가 없어요.");
  }
  const { data: issues } = await supabase.from("issues").select("*").eq("recording_id", recording.id).order("sort_order");
  const issueIds = (issues ?? []).map((issue) => issue.id as string);
  const { data: cards } = issueIds.length ? await supabase.from("clarification_cards").select("*").in("issue_id", issueIds) : { data: [] };

  const files = ["video.webm", "audio.webm", "events.json", ...recording.frames.map((frame) => frame.path)];
  for (const relativePath of files) {
    const { data, error } = await supabase.storage.from(BUCKET).download(`${recording.id}/${relativePath}`);
    if (error || !data) {
      throw new Error(`${relativePath} 내려받기 실패: ${error?.message}`);
    }
    const target = path.join(SNAPSHOT_DIRECTORY, "files", relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await data.arrayBuffer()));
  }
  const snapshot: Snapshot = { recording, issues: (issues ?? []) as IssueRow[], cards: (cards ?? []) as CardRow[], files };
  await writeFile(path.join(SNAPSHOT_DIRECTORY, "snapshot.json"), JSON.stringify(snapshot, null, 2));
  console.log(`[seed] 저장했어요 · 녹화 ${recording.id} · 이슈 ${snapshot.issues.length}건 · 파일 ${files.length}개`);
}

function getContentType(relativePath: string): string {
  if (relativePath.endsWith(".jpg")) {
    return "image/jpeg";
  }
  if (relativePath.endsWith(".json")) {
    return "application/json";
  }
  return "video/webm";
}

// 행을 새로 넣을 때 DB가 정하는 칸(id, created_at)은 빼고 복사한다.
function omitGeneratedColumns<TRow extends Record<string, unknown>>(row: TRow): Omit<TRow, "id" | "created_at"> {
  const copy: Record<string, unknown> = { ...row };
  delete copy.id;
  delete copy.created_at;
  return copy as Omit<TRow, "id" | "created_at">;
}

async function getDemoConversationId(supabase: SupabaseClient): Promise<{ conversationId: string }> {
  const { data: project } = await supabase.from("projects").select("id").eq("project_key", PROJECT_KEY).single();
  if (!project) {
    throw new Error("데모 프로젝트가 없어요. npm run db:reset 을 먼저 실행해 주세요.");
  }
  const { data: endUser } = await supabase
    .from("end_users")
    .upsert({ project_id: project.id, external_id: DEMO_USER.id, name: DEMO_USER.name, email: DEMO_USER.email }, { onConflict: "project_id,external_id" })
    .select("id")
    .single();
  if (!endUser) {
    throw new Error("데모 사용자를 만들지 못했어요.");
  }
  const { data: existing } = await supabase.from("conversations").select("id").eq("end_user_id", endUser.id).limit(1).maybeSingle();
  if (existing) {
    return { conversationId: existing.id as string };
  }
  const { data: created } = await supabase.from("conversations").insert({ project_id: project.id, end_user_id: endUser.id }).select("id").single();
  if (!created) {
    throw new Error("대화를 만들지 못했어요.");
  }
  return { conversationId: created.id as string };
}

async function importSnapshot(supabase: SupabaseClient): Promise<void> {
  const snapshot = JSON.parse(await readFile(path.join(SNAPSHOT_DIRECTORY, "snapshot.json"), "utf8")) as Snapshot;
  const { conversationId } = await getDemoConversationId(supabase);
  const originalId = snapshot.recording.id;
  const recordingFields = omitGeneratedColumns(snapshot.recording);

  const { data: recording, error } = await supabase
    .from("recordings")
    .insert({ ...recordingFields, conversation_id: conversationId, status: "analyzed", reverify_issue_id: null })
    .select("id")
    .single();
  if (error || !recording) {
    throw new Error(`녹화를 넣지 못했어요: ${error?.message}`);
  }
  const recordingId = recording.id as string;

  for (const relativePath of snapshot.files) {
    const body = await readFile(path.join(SNAPSHOT_DIRECTORY, "files", relativePath));
    const contentType = getContentType(relativePath);
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(`${recordingId}/${relativePath}`, body, { contentType, upsert: true });
    if (uploadError) {
      throw new Error(`${relativePath} 올리기 실패: ${uploadError.message}`);
    }
  }

  for (const issue of snapshot.issues) {
    const originalIssueId = issue.id;
    const issueFields = omitGeneratedColumns(issue);
    const { data: insertedIssue } = await supabase
      .from("issues")
      .insert({
        ...issueFields,
        recording_id: recordingId,
        conversation_id: conversationId,
        status: "open",
        frame_path: issue.frame_path ? issue.frame_path.replace(originalId, recordingId) : null,
      })
      .select("id")
      .single();
    const card = snapshot.cards.find((item) => item.issue_id === originalIssueId);
    if (insertedIssue && card) {
      await supabase.from("clarification_cards").insert({
        issue_id: insertedIssue.id,
        question: card.question,
        options: card.options,
        highlight: card.highlight,
      });
    }
  }

  await supabase.from("messages").insert({ conversation_id: conversationId, sender: "user", type: "recording", recording_id: recordingId });
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString(), last_message_preview: "화면 녹화를 보냈어요", admin_unread_count: 1 })
    .eq("id", conversationId);
  console.log(`[seed] 넣었어요 · 녹화 ${recordingId} · 이슈 ${snapshot.issues.length}건 (질문 카드는 승인 전)`);
}

async function main(): Promise<void> {
  const supabase = getSupabase();
  const exportIndex = process.argv.indexOf("--export");
  if (exportIndex >= 0) {
    await exportSnapshot(supabase, process.argv[exportIndex + 1]);
    return;
  }
  await importSnapshot(supabase);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(`[seed] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
