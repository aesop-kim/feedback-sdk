// 고객사 페이지(sdk.js)와 위젯(iframe) 사이 postMessage 규약. 양쪽이 같은 타입을 import 한다.
import type { ElementContext, EndUserInput } from "@/types/feedback";

export const BRIDGE_NAMESPACE = "lattice-feedback";

export type WidgetDisplayMode = "closed" | "open" | "recording";

export type HostToWidgetMessage =
  | {
      type: "host:init";
      payload: { projectKey: string; user: EndUserInput; page: { url: string; title: string } };
    }
  | { type: "host:visibility"; payload: { open: boolean } }
  | { type: "dom:events"; payload: { events: unknown[] } }
  | { type: "dom:click"; payload: { epochMs: number; context: ElementContext | null } }
  | { type: "dom:context"; payload: { epochMs: number; context: ElementContext } }
  | { type: "dom:stopped"; payload: { eventCount: number } };

export type WidgetToHostMessage =
  | { type: "widget:ready"; payload: Record<string, never> }
  | { type: "widget:mode"; payload: { mode: WidgetDisplayMode } }
  | { type: "widget:unread"; payload: { count: number } }
  | { type: "recording:start"; payload: { t0: number } }
  | { type: "recording:stop"; payload: Record<string, never> };

export type BridgeEnvelope<TMessage> = TMessage & { namespace: typeof BRIDGE_NAMESPACE };

export function createEnvelope<TMessage extends { type: string }>(message: TMessage): BridgeEnvelope<TMessage> {
  return { ...message, namespace: BRIDGE_NAMESPACE };
}

export function isBridgeEnvelope(value: unknown): value is { namespace: string; type: string; payload: unknown } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return candidate.namespace === BRIDGE_NAMESPACE && typeof candidate.type === "string";
}
