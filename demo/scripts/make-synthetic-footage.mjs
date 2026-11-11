// 진짜 녹화 전에 조립 과정을 시험하려고, 저장해 둔 화면(.screens)으로 가짜 원본을 만든다.
// customer.webm, admin.webm, cues.json을 만든다. cue 시각과 화면 전환 시각은 실제 흐름과 비슷하게 맞췄다.
// 실행: node demo/scripts/make-synthetic-footage.mjs [출력 폴더, 기본 demo/build/synthetic-raw]
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { DEMO_DIRECTORY, PROJECT_DIRECTORY } from "./frame-layout.mjs";

const OUTPUT_DIRECTORY = path.resolve(process.argv[2] ?? path.join(DEMO_DIRECTORY, "build/synthetic-raw"));
const SCREENS_DIRECTORY = path.join(PROJECT_DIRECTORY, ".screens");
const LABEL_FONT = path.join(os.homedir(), "Library/Fonts/Pretendard-SemiBold.ttf");
// 녹화기가 컨텍스트보다 조금 늦게 시작하는 상황을 흉내 낸다(assemble이 creation_time으로 보정하는지 확인).
const RECORDER_DELAY_SECONDS = 0.3;
const RECORDING_START = 6.05;

const CUSTOMER_PLAN = {
  seconds: 152,
  screens: [
    { from: 0, file: "flow/01-host-closed.png" },
    { from: 3.8, file: "flow/02-widget-empty.png" },
    { from: 6.6, file: "flow/03-recording.png" },
    { from: 77.5, file: "flow/04-widget-uploaded.png" },
    { from: 125, file: "flow/06-widget-reply.png" },
    { from: 133, file: "flow/08-widget-question.png" },
    { from: 137.8, file: "flow/09-widget-answered.png" },
  ],
  cues: [
    ["page-ready", 1.0],
    ["launcher-hover", 3.2, 0.965, 0.94],
    ["launcher-click", 3.2, 0.965, 0.94],
    ["widget-open", 3.8],
    ["record-hover", 6.0, 0.86, 0.72],
    ["record-click", 6.0, 0.86, 0.72],
    ["recording-start", RECORDING_START],
    ["recording-visible", 6.6],
    ["bug-1-hover", RECORDING_START + 11.2, 0.876, 0.031],
    ["bug-1-click-first", RECORDING_START + 15, 0.876, 0.031],
    ["bug-1-click-second", RECORDING_START + 19, 0.876, 0.031],
    ["bug-2-hover", RECORDING_START + 27.7, 0.84, 0.089],
    ["bug-3-hover", RECORDING_START + 39.7, 0.205, 0.031],
    ["summary-hover", RECORDING_START + 54.2, 0.876, 0.031],
    ["finish-hover", 74.8, 0.9, 0.9],
    ["finish-click", 74.8, 0.9, 0.9],
    ["upload-done", 77.5],
    ["analyzing-visible", 77.6],
    ["analysis-done", 112],
    ["reply-visible", 125],
    ["question-visible", 133, 0.85, 0.48],
    ["answer-option-hover", 135.5, 0.8, 0.41],
    ["answer-option-click", 135.5, 0.8, 0.41],
    ["answer-send-hover", 137.2, 0.85, 0.64],
    ["answer-send-click", 137.2, 0.85, 0.64],
    ["answered", 137.8],
    ["reverify-visible", 145, 0.85, 0.7],
    ["end", 150],
  ],
};

const ADMIN_PLAN = {
  seconds: 74,
  screens: [
    { from: 0, file: "admin-analyzing.png" },
    { from: 34, file: "flow/05-admin-analysis.png" },
    { from: 46.6, file: "flow/07-admin-asked.png" },
    { from: 60.5, file: "admin-after-actions.png" },
  ],
  cues: [
    ["conversation-hover", 2.0, 0.1, 0.15],
    ["conversation-click", 2.0, 0.1, 0.15],
    ["analysis-ready", 34],
    ["issue-list-hover", 35.7, 0.85, 0.55],
    ["ambiguous-issue-hover", 37.1, 0.85, 0.72],
    ["reply-field-hover", 38.5, 0.45, 0.93],
    ["reply-field-click", 38.5, 0.45, 0.93],
    ["reply-typed", 40.4],
    ["reply-sent", 40.8],
    ["ask-hover", 46, 0.88, 0.85],
    ["ask-click", 46, 0.88, 0.85],
    ["asked", 46.6],
    ["answer-visible", 60.5],
    ["issue-1-hover", 62.8, 0.85, 0.55],
    ["issue-1-click", 62.8, 0.85, 0.55],
    ["resolve-hover", 64.5, 0.8, 0.85],
    ["resolve-click", 64.5, 0.8, 0.85],
    ["resolved", 65.0],
    ["end", 72],
  ],
};

