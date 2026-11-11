"use client";

import { createContext, useContext } from "react";

// 왼쪽 목록이 불러온 대화 수와 프로젝트 키를 가운데 빈 화면과 나눠 쓴다. 아직 불러오는 중이면 null.
export type AdminConversationList = { conversationCount: number | null; projectKey: string | null };

export const AdminConversationListContext = createContext<AdminConversationList>({ conversationCount: null, projectKey: null });

export function useAdminConversationList(): AdminConversationList {
  return useContext(AdminConversationListContext);
}
