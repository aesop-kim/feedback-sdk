// 데모 영상용 정지 이미지를 만든다.
// - demo/scenes/*.html → demo/cards/<이름>.png (1920x1080)
// - 화면 프레임 재료: frame-background.png(배경+그림자), screen-mask.png(둥근 모서리), frame-border.png(헤어라인)
// - demo/captions.json → demo/cards/caption-<id>.png (투명 배경 알약)
// 실행: node demo/scripts/render-cards.mjs
import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import {
  BACKGROUND_COLOR,
  CARDS_DIRECTORY,
  DEMO_DIRECTORY,
  OUTPUT_HEIGHT,
  OUTPUT_WIDTH,
  PROJECT_DIRECTORY,
  SCENES_DIRECTORY,
  SCREEN,
} from "./frame-layout.mjs";

const FONT_URL = pathToFileURL(
  path.join(PROJECT_DIRECTORY, "node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2"),
).href;

const FONT_FACE = `
@font-face {
  font-family: "Pretendard Variable";
  src: url("${FONT_URL}") format("woff2-variations");
  font-weight: 45 920;
  font-display: block;
}`;

async function renderScenes(page) {
  const sceneFiles = (await readdir(SCENES_DIRECTORY)).filter((fileName) => fileName.endsWith(".html"));
  for (const fileName of sceneFiles) {
    await page.goto(pathToFileURL(path.join(SCENES_DIRECTORY, fileName)).href);
    await page.evaluate(() => document.fonts.ready);
    const outputPath = path.join(CARDS_DIRECTORY, fileName.replace(/\.html$/, ".png"));
    await page.screenshot({ path: outputPath });
    console.log(`장면  ${path.relative(DEMO_DIRECTORY, outputPath)}`);
  }
}

async function renderFrameAssets(page) {
  const screenBox = `left:${SCREEN.x}px;top:${SCREEN.y}px;width:${SCREEN.width}px;height:${SCREEN.height}px;border-radius:${SCREEN.radius}px;`;

  // 배경 + 아주 옅은 그림자 한 겹(화면 자리는 어차피 영상으로 덮인다).
  await page.setContent(`<html><body style="margin:0;width:${OUTPUT_WIDTH}px;height:${OUTPUT_HEIGHT}px;background:${BACKGROUND_COLOR};">
    <div style="position:absolute;${screenBox}background:#fff;box-shadow:0 10px 36px rgba(25,31,40,0.07);"></div>
  </body></html>`);
  await page.screenshot({ path: path.join(CARDS_DIRECTORY, "frame-background.png") });

  // 둥근 모서리 마스크: 화면 크기, 흰 둥근 사각형 + 검은 바깥.
  await page.setViewportSize({ width: SCREEN.width, height: SCREEN.height });
  await page.setContent(`<html><body style="margin:0;background:#000;">
    <div style="width:${SCREEN.width}px;height:${SCREEN.height}px;border-radius:${SCREEN.radius}px;background:#fff;"></div>
  </body></html>`);
  await page.screenshot({ path: path.join(CARDS_DIRECTORY, "screen-mask.png") });

  // 흰 화면이 배경에 묻히지 않도록 안쪽 헤어라인 한 줄.
  await page.setContent(`<html><body style="margin:0;background:transparent;">
    <div style="width:${SCREEN.width}px;height:${SCREEN.height}px;border-radius:${SCREEN.radius}px;box-shadow:inset 0 0 0 1px rgba(25,31,40,0.08);"></div>
  </body></html>`);
  await page.screenshot({ path: path.join(CARDS_DIRECTORY, "frame-border.png"), omitBackground: true });
  await page.setViewportSize({ width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT });
  console.log("프레임 frame-background.png, screen-mask.png, frame-border.png");
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatCaptionText(caption) {
  if (caption.kind === "speech") {
    return `“${caption.text}”`;
  }
  return caption.text;
}

async function renderCaptions(page) {
  const { captions } = JSON.parse(await readFile(path.join(DEMO_DIRECTORY, "captions.json"), "utf8"));
  for (const caption of captions) {
    await page.setContent(`<html><head><style>
      ${FONT_FACE}
      body { margin: 0; padding: 40px 0; background: transparent; text-align: center; }
      .pill {
        display: inline-block;
        padding: 17px 30px 18px;
        border-radius: 999px;
        background: rgba(25, 31, 40, 0.9);
        color: #ffffff;
        font-family: "Pretendard Variable", sans-serif;
        font-size: 32px;
        line-height: 40px;
        font-weight: 600;
        letter-spacing: -0.02em;
        word-break: keep-all;
        white-space: nowrap;
        -webkit-font-smoothing: antialiased;
      }
    </style></head><body><span class="pill">${escapeHtml(formatCaptionText(caption))}</span></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    const outputPath = path.join(CARDS_DIRECTORY, `caption-${caption.id}.png`);
    await page.locator(".pill").screenshot({ path: outputPath, omitBackground: true });
  }
  console.log(`캡션  ${captions.length}개 → cards/caption-*.png`);
}

async function main() {
  await mkdir(CARDS_DIRECTORY, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }, deviceScaleFactor: 1 });
    await renderScenes(page);
    await renderFrameAssets(page);
    await renderCaptions(page);
  } finally {
    await browser.close();
  }
}

await main();
