// 라우트 단위 테스트용 가짜 Supabase 클라이언트.
// 테이블마다 from()을 부른 순서대로 결과를 돌려준다. 쿼리 조건(eq, in …)은 기록하지 않고 체인만 이어 준다.

export type FakeResult = { data?: unknown; error?: { message: string } | null; count?: number | null };

const CHAIN_METHODS = ["select", "insert", "update", "delete", "eq", "in", "is", "not", "or", "order", "limit"] as const;

function createQueryBuilder(result: FakeResult) {
  const resolved = { data: result.data ?? null, error: result.error ?? null, count: result.count ?? null };
  const builder: Record<string, unknown> = {
    maybeSingle: () => Promise.resolve(resolved),
    single: () => Promise.resolve(resolved),
    then: (onFulfilled: (value: typeof resolved) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(resolved).then(onFulfilled, onRejected),
  };
  for (const method of CHAIN_METHODS) {
    builder[method] = () => builder;
  }
  return builder;
}

export function createFakeSupabase(resultsByTable: Record<string, FakeResult[]>, storageFiles: string[] = []) {
  const callCounts: Record<string, number> = {};
  return {
    from(table: string) {
      const index = callCounts[table] ?? 0;
      callCounts[table] = index + 1;
      const result = resultsByTable[table]?.[index];
      if (!result) {
        throw new Error(`가짜 Supabase에 ${table} ${index + 1}번째 결과가 없어요`);
      }
      return createQueryBuilder(result);
    },
    storage: {
      from: () => ({
        list: () => Promise.resolve({ data: storageFiles.map((name) => ({ name })), error: null }),
      }),
    },
  };
}
