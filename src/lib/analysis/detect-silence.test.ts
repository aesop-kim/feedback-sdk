import { describe, expect, it } from "vitest";
import { findMeanVolumeDb, isSilentAudio } from "@/lib/analysis/detect-silence";

describe("findMeanVolumeDb", () => {
  it("volumedetect 출력에서 평균 볼륨을 읽는다", () => {
    const output = "[Parsed_volumedetect_0 @ 0x1] mean_volume: -70.4 dB\n[Parsed_volumedetect_0 @ 0x1] max_volume: -34.5 dB";
    expect(findMeanVolumeDb(output)).toBe(-70.4);
  });

  it("완전 무음(-inf)과 값이 없는 출력을 구분한다", () => {
    expect(findMeanVolumeDb("mean_volume: -inf dB")).toBe(Number.NEGATIVE_INFINITY);
    expect(findMeanVolumeDb("no audio")).toBeNull();
  });
});

describe("isSilentAudio", () => {
  it("가상 마이크로 녹음된 무음은 걸러낸다", () => {
    expect(isSilentAudio(-91)).toBe(true);
    expect(isSilentAudio(-70.4)).toBe(true);
    expect(isSilentAudio(Number.NEGATIVE_INFINITY)).toBe(true);
  });

  it("조용한 방이나 말소리는 통과시킨다", () => {
    expect(isSilentAudio(-54.7)).toBe(false);
    expect(isSilentAudio(-28)).toBe(false);
    expect(isSilentAudio(null)).toBe(false);
  });
});
