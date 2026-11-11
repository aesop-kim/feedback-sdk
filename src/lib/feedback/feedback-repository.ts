import "server-only";
import { isRemainingIssue } from "@/lib/feedback/issue-status";
import { findRecordingFailureKind } from "@/lib/feedback/recording-failure";
import { findOpenReverifyRequest } from "@/lib/feedback/reverify-request";
import { getFirstRelation } from "@/lib/supabase/first-relation";
import { RECORDINGS_BUCKET, getServerSupabase } from "@/lib/supabase/server-client";
import type {
  ChatMessage,
  ClarificationCard,
  ClarificationOption,
  ConversationSummary,
  ElementContext,
  HighlightBox,
  Issue,
  IssueStatus,
  RecordingDetail,
  RecordingSummary,
  ReverifyRequest,
  TranscriptSegment,
} from "@/types/feedback";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

type MessageRow = {
  id: string;
  sender: ChatMessage["sender"];
  type: ChatMessage["type"];
  body: string | null;
  created_at: string;
  recording_id: string | null;
  clarification_card_id: string | null;
};

type RecordingRow = {
  id: string;
  status: RecordingSummary["status"];
  duration_ms: number | null;
  page_url: string | null;
  page_title: string | null;
  transcript: { segments?: TranscriptSegment[] } | null;
  error: string | null;
  created_at: string;
  analysis_attempt: number;
};

type RecordingDetailRow = RecordingRow & { reverify_issue_id: string | null };

type IssueRow = {
  id: string;
  recording_id: string;
  t_ms: number;
  quote: string;
  title: string;
  summary: string;
  suggestion: string;
  confidence: Issue["confidence"];
  status: Issue["status"];
  element: ElementContext | null;
  frame_path: string | null;
  sort_order: number;
};

type CardRow = {
  id: string;
  issue_id: string;
  question: string;
  options: ClarificationOption[];
  highlight: HighlightBox | null;
  approved_at: string | null;
  answered_at: string | null;
};

type AnswerRow = { card_id: string; option_id: string | null; text: string | null; created_at: string };

async function createSignedUrlMap(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  const signedUrls = new Map<string, string>();
  if (uniquePaths.length === 0) {
    return signedUrls;
  }
  const { data } = await getServerSupabase().storage.from(RECORDINGS_BUCKET).createSignedUrls(uniquePaths, SIGNED_URL_TTL_SECONDS);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) {
      signedUrls.set(item.path, item.signedUrl);
    }
  }
  return signedUrls;
}

async function getCardsWithAnswers(cardIds: string[]) {
  if (cardIds.length === 0) {
    return { cards: [] as CardRow[], answers: [] as AnswerRow[] };
  }
  const supabase = getServerSupabase();
  const [{ data: cards }, { data: answers }] = await Promise.all([
    supabase.from("clarification_cards").select("id, issue_id, question, options, highlight, approved_at, answered_at").in("id", cardIds),
    supabase.from("clarification_answers").select("card_id, option_id, text, created_at").in("card_id", cardIds).order("created_at"),
  ]);
  return { cards: (cards ?? []) as CardRow[], answers: (answers ?? []) as AnswerRow[] };
}

function toClarificationCard(
  card: CardRow,
  issue: Pick<IssueRow, "quote" | "frame_path"> | undefined,
  answers: AnswerRow[],
  signedUrls: Map<string, string>,
): ClarificationCard {
  const latestAnswer = answers.filter((answer) => answer.card_id === card.id).at(-1);
  return {
    id: card.id,
    issueId: card.issue_id,
    question: card.question,
    options: card.options,
    highlight: card.highlight,
    frameUrl: issue?.frame_path ? signedUrls.get(issue.frame_path) ?? null : null,
    quote: issue?.quote ?? "",
    approvedAt: card.approved_at,
    answeredAt: card.answered_at,
    answer: latestAnswer ? { optionId: latestAnswer.option_id, text: latestAnswer.text } : null,
  };
}

