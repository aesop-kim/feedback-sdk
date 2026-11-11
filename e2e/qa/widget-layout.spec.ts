import { readFileSync } from "node:fs";
import { expect, test, type Frame, type Page } from "@playwright/test";
// eslint-disable-next-line no-restricted-imports -- @/ 별칭은 src/만 가리켜서 e2e 도우미는 상대 경로로 가져온다.
import { SDK_ORIGIN, WIDGET_FRAME, captureQaScreen, cleanupQaUsers, collectDiagnostics, createQaUser, openWidget } from "./qa-helpers";

// 위젯 접근성·배치 회귀: 메시지 목록 의미(NEW-05), 360px 녹화 알약(NEW-06), 카메라 정책 콘솔 오류(NEW-09).
const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

type AxeViolation = { id: string; nodes: unknown[] };

test.afterAll(async () => {
  await cleanupQaUsers("qa-layout-");
});

function getWidgetFrame(page: Page): Frame {
  const frame = page.frames().find((candidate) => candidate.url().startsWith(`${SDK_ORIGIN}/widget`));
  if (!frame) {
    throw new Error("위젯 iframe을 찾지 못했어요");
  }
  return frame;
}

async function runAxe(frame: Frame): Promise<AxeViolation[]> {
  await frame.evaluate(AXE_SOURCE);
  return frame.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: Document, options: object) => Promise<{ violations: AxeViolation[] }> } }).axe;
    const result = await axe.run(document, { runOnly: { type: "rule", values: ["list", "listitem", "aria-allowed-role"] } });
    return result.violations.map((violation) => ({ id: violation.id, nodes: violation.nodes }));
  });
}

test("메시지 목록은 log 래퍼 안에서 ol/li 의미를 지키고, axe 목록 규칙 위반이 없다", async ({ page }) => {
  const user = createQaUser("layout-a11y");
  const widget = await openWidget(page, user);
  await widget.getByRole("textbox", { name: "메시지" }).fill("목록 접근성 확인");
  await widget.getByRole("button", { name: "보내기" }).click();
  const log = widget.getByRole("log", { name: "대화" });
  await expect(log.getByRole("listitem").filter({ hasText: "목록 접근성 확인" })).toBeVisible();
  await expect(log.getByRole("list")).toHaveCount(1);
  const violations = await runAxe(getWidgetFrame(page));
  console.log(`[qa] axe list rules: ${JSON.stringify(violations.map((violation) => `${violation.id}×${violation.nodes.length}`))}`);
  expect(violations).toEqual([]);
});

test("360px 화면에서 녹화 알약이 화면 안에 있고, 카메라 정책 오류가 콘솔에 없다", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const diagnostics = collectDiagnostics(page);
  const user = createQaUser("layout-pill");
  const widget = await openWidget(page, user);
  await widget.getByRole("button", { name: "화면 녹화로 설명하기" }).click();
  await expect(widget.getByRole("status", { name: "화면 녹화 중" })).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(500);
  const box = await page.locator(WIDGET_FRAME).boundingBox();
  await captureQaScreen(page, "layout-360-pill");
  console.log(`[qa] 360 pill box: ${JSON.stringify(box)}`);
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  await widget.getByRole("button", { name: "취소" }).click();
  expect(diagnostics.consoleErrors.filter((line) => line.includes("Permissions policy violation"))).toEqual([]);
});
