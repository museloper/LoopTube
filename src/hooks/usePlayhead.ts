"use client";

import { useEffect, useState } from "react";
import type { YTPlayer } from "@/lib/youtube/types";

/**
 * Playhead position for the UI only. The loop engine polls every animation
 * frame; re-rendering React that often would be wasteful, so the timeline
 * samples at 10Hz instead.
 */
export function usePlayhead(player: YTPlayer | null, active: boolean): number {
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!player || !active) return;
    const id = setInterval(() => {
      try {
        setTime(player.getCurrentTime());
      } catch {
        // Ignore reads that race the iframe tearing down.
      }
    }, 100);
    return () => clearInterval(id);
  }, [player, active]);

  return time;
}
