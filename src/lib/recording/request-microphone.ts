import { findPreferredMicrophone } from "@/lib/recording/pick-microphone";

const SILENCE_CHECK_DELAY_MS = 4_000;
const SILENCE_SAMPLE_INTERVAL_MS = 150;
// 정규화된 파형 RMS. 조용한 방의 내장 마이크도 0.002 이상은 나온다.
const SILENT_RMS = 0.0005;

// 마이크 권한을 받은 뒤 장치 이름을 보고, 가상 마이크가 잡혔으면 실제 마이크로 다시 연다.
export async function requestMicrophone(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const currentDeviceId = stream.getAudioTracks()[0]?.getSettings().deviceId;
  const preferredDeviceId = findPreferredMicrophone(await navigator.mediaDevices.enumerateDevices().catch(() => []));
  if (!preferredDeviceId || preferredDeviceId === currentDeviceId) {
    return stream;
  }
  try {
    const preferredStream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: preferredDeviceId } } });
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return preferredStream;
  } catch {
    return stream;
  }
}

// 말소리 RMS는 보통 0.02~0.1이다. 막대 표시용으로 0..1에 펼친다.
const FULL_LEVEL_RMS = 0.08;

export function getRms(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  return samples.length > 0 ? Math.sqrt(sum / samples.length) : 0;
}

export function toMicrophoneLevel(rms: number): number {
  if (rms < SILENT_RMS) {
    return 0;
  }
  return Math.min(1, Math.sqrt(rms / FULL_LEVEL_RMS));
}

export function isSilentRms(rms: number): boolean {
  return rms < SILENT_RMS;
}

type MicrophoneWatchHandlers = {
  // 녹화 시작 후 몇 초 동안 소리가 전혀 없으면 한 번 부른다.
  onSilent: () => void;
  // 알약의 음량 막대용. 0..1.
  onLevel: (level: number) => void;
};

// 녹화하는 동안 마이크 입력 음량을 계속 알리고, 처음 몇 초가 무음이면 한 번 알린다. 돌려주는 함수로 정리한다.
export function watchMicrophone(stream: MediaStream, { onSilent, onLevel }: MicrophoneWatchHandlers): () => void {
  const AudioContextClass = window.AudioContext;
  if (!AudioContextClass) {
    return () => undefined;
  }
  const audioContext = new AudioContextClass();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  audioContext.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  let loudestRms = 0;

  const sampleTimer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    const rms = getRms(samples);
    loudestRms = Math.max(loudestRms, rms);
    onLevel(toMicrophoneLevel(rms));
  }, SILENCE_SAMPLE_INTERVAL_MS);

  const checkTimer = window.setTimeout(() => {
    if (isSilentRms(loudestRms)) {
      onSilent();
    }
  }, SILENCE_CHECK_DELAY_MS);

  return () => {
    window.clearInterval(sampleTimer);
    window.clearTimeout(checkTimer);
    void audioContext.close().catch(() => undefined);
  };
}