function runFfmpeg(argumentList) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...argumentList], { stdio: ["ignore", "inherit", "pipe"] });
    let standardError = "";
    child.stderr.on("data", (chunk) => {
      standardError += chunk;
    });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(standardError))));
  });
}

async function makeVideo(name, plan, createdAtMs) {
  const listPath = path.join(OUTPUT_DIRECTORY, `${name}-screens.txt`);
  const lines = [];
  plan.screens.forEach((screen, index) => {
    const nextFrom = plan.screens[index + 1]?.from ?? plan.seconds;
    // 화면 전환 시각도 녹화기 지연만큼 당겨서, 영상 속 시각 = cue 시각 - 지연이 되게 한다.
    const start = Math.max(0, screen.from - RECORDER_DELAY_SECONDS);
    const end = nextFrom - RECORDER_DELAY_SECONDS;
    lines.push(`file '${path.join(SCREENS_DIRECTORY, screen.file)}'`, `duration ${(end - start).toFixed(3)}`);
  });
  lines.push(`file '${path.join(SCREENS_DIRECTORY, plan.screens.at(-1).file)}'`);
  await writeFile(listPath, `${lines.join("\n")}\n`);

  const label = existsSync(LABEL_FONT)
    ? `,drawtext=fontfile=${LABEL_FONT}:text='${name} %{pts\\:hms}':x=24:y=h-56:fontsize=30:fontcolor=white:box=1:boxcolor=0x191F28@0.7:boxborderw=10`
    : "";
  const creationTime = new Date(createdAtMs + RECORDER_DELAY_SECONDS * 1000).toISOString();
  await runFfmpeg([
    "-f", "concat", "-safe", "0", "-i", listPath,
    "-vf", `scale=1920:-2:flags=lanczos,crop=1920:1080:0:0,fps=25${label}`,
    "-t", String(plan.seconds - RECORDER_DELAY_SECONDS),
    "-c:v", "libvpx", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "4M",
    "-metadata", `creation_time=${creationTime}`,
    path.join(OUTPUT_DIRECTORY, `${name}.webm`),
  ]);
}

function toCues(context, plan) {
  return plan.cues.map(([name, t, x, y]) => (typeof x === "number" ? { context, name, t, x, y } : { context, name, t }));
}

async function main() {
  await mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const customerCreatedAtMs = Date.parse("2026-11-11T14:00:00.000Z");
  const adminCreatedAtMs = customerCreatedAtMs + 78_000;
  await makeVideo("customer", CUSTOMER_PLAN, customerCreatedAtMs);
  await makeVideo("admin", ADMIN_PLAN, adminCreatedAtMs);
  const cueFile = {
    note: "가짜 원본(조립 시험용)",
    viewport: { width: 1920, height: 1080 },
    narrationLeadSeconds: 2,
    contexts: {
      customer: { createdAtMs: customerCreatedAtMs, video: "customer.webm" },
      admin: { createdAtMs: adminCreatedAtMs, video: "admin.webm" },
    },
    cues: [...toCues("customer", CUSTOMER_PLAN), ...toCues("admin", ADMIN_PLAN)],
  };
  await writeFile(path.join(OUTPUT_DIRECTORY, "cues.json"), `${JSON.stringify(cueFile, null, 2)}\n`);
  console.log(`가짜 원본 ${path.relative(PROJECT_DIRECTORY, OUTPUT_DIRECTORY)}/customer.webm, admin.webm, cues.json`);
}

await main();
