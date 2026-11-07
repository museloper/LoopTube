"use client";

import { useEffect, useRef } from "react";

export type HotkeyMap = Record<string, (event: KeyboardEvent) => void>;

/**
 * Keys are matched by physical key (`event.code`) as "meta+ctrl+shift+arrowleft"
 * style descriptors, e.g. "keyl", "comma", "space". `event.key` can't be used:
 * with the Korean IME on, L arrives as "ㅣ" (or "Process"), so shortcuts would
 * only work in the English layout. Typing in an input must never trigger a
 * shortcut, since the URL field lives on the same screen.
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
      // Alt combos stay with the browser and OS. Cmd combos pass through, but
      // only ones listed in the map are intercepted, so Cmd+C etc. still work.
      if (event.altKey) return;

      const descriptor = `${event.metaKey ? "meta+" : ""}${event.ctrlKey ? "ctrl+" : ""}${event.shiftKey ? "shift+" : ""}${event.code.toLowerCase()}`;
      const handler = mapRef.current[descriptor];
      if (!handler) return;

      event.preventDefault();
      handler(event);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
