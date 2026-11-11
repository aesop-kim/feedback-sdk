// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  countUnreadReplies,
  findLatestMessageTime,
  findStoredLastReadAt,
  getLastReadStorageKey,
  storeLastReadAt,
} from "@/lib/widget/unread-replies";

const messages = [
  { sender: "user" as const, createdAt: "2026-11-12T01:00:00.000Z" },
  { sender: "admin" as const, createdAt: "2026-11-12T01:01:00.000Z" },
  { sender: "system" as const, createdAt: "2026-11-12T01:02:00.000Z" },
  { sender: "user" as const, createdAt: "2026-11-12T01:03:00.000Z" },
];

describe("countUnreadReplies", () => {
  it("마지막으로 본 뒤에 온 답장·안내만 센다(고객 자신의 메시지는 빼고)", () => {
    expect(countUnreadReplies(messages, "2026-11-12T01:00:30.000Z")).toBe(2);
    expect(countUnreadReplies(messages, "2026-11-12T01:01:00.000Z")).toBe(1);
    expect(countUnreadReplies(messages, "2026-11-12T01:03:00.000Z")).toBe(0);
  });

  it("본 기록이 없으면 0", () => {
    expect(countUnreadReplies(messages, null)).toBe(0);
  });
});

describe("findLatestMessageTime", () => {
  it("가장 늦은 메시지 시각", () => {
    expect(findLatestMessageTime([messages[2], messages[0], messages[3], messages[1]])).toBe("2026-11-12T01:03:00.000Z");
  });

  it("메시지가 없으면 null", () => {
    expect(findLatestMessageTime([])).toBeNull();
  });
});

describe("lastReadAt 저장소", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("저장한 값을 새로고침 뒤에도 읽는다", () => {
    const key = getLastReadStorageKey("lattice-demo", "u_1");
    storeLastReadAt(key, "2026-11-12T01:01:00.000Z");
    expect(findStoredLastReadAt(key)).toBe("2026-11-12T01:01:00.000Z");
  });

  it("날짜가 아닌 값은 버린다", () => {
    const key = getLastReadStorageKey("lattice-demo", "u_2");
    window.localStorage.setItem(key, "not-a-date");
    expect(findStoredLastReadAt(key)).toBeNull();
  });

  it("저장소가 막혀 있어도 던지지 않는다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(findStoredLastReadAt("key")).toBeNull();
    expect(() => storeLastReadAt("key", "2026-11-12T01:01:00.000Z")).not.toThrow();
  });
});
