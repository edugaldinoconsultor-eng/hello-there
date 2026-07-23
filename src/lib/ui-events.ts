/**
 * Bus mínimo de eventos de UI (client-only).
 *
 * Usado para disparar aberturas de modais globais a partir do Header/Sidebar
 * sem exigir uma store completa nesta fase. Substituir por um provider
 * dedicado quando o volume de fluxos justificar.
 */
import { useEffect } from "react";

export type UIEventName = "customer:new" | "order:new";

type Handler = () => void;

const listeners = new Map<UIEventName, Set<Handler>>();

export function emitUIEvent(name: UIEventName) {
  listeners.get(name)?.forEach((fn) => fn());
}

export function onUIEvent(name: UIEventName, handler: Handler) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name)!.add(handler);
  return () => {
    listeners.get(name)?.delete(handler);
  };
}

export function useUIEvent(name: UIEventName, handler: Handler) {
  useEffect(() => onUIEvent(name, handler), [name, handler]);
}
