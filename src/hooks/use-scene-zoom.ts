"use client";

import { useState, type CSSProperties, type SyntheticEvent } from "react";
import { getFitTransform, getFocusTransform, toCssTransform } from "@/lib/geometry/focus-transform";
import type { HighlightBox } from "@/types/feedback";

// 장면 창은 16:9. 장면 이미지 비율은 불러온 뒤에 알 수 있어 그 전에는 녹화 화면에 흔한 16:10으로 둔다.
const FRAME_ASPECT = 16 / 9;
const DEFAULT_IMAGE_ASPECT = 16 / 10;

export type SceneZoom = {
  isZoomed: boolean;
  toggleZoom: () => void;
  canvasStyle: CSSProperties;
  handleImageLoad: (event: SyntheticEvent<HTMLImageElement>) => void;
};

// 장면 이미지 확대 상태. 기본은 가리킨 곳을 크게, 끄면 장면 전체가 창 안에 보인다.
export function useSceneZoom(highlight: HighlightBox | null): SceneZoom {
  const [isZoomed, setIsZoomed] = useState(true);
  const [imageAspect, setImageAspect] = useState(DEFAULT_IMAGE_ASPECT);
  const aspect = { image: imageAspect, container: FRAME_ASPECT };
  const transform = isZoomed && highlight ? getFocusTransform(highlight, aspect) : getFitTransform(aspect);

  return {
    isZoomed,
    toggleZoom: () => setIsZoomed((current) => !current),
    canvasStyle: {
      aspectRatio: String(imageAspect),
      transform: toCssTransform(transform),
      ["--focus-scale" as string]: String(transform.scale),
    },
    handleImageLoad: (event) => {
      const { naturalWidth, naturalHeight } = event.currentTarget;
      if (naturalWidth > 0 && naturalHeight > 0) {
        setImageAspect(naturalWidth / naturalHeight);
      }
    },
  };
}
