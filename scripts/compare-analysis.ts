// 분석 결과를 fixtures/demo-recording/expected.json과 비교한다.
// 사용: npm run check:analysis [-- <recordingId>]  (없으면 가장 최근 analyzed 녹화)
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const PROJECT_ROOT = path.resolve(import.meta.dirname, "..");
const EXPECTED_PATH = path.join(PROJECT_ROOT, "fixtures/demo-recording/expected.json");

const expectedSchema = z.object({
  issues: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      textContains: z.array(z.string()).default([]),
      selectorContains: z.array(z.string()).default([]),
      confidence: z.enum(["clear", "ambiguous"]),
    }),
  ),
});

type ExpectedIssue = z.infer<typeof expectedSchema>["issues"][number];

type ActualIssue = {
  id: string;
  title: string;
  summary: string;
  quote: string;
  confidence: string;
  element: { selector?: string } | null;
};

function isMatch(expected: ExpectedIssue, actual: ActualIssue): boolean {
  const haystack = `${actual.title} ${actual.summary} ${actual.quote}`;
  const selector = actual.element?.selector ?? "";
  const hasText = expected.textContains.some((keyword) => haystack.includes(keyword));
  const hasSelector = selector !== "" && expected.selectorContains.some((part) => selector.includes(part));
  return (hasText || hasSelector) && actual.confidence === expected.confidence;
}

// 기대 이슈마다 아직 쓰이지 않은 실제 이슈 중 처음 맞는 것을 짝짓는다.
function pairIssues(expectedIssues: ExpectedIssue[], actualIssues: ActualIssue[]): Map<string, ActualIssue | null> {
  const used = new Set<string>();
  const pairs = new Map<string, ActualIssue | null>();
  for (const expected of expectedIssues) {
    const matched = actualIssues.find((actual) => !used.has(actual.id) && isMatch(expected, actual)) ?? null;
    if (matched) {
      used.add(matched.id);
    }
    pairs.set(expected.key, matched);
  }
  return pairs;
}

async function main(): Promise<void> {
  process.loadEnvFile(path.join(PROJECT_ROOT, ".env.local"));
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const expected = expectedSchema.parse(JSON.parse(await readFile(EXPECTED_PATH, "utf8")));

  const requestedId = process.argv[2];
  let recordingQuery = supabase.from("recordings").select("id, status, created_at");
  if (requestedId) {
    recordingQuery = recordingQuery.eq("id", requestedId);
  } else {
    recordingQuery = recordingQuery.eq("status", "analyzed").order("created_at", { ascending: false });
  }
  const { data: recordings, error: recordingError } = await recordingQuery.limit(1);
  const recording = recordings?.[0];
  if (recordingError || !recording) {
    console.error(`비교할 녹화를 찾지 못했어요${recordingError ? `: ${recordingError.message}` : ""}`);
    process.exitCode = 1;
    return;
  }

  const { data: issueRows, error: issueError } = await supabase
    .from("issues")
    .select("id, title, summary, quote, confidence, element")
    .eq("recording_id", recording.id)
    .order("sort_order");
  if (issueError) {
    console.error(`이슈를 불러오지 못했어요: ${issueError.message}`);
    process.exitCode = 1;
    return;
  }
  const actualIssues = (issueRows ?? []) as ActualIssue[];
  const pairs = pairIssues(expected.issues, actualIssues);

  console.log(`녹화 ${recording.id} (상태 ${recording.status})`);
  console.table(
    expected.issues.map((item) => {
      const matched = pairs.get(item.key) ?? null;
      return {
        결과: matched ? "일치" : "없음",
        기대: `${item.title} (${item.confidence})`,
        실제: matched ? `${matched.title} (${matched.confidence})` : "-",
        선택자: matched?.element?.selector ?? "-",
      };
    }),
  );
  const pairedIds = new Set([...pairs.values()].filter((item) => item !== null).map((item) => item.id));
  const extras = actualIssues.filter((item) => !pairedIds.has(item.id));
  if (extras.length > 0) {
    console.log("기대에 없는 이슈:");
    console.table(extras.map((item) => ({ 제목: item.title, 확신: item.confidence, 선택자: item.element?.selector ?? "-" })));
  }

  const matchedCount = pairedIds.size;
  const isCountEqual = actualIssues.length === expected.issues.length;
  const isPass = isCountEqual && matchedCount === expected.issues.length;
  console.log(
    `${isPass ? "PASS" : "FAIL"} · 기대 ${expected.issues.length}건 · 실제 ${actualIssues.length}건 · 일치 ${matchedCount}건${isCountEqual ? "" : " · 개수가 달라요"}`,
  );
  process.exitCode = isPass ? 0 : 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => process.stdout.write("", () => process.exit()));
