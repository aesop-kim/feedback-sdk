// Supabase는 조인한 관계 컬럼을 객체 하나로도, 배열로도 돌려준다. 어느 쪽이든 첫 행을 꺼낸다.

type Relation<TRow> = TRow | TRow[] | null | undefined;

export function findFirstRelation<TRow>(relation: Relation<TRow>): TRow | undefined {
  if (Array.isArray(relation)) {
    return relation[0];
  }
  return relation ?? undefined;
}

// `!inner` 조인처럼 관계 행이 반드시 있는 경우.
export function getFirstRelation<TRow>(relation: Relation<TRow>): TRow {
  const row = findFirstRelation(relation);
  if (row === undefined) {
    throw new Error("조인한 관계 행이 없어요.");
  }
  return row;
}
