"use client";

import { useId, useState } from "react";
import styles from "@/components/admin/TranscriptSection.module.css";
import { formatDuration } from "@/lib/format/duration-format";
import type { TranscriptSegment } from "@/types/feedback";

export function TranscriptSection({ segments, onSeek }: { segments: TranscriptSegment[]; onSeek: (milliseconds: number) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();

  return (
    <section className={styles.section}>
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls={listId}
      >
        <span className={styles.heading}>말한 내용</span>
        <span className={styles.count}>{segments.length}</span>
        <svg
          className={isOpen ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="m3.5 6 4.5 4.5L12.5 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen ? (
        <div id={listId}>
          {segments.length === 0 ? (
            <p className={styles.empty}>알아들은 말이 없어요. 영상으로 확인해 주세요.</p>
          ) : (
            <ol className={styles.segments}>
              {segments.map((segment) => (
                <li key={`${segment.startMs}-${segment.endMs}`} className={styles.segment}>
                  <button
                    type="button"
                    className={styles.timestamp}
                    onClick={() => onSeek(segment.startMs)}
                    aria-label={`${formatDuration(segment.startMs)}부터 영상 보기`}
                  >
                    {formatDuration(segment.startMs)}
                  </button>
                  <p className={styles.text}>{segment.text}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </section>
  );
}
