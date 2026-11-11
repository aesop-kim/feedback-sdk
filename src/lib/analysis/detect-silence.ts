// whisper는 무음을 받으면 "한글자막 by …" 같은 문장을 지어낸다. 받아쓰기 전에 ffmpeg volumedetect로 걸러낸다.

// 조용한 방의 내장 마이크도 평균 -55dB 안팎이 나온다. 이보다 한참 낮으면 마이크 입력이 없었던 것이다.
const SILENT_MEAN_VOLUME_DB = -60;

export function findMeanVolumeDb(volumedetectOutput: string): number | null {
  const match = /mean_volume:\s*(-?[\d.]+|-inf) dB/.exec(volumedetectOutput);
  if (!match) {
    return null;
  }
  return match[1] === "-inf" ? Number.NEGATIVE_INFINITY : Number(match[1]);
}

export function isSilentAudio(meanVolumeDb: number | null): boolean {
  return meanVolumeDb !== null && meanVolumeDb < SILENT_MEAN_VOLUME_DB;
}
