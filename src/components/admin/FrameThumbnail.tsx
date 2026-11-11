"use client";

import styles from "@/components/admin/FrameThumbnail.module.css";
import { useSceneZoom } from "@/hooks/use-scene-zoom";
import { formatDuration } from "@/lib/format/duration-format";
import { toHighlightStyle } from "@/lib/geometry/focus-transform";
import type { HighlightBox } from "@/types/feedback";

type FrameThumbnailProps = {
  frameUrl: string | null;
  highlight: HighlightBox | null;
  tMs: number;
  onSeek: (milliseconds: number) => void;
};

// 문제 장면. 기본은 가리킨 곳을 크게 보여 주고, 장면을 누르면 영상을 그 시점부터 재생한다.
export function FrameThumbnail({ frameUrl, highlight, tMs, onSeek }: FrameThumbnailProps) {
  const { isZoomed, toggleZoom, canvasStyle, handleImageLoad } = useSceneZoom(highlight);
  const timestamp = formatDuration(tMs);

  if (!frameUrl) {
    return (
      <button type="button" className={styles.noFrame} onClick={() => onSeek(tMs)}>
        <PlayIcon />
        <span>
          <span className={styles.number}>{timestamp}</span> 장면부터 보기
        </span>
      </button>
    );
  }

  return (
    <div className={styles.frame}>
      <button type="button" className={styles.scene} onClick={() => onSeek(tMs)} aria-label={`${timestamp} 장면부터 영상 보기`}>
        <span className={styles.canvas} style={canvasStyle}>
          {/* 비공개 저장소의 서명 URL이라 next/image 최적화 대신 그대로 그린다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.image}
            src={frameUrl}
            alt=""
            loading="lazy"
            onLoad={handleImageLoad}
          />
          {highlight ? <span className={styles.highlight} style={toHighlightStyle(highlight)} aria-hidden="true" /> : null}
        </span>
        <span className={styles.timestamp}>
          <PlayIcon />
          <span className={styles.number}>{timestamp}</span>
        </span>
      </button>
      {highlight ? (
        // 보이는 이름이 상태에 따라 바뀌므로 aria-pressed는 두지 않는다(둘 다 두면 "전체 보기, 눌림 아님"처럼 어긋난다).
        <button type="button" className={styles.zoomToggle} onClick={toggleZoom}>
          {isZoomed ? "전체 보기" : "크게 보기"}
        </button>
      ) : null}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 1.8v8.4a.6.6 0 0 0 .9.5l6.6-4.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5Z" fill="currentColor" />
    </svg>
  );
}
