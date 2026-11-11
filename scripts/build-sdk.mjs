// src/sdk/index.ts → public/sdk.js (IIFE). 고객사 페이지에 <script src=".../sdk.js"> 한 줄로 붙는 번들.
// 사용: node scripts/build-sdk.mjs [--watch]
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import * as esbuild from "esbuild";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUTPUT_FILE = `${PROJECT_ROOT}public/sdk.js`;
const GZIP_BUDGET_BYTES = 60 * 1024;
const DEFAULT_SDK_ORIGIN = "http://localhost:3000";

try {
  process.loadEnvFile(`${PROJECT_ROOT}.env.local`);
} catch {
  // .env.local이 없으면 기본 origin을 쓴다.
}

const sdkOrigin = process.env.NEXT_PUBLIC_SDK_ORIGIN || DEFAULT_SDK_ORIGIN;
const isWatchMode = process.argv.includes("--watch");

async function reportSize() {
  const output = await readFile(OUTPUT_FILE);
  const gzipBytes = gzipSync(output).length;
  const kilobytes = (bytes) => `${(bytes / 1024).toFixed(1)}KB`;
  const budgetNote = gzipBytes > GZIP_BUDGET_BYTES ? `예산 ${kilobytes(GZIP_BUDGET_BYTES)} 초과` : `예산 ${kilobytes(GZIP_BUDGET_BYTES)} 이내`;
  console.log(`[sdk] public/sdk.js ${kilobytes(output.length)} (gzip ${kilobytes(gzipBytes)}, ${budgetNote}) origin=${sdkOrigin}`);
  return gzipBytes;
}

const reportPlugin = {
  name: "report-size",
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length === 0) {
        await reportSize();
      }
    });
  },
};

const buildOptions = {
  entryPoints: [`${PROJECT_ROOT}src/sdk/index.ts`],
  outfile: OUTPUT_FILE,
  bundle: true,
  format: "iife",
  minify: true,
  target: "es2020",
  platform: "browser",
  tsconfig: `${PROJECT_ROOT}tsconfig.json`,
  define: { "process.env.NEXT_PUBLIC_SDK_ORIGIN": JSON.stringify(sdkOrigin) },
  legalComments: "none",
  logLevel: "warning",
};

if (isWatchMode) {
  const context = await esbuild.context({ ...buildOptions, plugins: [reportPlugin] });
  await context.watch();
  console.log("[sdk] 변경을 지켜보고 있어요");
} else {
  await esbuild.build(buildOptions);
  const gzipBytes = await reportSize();
  if (gzipBytes > GZIP_BUDGET_BYTES) {
    process.exitCode = 1;
  }
}
