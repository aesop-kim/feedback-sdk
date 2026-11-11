"use client";

import { useEffect, useRef, useState } from "react";

type VideoBlobState = { recordingId: string | null; blobUrl: string | null; hasFailed: boolean };

// 브라우저 MediaRecorder로 만든 webm에는 Cues(탐색 색인)가 없어 원격 URL로는 원하는 시점으로 건너뛰기가 안 된다.
// 영상을 통째로 받아 blob URL로 재생하면 자유롭게 탐색할 수 있다.
export function useAdminVideoBlob(recordingId: string | null, videoUrl: string | null) {
  const [state, setState] = useState<VideoBlobState>({ recordingId: null, blobUrl: null, hasFailed: false });
  const videoUrlRef = useRef(videoUrl);
  const hasVideoUrl = Boolean(videoUrl);

  useEffect(() => {
    videoUrlRef.current = videoUrl;
  }, [videoUrl]);

  useEffect(() => {
    const sourceUrl = videoUrlRef.current;
    if (!recordingId || !sourceUrl) {
      return;
    }
    const controller = new AbortController();
    let createdBlobUrl: string | null = null;
    void (async () => {
      try {
        const response = await fetch(sourceUrl, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`video ${response.status}`);
        }
        const blob = await response.blob();
        createdBlobUrl = URL.createObjectURL(blob);
        setState({ recordingId, blobUrl: createdBlobUrl, hasFailed: false });
      } catch {
        if (!controller.signal.aborted) {
          setState({ recordingId, blobUrl: null, hasFailed: true });
        }
      }
    })();
    return () => {
      controller.abort();
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [recordingId, hasVideoUrl]);

  const isCurrent = state.recordingId === recordingId;
  return {
    blobUrl: isCurrent ? state.blobUrl : null,
    hasFailed: isCurrent && state.hasFailed,
    isLoading: hasVideoUrl && !isCurrent,
  };
}
