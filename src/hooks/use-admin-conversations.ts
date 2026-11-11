"use client";

import { useEffect, useState } from "react";
import { useAdminRequest } from "@/hooks/use-admin-request";
import type { ConversationSummary } from "@/types/feedback";

export type ConversationListResponse = {
  projectId: string | null;
  projectName: string | null;
  conversations: ConversationSummary[];
};

type ConversationListState = {
  data: ConversationListResponse | null;
  errorMessage: string | null;
};

// 받은 대화 목록. revision이 바뀔 때마다 조용히 다시 불러온다(처음 한 번만 로딩 상태).
export function useAdminConversations(revision: number) {
  const request = useAdminRequest();
  const [state, setState] = useState<ConversationListState>({ data: null, errorMessage: null });

  useEffect(() => {
    let isCancelled = false;
    void (async () => {
      const result = await request<ConversationListResponse>("/api/admin/conversations");
      if (isCancelled) {
        return;
      }
      if (result.ok) {
        setState({ data: result.body, errorMessage: null });
        return;
      }
      setState((previous) => ({ data: previous.data, errorMessage: result.message }));
    })();
    return () => {
      isCancelled = true;
    };
  }, [request, revision]);

  return {
    data: state.data,
    errorMessage: state.errorMessage,
    isLoading: state.data === null && state.errorMessage === null,
  };
}
