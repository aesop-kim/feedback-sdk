// 고객사 페이지에 붙는 SDK 진입점. window.Feedback.init({ projectKey, user })로 런처와 위젯 iframe을 띄운다.
import {
  createEnvelope,
  isBridgeEnvelope,
  type HostToWidgetMessage,
  type WidgetDisplayMode,
  type WidgetToHostMessage,
} from "@/sdk/bridge-protocol";
import { RRWEB_BLOCK_CLASS, createDomRecorder } from "@/sdk/dom-recorder";
import { CLOSE_ICON, LAUNCHER_ICON, LAUNCHER_STYLES } from "@/sdk/launcher-styles";
import type { EndUserInput } from "@/types/feedback";

const SDK_ORIGIN = process.env.NEXT_PUBLIC_SDK_ORIGIN ?? "http://localhost:3000";
const ROOT_ELEMENT_ID = "lattice-feedback-root";
const MAX_BADGE_COUNT = 99;

type FeedbackInitOptions = { projectKey: string; user: EndUserInput };

type FeedbackApi = { init: (options: FeedbackInitOptions) => void };

declare global {
  interface Window {
    Feedback?: FeedbackApi;
  }
}

function isValidOptions(options: FeedbackInitOptions | undefined): options is FeedbackInitOptions {
  return Boolean(options?.projectKey && options.user?.id && options.user?.name);
}

function mountWidget({ projectKey, user }: FeedbackInitOptions): void {
  const host = document.createElement("div");
  host.id = ROOT_ELEMENT_ID;
  host.className = RRWEB_BLOCK_CLASS;
  const shadowRoot = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = LAUNCHER_STYLES;

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "launcher";
  launcher.setAttribute("aria-label", "피드백 보내기");
  launcher.setAttribute("aria-expanded", "false");
  const launcherIcon = document.createElement("span");
  launcherIcon.innerHTML = LAUNCHER_ICON;
  launcherIcon.style.display = "contents";
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.dataset.count = "0";
  badge.setAttribute("aria-hidden", "true");
  launcher.append(launcherIcon, badge);

  const iframeUrl = new URL("/widget", SDK_ORIGIN);
  iframeUrl.searchParams.set("projectKey", projectKey);
  const iframe = document.createElement("iframe");
  iframe.className = `frame ${RRWEB_BLOCK_CLASS}`;
  iframe.src = iframeUrl.toString();
  iframe.title = "피드백 보내기";
  iframe.allow = "display-capture; microphone; clipboard-write";
  iframe.dataset.mode = "closed";

  shadowRoot.append(style, iframe, launcher);
  document.body.append(host);

  let mode: WidgetDisplayMode = "closed";

  const postToWidget = (message: HostToWidgetMessage) => {
    iframe.contentWindow?.postMessage(createEnvelope(message), SDK_ORIGIN);
  };

  const applyMode = (nextMode: WidgetDisplayMode) => {
    mode = nextMode;
    iframe.dataset.mode = nextMode;
    launcher.dataset.hidden = String(nextMode === "recording");
    launcher.setAttribute("aria-expanded", String(nextMode === "open"));
    launcherIcon.innerHTML = nextMode === "open" ? CLOSE_ICON : LAUNCHER_ICON;
  };

  const setUnreadCount = (count: number) => {
    const safeCount = Math.max(0, Math.floor(count));
    badge.dataset.count = String(safeCount);
    badge.textContent = safeCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(safeCount);
    launcher.setAttribute("aria-label", safeCount > 0 ? `피드백 보내기, 새 답장 ${safeCount}개` : "피드백 보내기");
  };

  const domRecorder = createDomRecorder({
    post: postToWidget,
    isInsideSdkRoot: (target) => target instanceof Node && host.contains(target),
  });

  launcher.addEventListener("click", () => {
    const isOpen = mode !== "open";
    applyMode(isOpen ? "open" : "closed");
    postToWidget({ type: "host:visibility", payload: { open: isOpen } });
  });

  const handleWidgetMessage = (message: WidgetToHostMessage) => {
    switch (message.type) {
      case "widget:ready":
        postToWidget({
          type: "host:init",
          payload: { projectKey, user, page: { url: location.href, title: document.title } },
        });
        postToWidget({ type: "host:visibility", payload: { open: mode === "open" } });
        return;
      case "widget:mode":
        applyMode(message.payload.mode);
        return;
      case "widget:unread":
        setUnreadCount(message.payload.count);
        return;
      case "recording:start":
        domRecorder.start();
        return;
      case "recording:stop":
        if (domRecorder.isRecording()) {
          domRecorder.stop();
        } else {
          postToWidget({ type: "dom:stopped", payload: { eventCount: 0 } });
        }
        return;
    }
  };

  window.addEventListener("message", (event: MessageEvent) => {
    if (event.origin !== SDK_ORIGIN || event.source !== iframe.contentWindow || !isBridgeEnvelope(event.data)) {
      return;
    }
    handleWidgetMessage(event.data as unknown as WidgetToHostMessage);
  });
}

function init(options: FeedbackInitOptions): void {
  if (!isValidOptions(options)) {
    console.warn("[Feedback] init에는 projectKey와 user.id, user.name이 필요해요.");
    return;
  }
  if (document.getElementById(ROOT_ELEMENT_ID)) {
    return;
  }
  if (document.body) {
    mountWidget(options);
    return;
  }
  document.addEventListener("DOMContentLoaded", () => mountWidget(options), { once: true });
}

window.Feedback = window.Feedback ?? { init };