function toRecordingSummary(row: RecordingRow, issueCount: number): RecordingSummary {
  return {
    id: row.id,
    status: row.status,
    durationMs: row.duration_ms,
    pageUrl: row.page_url,
    pageTitle: row.page_title,
    issueCount,
    createdAt: row.created_at,
    failureKind: findRecordingFailureKind({ status: row.status, error: row.error, analysisAttempt: row.analysis_attempt }),
  };
}

// 위젯과 관리자 양쪽에서 쓰는 대화 메시지 목록. 위젯은 승인된 질문 카드만 본다.
export async function getConversationMessages(conversationId: string, audience: "widget" | "admin"): Promise<ChatMessage[]> {
  const supabase = getServerSupabase();
  const { data: messageRows } = await supabase
    .from("messages")
    .select("id, sender, type, body, created_at, recording_id, clarification_card_id")
    .eq("conversation_id", conversationId)
    .order("created_at");
  const messages = (messageRows ?? []) as MessageRow[];

  const recordingIds = messages.map((message) => message.recording_id).filter((id): id is string => Boolean(id));
  const cardIds = messages.map((message) => message.clarification_card_id).filter((id): id is string => Boolean(id));

  const [{ data: recordingRows }, { data: issueCountRows }, { cards, answers }] = await Promise.all([
    recordingIds.length
      ? supabase
          .from("recordings")
          .select("id, status, duration_ms, page_url, page_title, transcript, error, created_at, analysis_attempt")
          .in("id", recordingIds)
      : Promise.resolve({ data: [] }),
    recordingIds.length ? supabase.from("issues").select("recording_id").in("recording_id", recordingIds) : Promise.resolve({ data: [] }),
    getCardsWithAnswers(cardIds),
  ]);

  const { data: cardIssueRows } = cards.length
    ? await supabase.from("issues").select("id, quote, frame_path").in("id", cards.map((card) => card.issue_id))
    : { data: [] };
  const cardIssues = new Map((cardIssueRows ?? []).map((row) => [row.id as string, row as Pick<IssueRow, "quote" | "frame_path">]));
  const signedUrls = await createSignedUrlMap([...cardIssues.values()].map((issue) => issue.frame_path));

  const recordings = new Map(((recordingRows ?? []) as RecordingRow[]).map((row) => [row.id, row]));
  const issueCounts = new Map<string, number>();
  for (const row of (issueCountRows ?? []) as { recording_id: string }[]) {
    issueCounts.set(row.recording_id, (issueCounts.get(row.recording_id) ?? 0) + 1);
  }
  const cardsById = new Map(cards.map((card) => [card.id, card]));

  return messages
    .map((message) => {
      const recordingRow = message.recording_id ? recordings.get(message.recording_id) : undefined;
      const cardRow = message.clarification_card_id ? cardsById.get(message.clarification_card_id) : undefined;
      return {
        id: message.id,
        sender: message.sender,
        type: message.type,
        body: message.body,
        createdAt: message.created_at,
        recording: recordingRow ? toRecordingSummary(recordingRow, issueCounts.get(recordingRow.id) ?? 0) : null,
        clarification: cardRow ? toClarificationCard(cardRow, cardIssues.get(cardRow.issue_id), answers, signedUrls) : null,
      };
    })
    .filter((message) => audience === "admin" || message.type !== "clarification" || message.clarification?.approvedAt);
}

