"use client";

import { useImperativeHandle, useRef, type Ref } from "react";
import styles from "@/components/admin/RecordingPlayer.module.css";
import { useAdminVideoBlob } from "@/hooks/use-admin-video-blob";
import { formatDuration } from "@/lib/format/duration-format";
import type { RecordingDetail } from "@/types/feedback";

export type RecordingPlayerHandle = { seekTo: (milliseconds: number) => void };

type RecordingPlayerProps = {
  ref: Ref<RecordingPlayerHandle>;
  recording: Pick<RecordingDetail, "id" | "videoUrl" | "durationMs" | "pageTitle" | "pageUrl">;
};

function getReadablePageUrl(pageUrl: string | null): string | null {
  if (!pageUrl) {
    return null;
  }
  try {
    const url = new URL(pageUrl);
    return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return pageUrl;
  }
}

export function RecordingPlayer({ ref, recording }: RecordingPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const { blobUrl, hasFailed, isLoading } = useAdminVideoBlob(recording.id, recording.videoUrl);

  function playFrom(video: HTMLVideoElement, milliseconds: number) {
    video.currentTime = milliseconds / 1000;
    void video.play().catch(() => null);
  }

  useImperativeHandle(ref, () => ({
    seekTo(milliseconds: number) {
      const video = videoRef.current;
      if (!video || video.readyState === 0) {
        pendingSeekRef.current = milliseconds;
        return;
      }
      playFrom(video, milliseconds);
    },
  }));

  const readableUrl = getReadablePageUrl(recording.pageUrl);

  return (
    <div className={styles.player}>
      <div className={styles.frame}>
        {blobUrl ? (
          <video
            ref={videoRef}
            className={styles.video}
            src={blobUrl}
            controls
            playsInline
            preload="auto"
            onLoadedMetadata={(event) => {
              if (pendingSeekRef.current !== null) {
                playFrom(event.currentTarget, pendingSeekRef.current);
                pendingSeekRef.current = null;
              }
            }}
          />
        ) : (
          <p className={styles.placeholder}>
            <VideoPlaceholderText hasVideo={Boolean(recording.videoUrl)} isLoading={isLoading} hasFailed={hasFailed} />
          </p>
        )}
      </div>
      <div className={styles.caption}>
        <div className={styles.page}>
          <span className={styles.pageTitle}>{recording.pageTitle || "제목 없는 페이지"}</span>
          {readableUrl ? <span className={styles.pageUrl}>{readableUrl}</span> : null}
        </div>
        <span className={styles.duration}>{formatDuration(recording.durationMs)}</span>
      </div>
    </div>
  );
}

function VideoPlaceholderText({ hasVideo, isLoading, hasFailed }: { hasVideo: boolean; isLoading: boolean; hasFailed: boolean }) {
  if (!hasVideo) {
    return "영상 파일이 없어요";
  }
  if (hasFailed) {
    return "영상을 불러오지 못했어요";
  }
  if (isLoading) {
    return "영상을 불러오고 있어요";
  }
  return null;
}
