// 화면+마이크 녹화 세션. React·위치(iframe/고객사 페이지/확장)에 묶이지 않게 MediaStream만 받는다.
import fixWebmDuration from "fix-webm-duration";
import {
  FRAME_JPEG_QUALITY,
  canCaptureFrame,
  getFrameTime,
  getScaledFrameSize,
  getUniqueFrameTime,
  isClickTooSoon,
  type FrameReason,
  type FrameRecord,
} from "@/lib/recording/frame-capturer";

const VIDEO_MIME_TYPES = ["video/webm;codecs=vp8,opus", "video/webm"];
const AUDIO_MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm"];
const VIDEO_BITS_PER_SECOND = 1_200_000;
const AUDIO_BITS_PER_SECOND = 32_000;
const RECORDER_TIMESLICE_MS = 1_000;

export type CapturedFrame = FrameRecord & { blob: Blob };

export type CaptureResult = {
  videoBlob: Blob;
  audioBlob: Blob;
  frames: CapturedFrame[];
  t0: number;
  audioOffsetMs: number;
  durationMs: number;
};

export type CaptureSession = {
  readonly t0: number;
  requestFrame(reason: "click", epochMs: number): void;
  stop(): Promise<CaptureResult>;
  onAutoStop(listener: () => void): void;
};

type CaptureSessionInput = {
  displayStream: MediaStream;
  microphoneStream: MediaStream;
  maxDurationMs: number;
  frameIntervalMs: number;
};

function findSupportedMimeType(candidates: string[]): string | undefined {
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

type RecorderHandle = { recorder: MediaRecorder; chunks: Blob[]; started: Promise<number>; stopped: Promise<void> };

function createRecorder(stream: MediaStream, mimeTypes: string[], bitsPerSecond: { video?: number; audio: number }): RecorderHandle {
  const mimeType = findSupportedMimeType(mimeTypes);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: bitsPerSecond.video,
    audioBitsPerSecond: bitsPerSecond.audio,
  });
  const chunks: Blob[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });
  const started = new Promise<number>((resolve) => recorder.addEventListener("start", () => resolve(Date.now()), { once: true }));
  const stopped = new Promise<void>((resolve) => recorder.addEventListener("stop", () => resolve(), { once: true }));
  return { recorder, chunks, started, stopped };
}

// 화면 공유 트랙을 숨김(display:none) 없이 1px 비디오로 재생해야 프레임이 계속 갱신된다.
function createFrameSourceVideo(videoTrack: MediaStreamTrack): HTMLVideoElement {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("aria-hidden", "true");
  Object.assign(video.style, {
    position: "fixed",
    left: "0",
    bottom: "0",
    width: "1px",
    height: "1px",
    opacity: "0.01",
    pointerEvents: "none",
  });
  video.srcObject = new MediaStream([videoTrack]);
  document.body.append(video);
  void video.play().catch(() => undefined);
  return video;
}

function drawFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<Blob | null> {
  const size = getScaledFrameSize(video.videoWidth, video.videoHeight);
  const context = canvas.getContext("2d");
  if (size.width === 0 || !context) {
    return Promise.resolve(null);
  }
  canvas.width = size.width;
  canvas.height = size.height;
  context.drawImage(video, 0, 0, size.width, size.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", FRAME_JPEG_QUALITY));
}

export function startCaptureSession(input: CaptureSessionInput): CaptureSession {
  const { displayStream, microphoneStream, maxDurationMs, frameIntervalMs } = input;
  const [displayVideoTrack] = displayStream.getVideoTracks();
  const [microphoneTrack] = microphoneStream.getAudioTracks();
  if (!displayVideoTrack || !microphoneTrack) {
    throw new Error("화면 또는 마이크 트랙이 없어요.");
  }

  const videoHandle = createRecorder(new MediaStream([displayVideoTrack, microphoneTrack]), VIDEO_MIME_TYPES, {
    video: VIDEO_BITS_PER_SECOND,
    audio: AUDIO_BITS_PER_SECOND,
  });
  const audioHandle = createRecorder(new MediaStream([microphoneTrack]), AUDIO_MIME_TYPES, { audio: AUDIO_BITS_PER_SECOND });

  let t0 = Date.now();
  let audioStartedAt = t0;
  void videoHandle.started.then((startedAt) => {
    t0 = startedAt;
  });
  void audioHandle.started.then((startedAt) => {
    audioStartedAt = startedAt;
  });

  const frameVideo = createFrameSourceVideo(displayVideoTrack);
  const canvas = document.createElement("canvas");
  const frames: CapturedFrame[] = [];
  const pendingCaptures = new Set<Promise<void>>();
  const autoStopListeners: (() => void)[] = [];
  let isStopping = false;
  let stopPromise: Promise<CaptureResult> | null = null;

  const captureFrame = (reason: FrameReason, epochMs: number) => {
    if (isStopping || !canCaptureFrame(frames, reason)) {
      return;
    }
    const elapsedMs = getFrameTime(epochMs, t0);
    if (reason === "click" && isClickTooSoon(frames, elapsedMs)) {
      return;
    }
    const tMs = getUniqueFrameTime(frames, reason, elapsedMs);
    // 자리를 먼저 잡아 둬야 비동기 인코딩 중 들어온 요청과 이름이 겹치지 않는다.
    const placeholder: CapturedFrame = { tMs, reason, blob: new Blob() };
    frames.push(placeholder);
    const capture = drawFrame(frameVideo, canvas)
      .then((blob) => {
        if (blob) {
          placeholder.blob = blob;
          return;
        }
        frames.splice(frames.indexOf(placeholder), 1);
      })
      .catch(() => {
        frames.splice(frames.indexOf(placeholder), 1);
      })
      .finally(() => pendingCaptures.delete(capture));
    pendingCaptures.add(capture);
  };

  const notifyAutoStop = () => {
    if (isStopping) {
      return;
    }
    for (const listener of autoStopListeners) {
      listener();
    }
  };

  const handleFirstFrame = () => captureFrame("interval", Date.now());
  frameVideo.addEventListener("loadeddata", handleFirstFrame, { once: true });
  const intervalTimer = window.setInterval(() => captureFrame("interval", Date.now()), frameIntervalMs);
  const maxDurationTimer = window.setTimeout(notifyAutoStop, maxDurationMs);
  displayVideoTrack.addEventListener("ended", notifyAutoStop);
  microphoneTrack.addEventListener("ended", notifyAutoStop);

  videoHandle.recorder.start(RECORDER_TIMESLICE_MS);
  audioHandle.recorder.start(RECORDER_TIMESLICE_MS);

  const stopRecorder = async (handle: RecorderHandle) => {
    if (handle.recorder.state !== "inactive") {
      handle.recorder.stop();
    }
    await handle.stopped;
  };

  const stop = async (): Promise<CaptureResult> => {
    isStopping = true;
    window.clearInterval(intervalTimer);
    window.clearTimeout(maxDurationTimer);
    displayVideoTrack.removeEventListener("ended", notifyAutoStop);
    microphoneTrack.removeEventListener("ended", notifyAutoStop);

    const stoppedAt = Date.now();
    await Promise.all([stopRecorder(videoHandle), stopRecorder(audioHandle), ...pendingCaptures]);

    frameVideo.srcObject = null;
    frameVideo.remove();
    for (const track of [...displayStream.getTracks(), ...microphoneStream.getTracks()]) {
      track.stop();
    }

    const durationMs = Math.max(1, stoppedAt - t0);
    const videoType = videoHandle.recorder.mimeType || "video/webm";
    const audioType = audioHandle.recorder.mimeType || "audio/webm";
    const [videoBlob, audioBlob] = await Promise.all([
      fixWebmDuration(new Blob(videoHandle.chunks, { type: videoType }), durationMs, { logger: false }),
      fixWebmDuration(new Blob(audioHandle.chunks, { type: audioType }), stoppedAt - audioStartedAt, { logger: false }),
    ]);

    return {
      videoBlob,
      audioBlob,
      frames: frames.filter((frame) => frame.blob.size > 0).sort((first, second) => first.tMs - second.tMs),
      t0,
      audioOffsetMs: Math.round(audioStartedAt - t0),
      durationMs,
    };
  };

  return {
    get t0() {
      return t0;
    },
    requestFrame: (reason, epochMs) => captureFrame(reason, epochMs),
    stop: () => {
      stopPromise = stopPromise ?? stop();
      return stopPromise;
    },
    onAutoStop: (listener) => {
      autoStopListeners.push(listener);
    },
  };
}
