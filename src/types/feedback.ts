// 위젯·관리자·워커가 함께 쓰는 데이터 모양(API 응답 기준, camelCase).

export type MessageSender = "user" | "admin" | "system";
export type MessageType = "text" | "recording" | "clarification" | "system";
export type RecordingStatus = "uploading" | "uploaded" | "analyzing" | "analyzed" | "failed";
export type IssueConfidence = "clear" | "ambiguous";
export type IssueStatus = "open" | "asked" | "answered" | "resolved" | "reverify";

export type EndUserInput = { id: string; name: string; email?: string };

export type HighlightBox = { x: number; y: number; width: number; height: number };

export type ElementContext = {
  selector: string;
  text: string;
  tagName: string;
  rect: { x: number; y: number; width: number; height: number };
  viewport: { width: number; height: number };
};

export type ClarificationOption = { id: string; label: string };

export type ClarificationCard = {
  id: string;
  issueId: string;
  question: string;
  options: ClarificationOption[];
  highlight: HighlightBox | null;
  frameUrl: string | null;
  quote: string;
  approvedAt: string | null;
  answeredAt: string | null;
  answer: { optionId: string | null; text: string | null } | null;
};

export type RecordingSummary = {
  id: string;
  status: RecordingStatus;
  durationMs: number | null;
  pageUrl: string | null;
  pageTitle: string | null;
  issueCount: number;
  createdAt: string;
  // 실패한 녹화의 종류(실패가 아니면 null). 위젯과 관리자가 같은 이야기를 하도록 둘 다 받는다.
  failureKind: RecordingFailureKind | null;
};

export type ChatMessage = {
  id: string;
  sender: MessageSender;
  type: MessageType;
  body: string | null;
  createdAt: string;
  recording: RecordingSummary | null;
  clarification: ClarificationCard | null;
};

export type Issue = {
  id: string;
  recordingId: string;
  tMs: number;
  quote: string;
  title: string;
  summary: string;
  suggestion: string;
  confidence: IssueConfidence;
  status: IssueStatus;
  element: ElementContext | null;
  frameUrl: string | null;
  clarification: ClarificationCard | null;
};

export type TranscriptSegment = { startMs: number; endMs: number; text: string };

// 실패한 녹화를 어떻게 다룰지: 무음·업로드 미완료는 다시 녹화 요청, analysis는 다시 정리하기.
export type RecordingFailureKind = "silent_audio" | "upload_incomplete" | "analysis";

export type RecordingDetail = RecordingSummary & {
  videoUrl: string | null;
  transcript: TranscriptSegment[];
  issues: Issue[];
  error: string | null;
  // 이 녹화가 어떤 이슈의 재확인 녹화인지(일반 녹화면 null).
  reverifyIssueId: string | null;
};

// 위젯: 고객에게 재확인 녹화를 부탁하는 중인 이슈(GET /api/messages의 reverifyRequest).
export type ReverifyRequest = { issueId: string; title: string; resolvedAt: string | null };

export type ConversationSummary = {
  id: string;
  endUser: { externalId: string; name: string; email: string | null };
  lastMessageAt: string;
  lastMessagePreview: string | null;
  adminUnreadCount: number;
  recordingCount: number;
  openIssueCount: number;
};

export type ConversationDetail = ConversationSummary & {
  messages: ChatMessage[];
  recordings: RecordingDetail[];
};
