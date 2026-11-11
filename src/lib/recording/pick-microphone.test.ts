import { describe, expect, it } from "vitest";
import { findPreferredMicrophone, isVirtualMicrophone } from "@/lib/recording/pick-microphone";

const toDevice = (deviceId: string, label: string) => ({ deviceId, label, kind: "audioinput" as const });

describe("findPreferredMicrophone", () => {
  it("시스템 기본 마이크가 실제 장치면 그대로 쓴다", () => {
    const devices = [toDevice("default", "기본값 - MacBook Pro 마이크"), toDevice("zoom", "ZoomAudioDevice")];
    expect(findPreferredMicrophone(devices)).toBe("default");
  });

  it("기본값이 가상 마이크면 첫 번째 실제 장치를 고른다", () => {
    const devices = [
      toDevice("default", "기본값 - ZoomAudioDevice"),
      toDevice("zoom", "ZoomAudioDevice"),
      toDevice("blackhole", "BlackHole 16ch"),
      toDevice("builtin", "MacBook Pro 마이크"),
    ];
    expect(findPreferredMicrophone(devices)).toBe("builtin");
  });

  it("권한 전이라 이름이 비어 있거나 실제 장치가 없으면 null", () => {
    expect(findPreferredMicrophone([toDevice("a", "")])).toBeNull();
    expect(findPreferredMicrophone([toDevice("zoom", "ZoomAudioDevice")])).toBeNull();
  });

  it("오디오 출력 장치는 고르지 않는다", () => {
    expect(findPreferredMicrophone([{ deviceId: "speaker", label: "MacBook Pro 스피커", kind: "audiooutput" }])).toBeNull();
  });
});

describe("isVirtualMicrophone", () => {
  it.each(["ZoomAudioDevice", "Microsoft Teams Audio", "VB-Cable", "BlackHole 2ch", "Camo Microphone"])("%s는 가상 마이크", (label) => {
    expect(isVirtualMicrophone(label)).toBe(true);
  });

  it("내장·외장 마이크는 실제 장치", () => {
    expect(isVirtualMicrophone("MacBook Pro 마이크")).toBe(false);
    expect(isVirtualMicrophone("AirPods Pro")).toBe(false);
  });
});
