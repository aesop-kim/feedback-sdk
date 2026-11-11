// 관리자 로그인 실패 횟수 제한(IP별).
// 주의: 메모리에만 두므로 서버 인스턴스마다 따로 센다. Vercel 함수 인스턴스가 여러 개 뜨거나 새로 뜨면
// 제한이 나뉘거나 초기화된다. 공유 비밀번호 무차별 대입을 늦추는 최소 장치이고, 확실히 막으려면 DB/KV에 둬야 한다.

type FailureRecord = { count: number; windowStartedAt: number };

export type LoginRateLimiter = {
  // 막혀 있으면 다시 시도할 수 있을 때까지 남은 ms, 아니면 0.
  getBlockedMs(key: string, now: number): number;
  recordFailure(key: string, now: number): void;
  reset(key: string): void;
};

const MAX_TRACKED_KEYS = 10_000;

export function createLoginRateLimiter(options: { maxFailures: number; windowMs: number }): LoginRateLimiter {
  const failures = new Map<string, FailureRecord>();

  const findActiveRecord = (key: string, now: number): FailureRecord | null => {
    const record = failures.get(key);
    if (!record) {
      return null;
    }
    if (now - record.windowStartedAt >= options.windowMs) {
      failures.delete(key);
      return null;
    }
    return record;
  };

  const pruneExpired = (now: number) => {
    for (const [key, record] of failures) {
      if (now - record.windowStartedAt >= options.windowMs) {
        failures.delete(key);
      }
    }
  };

  return {
    getBlockedMs(key, now) {
      const record = findActiveRecord(key, now);
      if (!record || record.count < options.maxFailures) {
        return 0;
      }
      return record.windowStartedAt + options.windowMs - now;
    },
    recordFailure(key, now) {
      const record = findActiveRecord(key, now);
      if (record) {
        record.count += 1;
        return;
      }
      if (failures.size >= MAX_TRACKED_KEYS) {
        pruneExpired(now);
      }
      failures.set(key, { count: 1, windowStartedAt: now });
    },
    reset(key) {
      failures.delete(key);
    },
  };
}

// Vercel은 x-forwarded-for 맨 앞에 실제 접속 IP를 넣는다. 로컬처럼 헤더가 없으면 한 덩어리로 센다.
export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || headers.get("x-real-ip")?.trim() || "unknown";
}
