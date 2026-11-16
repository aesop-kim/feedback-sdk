type Point = { x: number; y: number };
export type CaptureRegion = Point & { width: number; height: number };

const MIN_EDGE = 8;
const ARROW_OFFSETS: Record<string, Point | undefined> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

function getRegion(start: Point, end: Point): CaptureRegion {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

// 네이티브 모달이 열린 동안 고객사 페이지의 클릭과 탭 이동을 막는다.
export async function selectRegion(root: ShadowRoot, signal: AbortSignal): Promise<CaptureRegion | null> {
  const dialog = document.createElement("dialog");
  dialog.className = "capture-dialog";
  dialog.setAttribute("aria-labelledby", "capture-title");
  dialog.setAttribute("aria-describedby", "capture-help");

  const selection = document.createElement("div");
  selection.className = "capture-selection";
  selection.setAttribute("aria-hidden", "true");

  const controls = document.createElement("div");
  controls.className = "capture-controls";
  controls.innerHTML = `
    <strong id="capture-title">캡처 영역 선택</strong>
    <p id="capture-help">드래그하거나 방향키로 이동해 Enter로 두 모서리를 선택해 주세요.</p>
    <div class="capture-actions">
      <button type="button" data-select aria-describedby="capture-help">시작점 선택</button>
      <button type="button" data-cancel>취소</button>
    </div>`;
  const selectButton = controls.querySelector<HTMLButtonElement>("[data-select]")!;
  const cancelButton = controls.querySelector<HTMLButtonElement>("[data-cancel]")!;
  const status = document.createElement("span");
  status.className = "capture-status";
  status.setAttribute("role", "status");
  controls.append(status);
  dialog.append(selection, controls);
  root.append(dialog);

  let start: Point | null = null;
  let cursor = { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) };
  let pointerId: number | null = null;
  const fit = ({ x, y }: Point): Point => ({
    x: Math.max(0, Math.min(window.innerWidth, Math.round(x))),
    y: Math.max(0, Math.min(window.innerHeight, Math.round(y))),
  });
  const draw = () => {
    const region = getRegion(start ?? cursor, cursor);
    selection.style.left = `${region.x}px`;
    selection.style.top = `${region.y}px`;
    selection.style.width = `${Math.max(2, region.width)}px`;
    selection.style.height = `${Math.max(2, region.height)}px`;
    selectButton.textContent = start ? "선택 완료" : "시작점 선택";
    return region;
  };
  draw();

  try {
    dialog.showModal();
    selectButton.focus({ preventScroll: true });
    return await new Promise<CaptureRegion | null>((resolve) => {
      const events = new AbortController();
      const options = { signal: events.signal };
      const finish = (region: CaptureRegion | null) => {
        events.abort();
        resolve(region);
      };
      if (signal.aborted) {
        finish(null);
        return;
      }
      signal.addEventListener("abort", () => finish(null), options);
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        finish(null);
      }, options);
      window.addEventListener("resize", () => finish(null), options);
      dialog.addEventListener("wheel", (event) => event.preventDefault(), { ...options, passive: false });
      cancelButton.addEventListener("click", () => finish(null), options);
      selectButton.addEventListener("click", () => {
        if (!start) {
          start = cursor;
          draw();
          status.textContent = "시작점을 선택했어요. 방향키로 끝점을 이동해 주세요.";
          return;
        }
        const region = draw();
        if (region.width < MIN_EDGE || region.height < MIN_EDGE) {
          status.textContent = "캡처 영역을 가로와 세로로 더 넓게 선택해 주세요.";
          return;
        }
        finish(region);
      }, options);
      dialog.addEventListener("keydown", (event) => {
        const offset = ARROW_OFFSETS[event.key];
        if (!offset) {
          return;
        }
        event.preventDefault();
        const step = event.shiftKey ? 32 : 8;
        cursor = fit({ x: cursor.x + offset.x * step, y: cursor.y + offset.y * step });
        const region = draw();
        status.textContent = start
          ? `선택 영역 ${region.width} × ${region.height} 픽셀`
          : `시작점 가로 ${cursor.x}, 세로 ${cursor.y} 픽셀`;
      }, options);
      dialog.addEventListener("pointerdown", (event) => {
        if (event.target !== dialog || event.button !== 0 || pointerId !== null) {
          return;
        }
        dialog.setPointerCapture(event.pointerId);
        pointerId = event.pointerId;
        start = cursor = fit({ x: event.clientX, y: event.clientY });
        draw();
      }, options);
      const movePointer = (event: PointerEvent) => {
        if (event.pointerId === pointerId) {
          cursor = fit({ x: event.clientX, y: event.clientY });
          draw();
        }
      };
      dialog.addEventListener("pointermove", movePointer, options);
      dialog.addEventListener("pointerup", (event) => {
        movePointer(event);
        if (event.pointerId === pointerId) {
          pointerId = null;
          selectButton.focus({ preventScroll: true });
        }
      }, options);
      dialog.addEventListener("lostpointercapture", (event) => {
        if (event.pointerId === pointerId) {
          pointerId = null;
          start = null;
          draw();
        }
      }, options);
    });
  } finally {
    dialog.close();
    dialog.remove();
  }
}
