import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import checkFile from "eslint-plugin-check-file";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { "check-file": checkFile },
    rules: {
      // 컨벤션 04: 중첩 삼항 금지
      "no-nested-ternary": "error",
      // 컨벤션 06: 상대 경로 대신 절대 경로(@/) import
      "no-restricted-imports": [
        "error",
        { patterns: [{ group: ["../*", "./*"], message: "@/ 절대 경로로 import 해주세요." }] },
      ],
      // 컨벤션 01: 일반 파일·폴더는 kebab-case
      "check-file/folder-naming-convention": [
        "error",
        { "src/**/": "NEXT_JS_APP_ROUTER_CASE" },
      ],
    },
  },
  {
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.d.ts"],
    rules: {
      "check-file/filename-naming-convention": [
        "error",
        { "src/**/!(use-*).ts": "KEBAB_CASE", "src/**/use-*.ts": "KEBAB_CASE" },
        { ignoreMiddleExtensions: true },
      ],
    },
  },
  {
    // 컨벤션 01: 컴포넌트는 PascalCase, 훅은 use-로 시작하는 kebab-case
    files: ["src/components/**/*.tsx"],
    rules: {
      "check-file/filename-naming-convention": ["error", { "**/*.tsx": "PASCAL_CASE" }],
    },
  },
  {
    // demo/scripts는 Next 밖에서 node로 바로 실행하는 .mjs라 @/ 별칭을 쓸 수 없다. 이 규칙만 끈다.
    files: ["demo/scripts/**/*.mjs"],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/sdk.js", "playwright-report/**", "test-results/**", "demo/raw/**", "demo/build/**", "demo/cards/**", ".claude/**", "demo/v2/refs/**", "demo/v2/analysis/**", "demo/v2/remotion/**"]),
]);

export default eslintConfig;
