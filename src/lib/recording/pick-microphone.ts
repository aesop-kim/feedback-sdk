// 컴퓨터에 Zoom·Teams·BlackHole 같은 가상 마이크가 깔려 있으면 크롬이 그쪽을 골라 무음이 녹음된다.
// 시스템 기본 마이크가 실제 장치면 그걸, 아니면 첫 번째 실제 장치를 고른다.

type MicrophoneDevice = Pick<MediaDeviceInfo, "deviceId" | "label" | "kind">;

const VIRTUAL_MICROPHONE_PATTERN = /zoom|teams|blackhole|vb-?cable|soundflower|loopback|camo|krisp|virtual|aggregate|obs/i;

export function isVirtualMicrophone(label: string): boolean {
  return VIRTUAL_MICROPHONE_PATTERN.test(label);
}

export function findPreferredMicrophone(devices: MicrophoneDevice[]): string | null {
  const microphones = devices.filter((device) => device.kind === "audioinput" && device.label !== "");
  const systemDefault = microphones.find((device) => device.deviceId === "default");
  if (systemDefault && !isVirtualMicrophone(systemDefault.label)) {
    return systemDefault.deviceId;
  }
  const realMicrophone = microphones.find(
    (device) => device.deviceId !== "default" && device.deviceId !== "communications" && !isVirtualMicrophone(device.label),
  );
  return realMicrophone?.deviceId ?? null;
}
