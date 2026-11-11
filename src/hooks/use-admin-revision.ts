"use client";

import { createContext, useContext } from "react";

// 관리자 화면 전체가 공유하는 "다시 불러오기" 신호.
// 실시간 신호를 받거나 관리자가 무언가를 바꾸면 revision이 올라가고, 목록과 열린 대화가 함께 다시 불러온다.
export type AdminRevision = { revision: number; refresh: () => void };

export const AdminRevisionContext = createContext<AdminRevision>({ revision: 0, refresh: () => {} });

export function useAdminRevision(): AdminRevision {
  return useContext(AdminRevisionContext);
}
