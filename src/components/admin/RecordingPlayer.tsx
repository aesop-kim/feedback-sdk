"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import styles from "@/components/admin/RecordingPlayer.module.css";
import { useAdminVideoBlob } from "@/hooks/use-admin-video-blob";
import { formatDuration } from "@/lib/format/duration-format";
import type { RecordingDetail } from "@/types/feedback";

export type RecordingPlayerHandle = { seekTo: (milliseconds: number) => void };

type RecordingPlayerProps = {
  ref: Ref<RecordingPlayerHandle>;
  recording: Pick<RecordingDetail, "id" | "videoUrl" | "durationMs" | "pageTitle" | "pageUrl">;
};

function findReadablePageUrl(pageUrl: string | null): string | null {
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
  const playerElementRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingSeekRef = useRef<number | null>(null);
  // 재생 전에는 기본 컨트롤(로딩 스피너·어두운 그라데이션)을 숨기고 첫 장면만 차분히 보여 준다.
  const [hasStarted, setHasStarted] = useState(false);
  const { blobUrl, hasFailed, isLoading } = useAdminVideoBlob(recording.id, recording.videoUrl);

  function playFrom(video: HTMLVideoElement, milliseconds: number) {
    setHasStarted(true);
    video.currentTime = milliseconds / 1000;
    void video.play().catch(() => null);
  }

  function startPlaying() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setHasStarted(true);
    void video.play().catch(() => null);
  }

  useImperativeHandle(ref, () => ({
    seekTo(milliseconds: number) {
      // 플레이어가 고정되지 않은 화면에서는 스크롤해 온 위치에서 영상이 보이지 않으므로 끌어온다.
      playerElementRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const video = videoRef.current;
      if (!video || video.readyState === 0) {
        pendingSeekRef.current = milliseconds;
        return;
      }
      playFrom(video, milliseconds);
    },
  }));

  const readableUrl = findReadablePageUrl(recording.pageUrl);

  return (
    <div ref={playerElementRef} className={styles.player}>
      <div className={styles.frame} data-state={getFrameState(Boolean(blobUrl), isLoading)}>
        {blobUrl ? (
          <>
            <video
              ref={videoRef}
              className={styles.video}
              src={blobUrl}
              controls={hasStarted}
              playsInline
              preload="auto"
              onPlay={() => setHasStarted(true)}
              onLoadedMetadata={(event) => {
                if (pendingSeekRef.current !== null) {
                  playFrom(event.currentTarget, pendingSeekRef.current);
                  pendingSeekRef.current = null;
                }
              }}
            />
            {hasStarted ? null : (
              <button type="button" className={styles.playButton} onClick={startPlaying} aria-label="영상 재생하기">
                <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M6 3.9v12.2a.9.9 0 0 0 1.37.77l9.75-6.1a.9.9 0 0 0 0-1.54L7.37 3.13A.9.9 0 0 0 6 3.9Z" fill="currentColor" />
                </svg>
              </button>
            )}
          </>
        ) : (
          <p className={styles.placeholder} role={isLoading ? "status" : undefined}>
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

function getFrameState(hasBlob: boolean, isLoading: boolean): "ready" | "loading" | "empty" {
  if (hasBlob) {
    return "ready";
  }
  if (isLoading) {
    return "loading";
  }
  return "empty";
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
