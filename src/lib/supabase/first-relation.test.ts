import { describe, expect, it } from "vitest";
import { findFirstRelation, getFirstRelation } from "@/lib/supabase/first-relation";

describe("findFirstRelation", () => {
  it("객체면 그대로, 배열이면 첫 행", () => {
    expect(findFirstRelation({ id: "a" })).toEqual({ id: "a" });
    expect(findFirstRelation([{ id: "a" }, { id: "b" }])).toEqual({ id: "a" });
  });

  it("비었거나 없으면 undefined", () => {
    expect(findFirstRelation([])).toBeUndefined();
    expect(findFirstRelation(null)).toBeUndefined();
    expect(findFirstRelation(undefined)).toBeUndefined();
  });
});

describe("getFirstRelation", () => {
  it("행이 있으면 돌려준다", () => {
    expect(getFirstRelation([{ id: "a" }])).toEqual({ id: "a" });
  });

  it("행이 없으면 던진다", () => {
    expect(() => getFirstRelation([])).toThrow();
    expect(() => getFirstRelation(null)).toThrow();
  });
});
