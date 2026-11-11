// 고객사 페이지 쪽 DOM 기록. rrweb 이벤트와 클릭·머무름 요소 정보를 위젯(iframe)으로 넘긴다.
import { record } from "@rrweb/record";
import { getElementContext } from "@/sdk/element-context";
import type { HostToWidgetMessage } from "@/sdk/bridge-protocol";

const FLUSH_INTERVAL_MS = 1_000;
const HOVER_REST_MS = 500;
export const RRWEB_BLOCK_CLASS = "rr-block";

type DomRecorderInput = {
  post: (message: HostToWidgetMessage) => void;
  isInsideSdkRoot: (target: EventTarget | null) => boolean;
};

export type DomRecorder = { start: () => void; stop: () => void; isRecording: () => boolean };

export function createDomRecorder({ post, isInsideSdkRoot }: DomRecorderInput): DomRecorder {
  let stopRrweb: (() => void) | null = null;
  let bufferedEvents: unknown[] = [];
  let eventCount = 0;
  let flushTimer: number | null = null;
  let hoverTimer: number | null = null;
  let lastHoverTarget: Element | null = null;
  let lastHoveredElement: Element | null = null;

  const flush = () => {
    if (bufferedEvents.length === 0) {
      return;
    }
    post({ type: "dom:events", payload: { events: bufferedEvents } });
    bufferedEvents = [];
  };

  const handleClick = (event: MouseEvent) => {
    if (isInsideSdkRoot(event.target) || !(event.target instanceof Element)) {
      return;
    }
    post({ type: "dom:click", payload: { epochMs: Date.now(), context: getElementContext(event.target) } });
  };

  const handleHoverRest = () => {
    hoverTimer = null;
    const element = lastHoverTarget;
    if (!element || element === lastHoveredElement || !element.isConnected) {
      return;
    }
    lastHoveredElement = element;
    const context = getElementContext(element);
    record.addCustomEvent("element-context", context);
    post({ type: "dom:context", payload: { epochMs: Date.now(), context } });
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (isInsideSdkRoot(event.target) || !(event.target instanceof Element)) {
      return;
    }
    lastHoverTarget = event.target;
    if (hoverTimer !== null) {
      window.clearTimeout(hoverTimer);
    }
    hoverTimer = window.setTimeout(handleHoverRest, HOVER_REST_MS);
  };

  const start = () => {
    if (stopRrweb) {
      return;
    }
    bufferedEvents = [];
    eventCount = 0;
    lastHoveredElement = null;
    stopRrweb =
      record({
        emit: (event) => {
          bufferedEvents.push(event);
          eventCount += 1;
        },
        sampling: { mousemove: 50, scroll: 150 },
        blockClass: RRWEB_BLOCK_CLASS,
        recordCanvas: false,
        inlineImages: false,
      }) ?? null;
    flushTimer = window.setInterval(flush, FLUSH_INTERVAL_MS);
    window.addEventListener("click", handleClick, true);
    window.addEventListener("mousemove", handleMouseMove, true);
  };

  const stop = () => {
    window.removeEventListener("click", handleClick, true);
    window.removeEventListener("mousemove", handleMouseMove, true);
    if (hoverTimer !== null) {
      window.clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    if (flushTimer !== null) {
      window.clearInterval(flushTimer);
      flushTimer = null;
    }
    stopRrweb?.();
    stopRrweb = null;
    flush();
    post({ type: "dom:stopped", payload: { eventCount } });
  };

  return { start, stop, isRecording: () => stopRrweb !== null };
}
