import { findPreferredMicrophone } from "@/lib/recording/pick-microphone";

const SILENCE_CHECK_DELAY_MS = 4_000;
const SILENCE_SAMPLE_INTERVAL_MS = 200;
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

function getRms(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  return Math.sqrt(sum / samples.length);
}

// 녹화 시작 후 몇 초 동안 소리가 전혀 들어오지 않으면 한 번 알린다. 확인이 끝나면 스스로 정리한다.
export function watchForSilence(stream: MediaStream, onSilent: () => void): () => void {
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
    loudestRms = Math.max(loudestRms, getRms(samples));
  }, SILENCE_SAMPLE_INTERVAL_MS);

  const cleanup = () => {
    window.clearInterval(sampleTimer);
    window.clearTimeout(checkTimer);
    void audioContext.close().catch(() => undefined);
  };
  const checkTimer = window.setTimeout(() => {
    cleanup();
    if (loudestRms < SILENT_RMS) {
      onSilent();
    }
  }, SILENCE_CHECK_DELAY_MS);
  return cleanup;
}
