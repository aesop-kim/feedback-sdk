import type { AnalysisContext } from "@/lib/analysis/build-analysis-context";
import { TITLE_TARGET_LENGTH } from "@/lib/analysis/issue-schema";

// claude -p 에 stdin으로 넘길 한국어 프롬프트.

type PromptInput = {
  context: AnalysisContext;
  framesDirectory: string;
  pageUrl: string | null;
  pageTitle: string | null;
  viewport: { width: number; height: number } | null;
  // 재확인 녹화면 고객이 다시 확인한 원래 이슈.
  reverifyIssue?: { title: string; summary: string } | null;
  retryReason?: string;
};

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function getFileName(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function formatSegments(context: AnalysisContext): string {
  return context.segments
    .map((segment) => {
      const lines = [`[${segment.index}] ${formatSeconds(segment.startMs)}~${formatSeconds(segment.endMs)} (tMs ${segment.startMs}~${segment.endMs}) "${segment.text}"`];
      for (const item of segment.contexts) {
        const { selector, text, tagName, rect } = item.context;
        lines.push(
          `    - ${item.kind} tMs=${item.tMs} selector=${JSON.stringify(selector)} tag=${tagName || "?"} text=${JSON.stringify(text.slice(0, 80))} rect=(${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.width)}x${Math.round(rect.height)})`,
        );
      }
      if (segment.frame) {
        lines.push(`    - 대표 장면: ${getFileName(segment.frame.path)}`);
      }
      return lines.join("\n");
    })
    .join("\n");
}

function formatFrames(context: AnalysisContext, framesDirectory: string): string {
  if (context.frames.length === 0) {
    return "(장면 이미지 없음 — 받아쓰기와 요소 정보만으로 판단하세요)";
  }
  return context.frames
    .map((frame) => `- ${getFileName(frame.path)} (tMs ${frame.tMs}, ${frame.reason === "click" ? "클릭 순간" : "주기 캡처"}): ${framesDirectory}/${getFileName(frame.path)}`)
    .join("\n");
}

// 재확인 녹화: 개발팀이 고쳤다고 알린 이슈를 고객이 같은 화면에서 다시 확인한 녹화다.
function formatReverifySection(reverifyIssue: { title: string; summary: string } | null): string[] {
  if (!reverifyIssue) {
    return [];
  }
  return [
    "## 다시 확인 녹화",
    "이 녹화는 새 신고가 아니에요. 개발팀이 아래 이슈를 고쳤다고 알렸고, 고객이 같은 화면에서 고쳐졌는지 다시 확인하며 녹화했어요.",
    `- 원래 이슈: ${reverifyIssue.title}`,
    `- 원래 내용: ${reverifyIssue.summary}`,
    "- 고객이 원래 문제가 아직 남아 있다고 말하면, 원래 이슈 제목을 그대로 title로 쓰고 summary에 지금 어떻게 남아 있는지 적으세요.",
    "- 고객이 고쳐졌다고만 말하면 issues를 빈 배열로 두세요.",
    "- 다시 확인 녹화에서는 고객에게 되묻지 않아요. confidence는 모두 \"clear\", clarification은 모두 null로 두세요.",
    "",
  ];
}

export function buildAnalysisPrompt(input: PromptInput): string {
  const { context, framesDirectory, pageUrl, pageTitle, viewport } = input;
  const sections = [
    "당신은 웹 서비스 개발팀을 돕는 QA 분석가예요.",
    "고객이 웹 페이지를 보면서 화면을 녹화했고, 녹화하는 동안 페이지의 불편한 점을 말로 설명했어요.",
    "아래 받아쓰기(시간 포함), 그 시점에 고객이 클릭하거나 마우스를 올린 요소 정보, 녹화 장면 이미지를 보고 고객이 말한 문제를 이슈로 정리해 주세요.",
    "",
    "## 페이지",
    `- 주소: ${pageUrl ?? "알 수 없음"}`,
    `- 제목: ${pageTitle ?? "알 수 없음"}`,
    `- 화면 크기: ${viewport ? `${viewport.width}x${viewport.height}` : "알 수 없음"}`,
    "",
    ...formatReverifySection(input.reverifyIssue ?? null),
    "## 받아쓰기 세그먼트 (tMs는 녹화 시작 기준 ms, 아래 줄은 그 무렵의 요소 컨텍스트)",
    context.segments.length > 0 ? formatSegments(context) : "(받아쓰기 없음)",
    "",
    "## 장면 이미지",
    "관련된 장면 이미지를 Read 도구로 직접 열어 보고, 고객이 가리킨 요소가 화면에서 어떻게 보이는지 확인하세요.",
    formatFrames(context, framesDirectory),
    "",
    "## 출력 규칙",
    "- 고객이 말한 서로 다른 문제 하나당 이슈 하나를 만드세요. 같은 문제를 여러 번 말했으면 하나로 합치세요.",
    "- 고객이 말하지 않은 문제는 절대 만들지 마세요. 화면에서 직접 발견한 다른 문제도 넣지 마세요.",
    "- 화면 오른쪽 아래의 작은 녹화 표시(알약 모양)와 피드백 위젯 자체는 고객 페이지가 아니니 무시하세요.",
    "- tMs: 고객이 그 문제를 가리킨 순간(요소를 클릭·가리킨 시점, 없으면 그 말을 시작한 시점)의 ms 정수.",
    "- quote: 고객이 실제로 한 말을 받아쓰기에서 그대로 가져와 앞뒤만 다듬으세요. 바꿔 쓰지 마세요.",
    `- title: ${TITLE_TARGET_LENGTH}자 이내의 짧은 한국어 명사구. 예: "계약서 등록 버튼 무반응".`,
    "- summary: 무엇이 잘못됐는지 한 문장.",
    "- suggestion: 개발자가 바로 고칠 수 있는 구체적인 수정 제안. 어떤 요소(선택자나 화면 위치)를 고칠지 꼭 적으세요.",
    "- frameRef: 그 문제가 가장 잘 보이는 장면 파일 이름(예: 1200-click.jpg). 장면이 없으면 null.",
    "- selector: 위 요소 컨텍스트 목록에 있는 selector 중 하나를 그대로 고르세요. 맞는 것이 없으면 null.",
    "- confidence: 고객이 무엇을 바꾸길 원하는지 불분명할 때만 \"ambiguous\"(예: \"글씨가 좀 이상해요\"처럼 크기·모양·문구 중 무엇인지 모를 때). 무엇이 문제인지 분명하면 \"clear\".",
    "- clarification: ambiguous일 때만 채우고, clear면 null.",
    "  - question: 고객에게 되묻는 해요체 질문 한 문장. 예: \"이 제목 글씨의 어떤 점이 불편하셨어요?\"",
    "  - options: 고객 입장에서 말하는 구체적인 가설 2~4개. 예: \"글자가 너무 작아요\", \"글자 모양이 다른 곳과 달라요\", \"문구가 틀렸어요\"",
    "- 고객이 문제를 하나도 말하지 않았으면 issues를 빈 배열로 두세요.",
  ];
  if (input.retryReason) {
    sections.push("", "## 다시 요청", `이전 응답이 형식 검증을 통과하지 못했어요: ${input.retryReason}`, "규칙을 지켜 다시 답해 주세요.");
  }
  return sections.join("\n");
}
