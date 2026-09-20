"use client";

import { useEffect, useRef } from "react";

export type HotkeyMap = Record<string, (event: KeyboardEvent) => void>;

/**
 * Keys are matched as "shift+arrowleft" style descriptors. Typing in an input
 * must never trigger a shortcut, since the URL field lives on the same screen.
 */
export function useHotkeys(map: HotkeyMap, enabled = true) {
  const mapRef = useRef(map);

  // Written from an effect so a render never mutates the ref; handlers are only
  // reachable after paint anyway.
  useEffect(() => {
    mapRef.current = map;
  }, [map]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (target?.isContentEditable) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const descriptor = `${event.shiftKey ? "shift+" : ""}${event.key.toLowerCase()}`;
      const handler = mapRef.current[descriptor];
      if (!handler) return;

      event.preventDefault();
      handler(event);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
