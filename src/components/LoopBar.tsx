"use client";

import { useCallback, useRef, useState } from "react";
import { formatTime } from "@/lib/format";

interface LoopBarProps {
  duration: number;
  currentTime: number;
  start: number;
  end: number;
  onSeek: (seconds: number) => void;
  onChangeStart: (seconds: number) => void;
  onChangeEnd: (seconds: number) => void;
}

type Handle = "start" | "end";

/**
 * A plain timeline rather than a waveform: the embedded player never exposes
 * the audio stream, so there is nothing to draw a waveform from.
 */
export function LoopBar({
  duration,
  currentTime,
  start,
  end,
  onSeek,
  onChangeStart,
  onChangeEnd,
}: LoopBarProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<Handle | null>(null);

  const positionFromEvent = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || duration <= 0) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      return Math.min(duration, Math.max(0, ratio * duration));
    },
    [duration],
  );

  const beginDrag = (handle: Handle) => (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(handle);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging) return;
    const seconds = positionFromEvent(event.clientX);
    if (dragging === "start") onChangeStart(seconds);
    else onChangeEnd(seconds);
  };

  const endDrag = (event: React.PointerEvent) => {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(null);
  };

  const pct = (seconds: number) => (duration > 0 ? (seconds / duration) * 100 : 0);
  const disabled = duration <= 0;

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={trackRef}
        className={`relative h-12 w-full rounded-lg bg-neutral-800 ${disabled ? "opacity-40" : "cursor-pointer"}`}
        onPointerDown={(event) => {
          if (disabled || dragging) return;
          onSeek(positionFromEvent(event.clientX));
        }}
      >
        <div
          className="absolute inset-y-0 rounded-md bg-emerald-500/25 ring-1 ring-inset ring-emerald-400/50"
          style={{ left: `${pct(start)}%`, width: `${Math.max(0, pct(end) - pct(start))}%` }}
        />

        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white"
          style={{ left: `${pct(currentTime)}%` }}
        />

        {(["start", "end"] as const).map((handle) => (
          <div
            key={handle}
            role="slider"
            aria-label={handle === "start" ? "구간 시작" : "구간 끝"}
            aria-valuenow={handle === "start" ? start : end}
            aria-valuemin={0}
            aria-valuemax={duration}
            tabIndex={disabled ? -1 : 0}
            onPointerDown={disabled ? undefined : beginDrag(handle)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="absolute inset-y-0 -ml-2.5 flex w-5 touch-none items-center justify-center"
            style={{ left: `${pct(handle === "start" ? start : end)}%` }}
          >
            <span className="h-full w-1.5 rounded-full bg-emerald-400 shadow" />
          </div>
        ))}
      </div>

      <div className="flex justify-between font-mono text-xs tabular-nums text-neutral-500">
        <span>{formatTime(currentTime)}</span>
        <span className="text-emerald-400">구간 {(end - start).toFixed(1)}초</span>
        <span>{formatTime(duration, false)}</span>
      </div>
    </div>
  );
}
