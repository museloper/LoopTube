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
type DragTarget = Handle | "playhead";

/** Seeking on every pointermove floods the player; the final position is always sent on release. */
const SCRUB_SEEK_INTERVAL_MS = 100;

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
  const [dragging, setDragging] = useState<DragTarget | null>(null);
  /** The polled playhead lags behind the pointer, so the bar follows this while scrubbing. */
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const lastScrubSeekRef = useRef(0);

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

  const beginScrub = (event: React.PointerEvent) => {
    if (duration <= 0 || dragging) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging("playhead");
    const seconds = positionFromEvent(event.clientX);
    setScrubTime(seconds);
    lastScrubSeekRef.current = performance.now();
    onSeek(seconds);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging) return;
    const seconds = positionFromEvent(event.clientX);
    if (dragging === "start") onChangeStart(seconds);
    else if (dragging === "end") onChangeEnd(seconds);
    else {
      setScrubTime(seconds);
      const now = performance.now();
      if (now - lastScrubSeekRef.current >= SCRUB_SEEK_INTERVAL_MS) {
        lastScrubSeekRef.current = now;
        onSeek(seconds);
      }
    }
  };

  const endDrag = (event: React.PointerEvent) => {
    if (!dragging) return;
    // The capture may sit on a handle, which is the event target rather than the track.
    const captor = event.target as Element;
    if (captor.hasPointerCapture?.(event.pointerId)) captor.releasePointerCapture(event.pointerId);
    if (dragging === "playhead") {
      onSeek(positionFromEvent(event.clientX));
      setScrubTime(null);
    }
    setDragging(null);
  };

  // Same steps as the global seek shortcuts; stopping propagation keeps a
  // focused handle from also moving the playhead.
  const onHandleKeyDown = (handle: Handle) => (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    event.stopPropagation();
    const step = (event.shiftKey ? 1 : 0.1) * (event.key === "ArrowLeft" ? -1 : 1);
    if (handle === "start") onChangeStart(start + step);
    else onChangeEnd(end + step);
  };

  const pct = (seconds: number) => (duration > 0 ? (seconds / duration) * 100 : 0);
  const disabled = duration <= 0;
  const playhead = scrubTime ?? currentTime;

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={trackRef}
        className={`relative h-12 w-full touch-none select-none rounded-lg bg-neutral-800 ${
          disabled ? "opacity-40" : dragging === "playhead" ? "cursor-grabbing" : "cursor-pointer"
        }`}
        onPointerDown={disabled ? undefined : beginScrub}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="absolute inset-y-0 rounded-md bg-emerald-500/25 ring-1 ring-inset ring-emerald-400/50"
          style={{ left: `${pct(start)}%`, width: `${Math.max(0, pct(end) - pct(start))}%` }}
        />

        {/* Pointer events go to the track, so the whole bar is a grab area — the knob only marks where. */}
        <div
          className="pointer-events-none absolute inset-y-0 -ml-px flex w-0.5 flex-col items-center bg-white"
          style={{ left: `${pct(playhead)}%` }}
        >
          <span
            className={`absolute -top-1.5 rounded-full bg-white shadow ring-2 ring-neutral-900 transition-transform ${
              dragging === "playhead" ? "h-4 w-4 scale-110" : "h-3.5 w-3.5"
            }`}
          />
        </div>

        {(["start", "end"] as const).map((handle) => (
          <div
            key={handle}
            role="slider"
            aria-label={handle === "start" ? "구간 시작" : "구간 끝"}
            aria-valuenow={handle === "start" ? start : end}
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuetext={formatTime(handle === "start" ? start : end)}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={disabled ? undefined : onHandleKeyDown(handle)}
            // Move/up bubble from the captured handle to the track's listeners.
            onPointerDown={disabled ? undefined : beginDrag(handle)}
            className="absolute inset-y-0 -ml-2.5 flex w-5 touch-none items-center justify-center"
            style={{ left: `${pct(handle === "start" ? start : end)}%` }}
          >
            <span className="h-full w-1.5 rounded-full bg-emerald-400 shadow" />
          </div>
        ))}
      </div>

      <div className="flex justify-between font-mono text-xs tabular-nums text-neutral-500">
        <span>{formatTime(playhead)}</span>
        <span className="text-emerald-400">구간 {(end - start).toFixed(1)}초</span>
        <span>{formatTime(duration, false)}</span>
      </div>
    </div>
  );
}
