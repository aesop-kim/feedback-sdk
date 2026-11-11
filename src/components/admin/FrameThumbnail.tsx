"use client";

import { useState } from "react";
import styles from "@/components/admin/FrameThumbnail.module.css";
import { formatDuration } from "@/lib/format/duration-format";
import { getFitTransform, getFocusTransform, toCssTransform, toHighlightStyle } from "@/lib/geometry/focus-transform";
import type { HighlightBox } from "@/types/feedback";

// 장면 창은 16:9. 이미지 비율은 불러온 뒤 실제 값으로 바꾼다(그 전에는 녹화 화면에 흔한 16:10).
const FRAME_ASPECT = 16 / 9;
const DEFAULT_IMAGE_ASPECT = 16 / 10;

type FrameThumbnailProps = {
  frameUrl: string | null;
  highlight: HighlightBox | null;
  tMs: number;
  onSeek: (milliseconds: number) => void;
};

// 문제 장면. 기본은 가리킨 곳을 크게 보여 주고, 장면을 누르면 영상을 그 시점부터 재생한다.
export function FrameThumbnail({ frameUrl, highlight, tMs, onSeek }: FrameThumbnailProps) {
  const [isZoomed, setIsZoomed] = useState(true);
  const [imageAspect, setImageAspect] = useState(DEFAULT_IMAGE_ASPECT);
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

  const aspect = { image: imageAspect, container: FRAME_ASPECT };
  const transform = isZoomed && highlight ? getFocusTransform(highlight, aspect) : getFitTransform(aspect);

  return (
    <div className={styles.frame}>
      <button type="button" className={styles.scene} onClick={() => onSeek(tMs)} aria-label={`${timestamp} 장면부터 영상 보기`}>
        <span
          className={styles.canvas}
          style={{
            aspectRatio: String(imageAspect),
            transform: toCssTransform(transform),
            ["--focus-scale" as string]: String(transform.scale),
          }}
        >
          {/* 비공개 저장소의 서명 URL이라 next/image 최적화 대신 그대로 그린다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.image}
            src={frameUrl}
            alt=""
            loading="lazy"
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0) {
                setImageAspect(naturalWidth / naturalHeight);
              }
            }}
          />
          {highlight ? <span className={styles.highlight} style={toHighlightStyle(highlight)} aria-hidden="true" /> : null}
        </span>
        <span className={styles.timestamp}>
          <PlayIcon />
          <span className={styles.number}>{timestamp}</span>
        </span>
      </button>
      {highlight ? (
        <button type="button" className={styles.zoomToggle} onClick={() => setIsZoomed((current) => !current)} aria-pressed={!isZoomed}>
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
