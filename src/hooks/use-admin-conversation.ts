"use client";

import { useEffect, useState } from "react";
import { useAdminRequest } from "@/hooks/use-admin-request";
import type { ConversationDetail, RecordingDetail } from "@/types/feedback";

type ConversationDetailState = {
  conversationId: string;
  detail: ConversationDetail | null;
  errorMessage: string | null;
};

// 서명 URL은 다시 불러올 때마다 토큰이 바뀐다. 같은 녹화·이슈라면 처음 받은 URL을 그대로 써서
// 영상을 다시 받거나 장면 이미지가 깜빡이지 않게 한다.
function keepSignedUrls(previous: ConversationDetail | null, next: ConversationDetail): ConversationDetail {
  if (!previous) {
    return next;
  }
  const previousRecordings = new Map(previous.recordings.map((recording) => [recording.id, recording]));
  const recordings = next.recordings.map((recording): RecordingDetail => {
    const previousRecording = previousRecordings.get(recording.id);
    if (!previousRecording) {
      return recording;
    }
    const previousFrameUrls = new Map(previousRecording.issues.map((issue) => [issue.id, issue.frameUrl]));
    return {
      ...recording,
      videoUrl: previousRecording.videoUrl ?? recording.videoUrl,
      issues: recording.issues.map((issue) => ({ ...issue, frameUrl: previousFrameUrls.get(issue.id) ?? issue.frameUrl })),
    };
  });
  return { ...next, recordings };
}

// 열린 대화 하나(메시지 + 녹화 분석). revision이 바뀌면 조용히 다시 불러온다.
export function useAdminConversation(conversationId: string, revision: number) {
  const request = useAdminRequest();
  const [state, setState] = useState<ConversationDetailState>({ conversationId, detail: null, errorMessage: null });

  useEffect(() => {
    let isCancelled = false;
    void (async () => {
      const result = await request<{ conversation: ConversationDetail }>(`/api/admin/conversations/${conversationId}`);
      if (isCancelled) {
        return;
      }
      setState((previous) => {
        const previousDetail = previous.conversationId === conversationId ? previous.detail : null;
        if (result.ok) {
          return { conversationId, detail: keepSignedUrls(previousDetail, result.body.conversation), errorMessage: null };
        }
        return { conversationId, detail: previousDetail, errorMessage: result.message };
      });
    })();
    return () => {
      isCancelled = true;
    };
  }, [conversationId, request, revision]);

  const isCurrent = state.conversationId === conversationId;
  const detail = isCurrent ? state.detail : null;
  const errorMessage = isCurrent ? state.errorMessage : null;
  return { detail, errorMessage, isLoading: detail === null && errorMessage === null };
}