export async function getRecordingDetails(conversationId: string): Promise<RecordingDetail[]> {
  const supabase = getServerSupabase();
  const { data: recordingRows } = await supabase
    .from("recordings")
    .select("id, status, duration_ms, page_url, page_title, transcript, error, created_at, analysis_attempt, reverify_issue_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false });
  const recordings = (recordingRows ?? []) as RecordingDetailRow[];
  if (recordings.length === 0) {
    return [];
  }

  const { data: issueRows } = await supabase
    .from("issues")
    .select("id, recording_id, t_ms, quote, title, summary, suggestion, confidence, status, element, frame_path, sort_order")
    .in("recording_id", recordings.map((recording) => recording.id))
    .order("sort_order");
  const issues = (issueRows ?? []) as IssueRow[];

  const { data: cardRows } = issues.length
    ? await supabase.from("clarification_cards").select("id").in("issue_id", issues.map((issue) => issue.id))
    : { data: [] };
  const { cards, answers } = await getCardsWithAnswers((cardRows ?? []).map((row) => row.id as string));
  const cardsByIssue = new Map(cards.map((card) => [card.issue_id, card]));

  const signedUrls = await createSignedUrlMap([
    ...issues.map((issue) => issue.frame_path),
    ...recordings.map((recording) => `${recording.id}/video.webm`),
  ]);

  return recordings.map((recording) => {
    const recordingIssues = issues.filter((issue) => issue.recording_id === recording.id);
    return {
      ...toRecordingSummary(recording, recordingIssues.length),
      videoUrl: signedUrls.get(`${recording.id}/video.webm`) ?? null,
      transcript: recording.transcript?.segments ?? [],
      error: recording.error,
      reverifyIssueId: recording.reverify_issue_id,
      issues: recordingIssues.map((issue) => {
        const card = cardsByIssue.get(issue.id);
        return {
          id: issue.id,
          recordingId: issue.recording_id,
          tMs: issue.t_ms,
          quote: issue.quote,
          title: issue.title,
          summary: issue.summary,
          suggestion: issue.suggestion,
          confidence: issue.confidence,
          status: issue.status,
          element: issue.element,
          frameUrl: issue.frame_path ? signedUrls.get(issue.frame_path) ?? null : null,
          clarification: card ? toClarificationCard(card, issue, answers, signedUrls) : null,
        };
      }),
    };
  });
}

// 위젯: 고객에게 재확인 녹화를 부탁하는 중인 이슈(없으면 null).
export async function findReverifyRequest(conversationId: string): Promise<ReverifyRequest | null> {
  const { data } = await getServerSupabase()
    .from("issues")
    .select("id, title, status, resolved_at")
    .eq("conversation_id", conversationId)
    .eq("status", "resolved");
  return findOpenReverifyRequest((data ?? []) as Parameters<typeof findOpenReverifyRequest>[0]);
}

// conversationId를 주면 그 대화 하나만(상세 화면), 없으면 최근 100개(목록)를 돌려준다.
export async function getConversationSummaries(conversationId?: string): Promise<ConversationSummary[]> {
  const supabase = getServerSupabase();
  const baseQuery = supabase
    .from("conversations")
    .select("id, last_message_at, last_message_preview, admin_unread_count, end_users(external_id, name, email), recordings(id), issues(id, status)");
  const { data: rows } = conversationId
    ? await baseQuery.eq("id", conversationId)
    : await baseQuery.order("last_message_at", { ascending: false }).limit(100);
  return (rows ?? []).map((row) => {
    const endUser = getFirstRelation<{ external_id: string; name: string; email: string | null }>(row.end_users);
    const issueRows = (row.issues ?? []) as { status: IssueStatus }[];
    return {
      id: row.id,
      endUser: { externalId: endUser.external_id, name: endUser.name, email: endUser.email },
      lastMessageAt: row.last_message_at,
      lastMessagePreview: row.last_message_preview,
      adminUnreadCount: row.admin_unread_count,
      recordingCount: (row.recordings ?? []).length,
      openIssueCount: issueRows.filter((issue) => isRemainingIssue(issue.status)).length,
    };
  });
}

// 메시지를 저장하고 대화 미리보기·안읽음 수를 갱신한다.
export async function insertMessage(input: {
  conversationId: string;
  sender: ChatMessage["sender"];
  type: ChatMessage["type"];
  body: string | null;
  recordingId?: string;
  clarificationCardId?: string;
  preview: string;
}): Promise<string> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      sender: input.sender,
      type: input.type,
      body: input.body,
      recording_id: input.recordingId ?? null,
      clarification_card_id: input.clarificationCardId ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`메시지 저장 실패: ${error?.message}`);
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("admin_unread_count, user_unread_count")
    .eq("id", input.conversationId)
    .single();
  const isFromUser = input.sender === "user";
  await supabase
    .from("conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: input.preview.slice(0, 120),
      admin_unread_count: (conversation?.admin_unread_count ?? 0) + (isFromUser ? 1 : 0),
      user_unread_count: (conversation?.user_unread_count ?? 0) + (isFromUser ? 0 : 1),
    })
    .eq("id", input.conversationId);
  return data.id;
}
