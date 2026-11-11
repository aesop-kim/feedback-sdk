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

export type RecordingDetail = RecordingSummary & {
  videoUrl: string | null;
  transcript: TranscriptSegment[];
  issues: Issue[];
  error: string | null;
};

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
