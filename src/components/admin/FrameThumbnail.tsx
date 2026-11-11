import styles from "@/components/admin/FrameThumbnail.module.css";
import { formatDuration } from "@/lib/format/duration-format";
import type { HighlightBox } from "@/types/feedback";

type FrameThumbnailProps = {
  frameUrl: string | null;
  highlight: HighlightBox | null;
  tMs: number;
  onSeek: (milliseconds: number) => void;
};

function toPercent(value: number): string {
  return `${Math.min(Math.max(value, 0), 1) * 100}%`;
}

// 문제 장면. 누르면 영상을 그 시점부터 재생한다.
export function FrameThumbnail({ frameUrl, highlight, tMs, onSeek }: FrameThumbnailProps) {
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
    <button type="button" className={styles.frame} onClick={() => onSeek(tMs)} aria-label={`${timestamp} 장면부터 영상 보기`}>
      {/* 비공개 저장소의 서명 URL이라 next/image 최적화 대신 그대로 그린다. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.image} src={frameUrl} alt="" loading="lazy" />
      {highlight ? (
        <span
          className={styles.highlight}
          style={{
            left: toPercent(highlight.x),
            top: toPercent(highlight.y),
            width: toPercent(highlight.width),
            height: toPercent(highlight.height),
          }}
          aria-hidden="true"
        />
      ) : null}
      <span className={styles.timestamp}>
        <PlayIcon />
        <span className={styles.number}>{timestamp}</span>
      </span>
    </button>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 1.8v8.4a.6.6 0 0 0 .9.5l6.6-4.2a.6.6 0 0 0 0-1L3.9 1.3a.6.6 0 0 0-.9.5Z" fill="currentColor" />
    </svg>
  );
}
