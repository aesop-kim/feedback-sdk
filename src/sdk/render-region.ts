import html2canvas from "html2canvas-pro";
import { CAPTURE_MIME_TYPE, MAX_CAPTURE_BYTES, MAX_CAPTURE_EDGE } from "@/sdk/capture-image";
import type { CaptureRegion } from "@/sdk/select-region";


export async function renderRegion(region: CaptureRegion, scrollX: number, scrollY: number): Promise<Blob> {
  const { x, y, width, height } = region;
  let removeClone = () => {};
  try {
    const canvas = await html2canvas(document.documentElement, {
      x: x + scrollX,
      y: y + scrollY,
      scrollX,
      scrollY,
      width,
      height,
      scale: Math.min(window.devicePixelRatio, MAX_CAPTURE_EDGE / Math.max(width, height)),
      logging: false,
      imageTimeout: 3_000,
      // 중첩 프레임, 비밀번호, 녹화에서 이미 가리는 영역과 고객사가 지정한 요소를 제외한다.
      ignoreElements: (element) =>
        element.matches('iframe, input[type="password"], .rr-block, [data-feedback-capture-ignore]'),
      onclone: (clonedDocument) => {
        const cloneFrame = clonedDocument.defaultView?.frameElement;
        removeClone = () => cloneFrame?.remove();
      },
    });
    const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, CAPTURE_MIME_TYPE, 0.86));
    if (!image || image.type !== CAPTURE_MIME_TYPE || image.size > MAX_CAPTURE_BYTES) {
      throw new Error("화면 이미지를 만들지 못했어요.");
    }
    return image;
  } finally {
    removeClone();
  }
}
