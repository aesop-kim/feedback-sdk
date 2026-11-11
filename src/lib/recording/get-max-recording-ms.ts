import { MAX_RECORDING_MS } from "@/lib/validation/api-schemas";

const MIN_OVERRIDE_MS = 1_000;

// 최대 녹화 시간. E2E가 3분을 기다리지 않도록 개발·테스트 서버에서만 /widget?maxRecordingMs=로 줄일 수 있다.
// 운영에서는 값을 무시하고, 늘리는 값도 받지 않는다(서버 검증 한도가 MAX_RECORDING_MS 기준이다).
export function getMaxRecordingMs(rawOverride: string | undefined, isProduction: boolean): number {
  if (isProduction || !rawOverride) {
    return MAX_RECORDING_MS;
  }
  const override = Number(rawOverride);
  if (!Number.isInteger(override) || override < MIN_OVERRIDE_MS || override > MAX_RECORDING_MS) {
    return MAX_RECORDING_MS;
  }
  return override;
}
