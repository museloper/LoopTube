"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FineTuner } from "@/components/FineTuner";
import { LoopBar } from "@/components/LoopBar";
import { LoopLibrary } from "@/components/LoopLibrary";
import { Player } from "@/components/Player";
import { PlaylistPanel } from "@/components/PlaylistPanel";
import { RepCounter } from "@/components/RepCounter";
import { SpeedPicker } from "@/components/SpeedPicker";
import { UrlInput } from "@/components/UrlInput";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useLoopEngine } from "@/hooks/useLoopEngine";
import { usePlayer } from "@/hooks/usePlayer";
import { usePlayhead } from "@/hooks/usePlayhead";
import { saveLoop, type Loop } from "@/lib/db";
import { MIN_REGION_SECONDS } from "@/lib/loopEngine";
import type { ParsedVideo } from "@/lib/youtube/parseUrl";
import { fetchVideoMeta, type VideoMeta } from "@/lib/youtube/oembed";
import { PlayerState } from "@/lib/youtube/types";

/** Grabbing A after the phrase has started is the common case, so offer a shortcut back. */
const QUICK_CAPTURE_SECONDS = 3;

export default function Home() {
  const {
    containerRef,
    player,
    ready,
    playerState,
    duration,
    rate,
    availableRates,
    error,
    playlistIds,
    load,
    cuePlaylist,
    clearPlaylist,
    requestRate,
  } = usePlayer();

  const [videoId, setVideoId] = useState<string | null>(null);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [start, setStart] = useState(0);
  /** null means "to the end of the video", so the region is usable before the
      duration has loaded and no effect has to backfill it. */
  const [endOverride, setEndOverride] = useState<number | null>(null);
  const [loopOn, setLoopOn] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [autoStepEvery, setAutoStepEvery] = useState(0);
  const [saved, setSaved] = useState(false);

  const end = endOverride ?? duration;
  const playing = playerState === PlayerState.PLAYING;
  const currentTime = usePlayhead(player, Boolean(videoId));
  const hasRegion = end - start >= MIN_REGION_SECONDS;

  const { reps } = useLoopEngine({
    player,
    enabled: loopOn && hasRegion,
    regionStart: start,
    regionEnd: end,
    rate,
    restSeconds,
  });

  const handleLoad = useCallback(
    (id: string, startSeconds: number | null) => {
      setVideoId(id);
      setMeta(null);
      setLoopOn(false);
      setStart(startSeconds ?? 0);
      setEndOverride(null);
      load(id, startSeconds ?? 0);
      fetchVideoMeta(id).then(setMeta);
    },
    [load],
  );

  const handleUrlSubmit = useCallback(
    (parsed: ParsedVideo) => {
      if (parsed.playlistId) {
        setVideoId(null);
        setMeta(null);
        setLoopOn(false);
        cuePlaylist(parsed.playlistId);
      } else if (parsed.videoId) {
        clearPlaylist();
        handleLoad(parsed.videoId, parsed.startSeconds);
      }
    },
    [cuePlaylist, clearPlaylist, handleLoad],
  );

  const clampToVideo = useCallback(
    (seconds: number) => Math.min(duration || seconds, Math.max(0, seconds)),
    [duration],
  );

  const updateStart = useCallback(
    (seconds: number) => setStart(clampToVideo(Math.min(seconds, end - MIN_REGION_SECONDS))),
    [clampToVideo, end],
  );

  const updateEnd = useCallback(
    (seconds: number) => setEndOverride(clampToVideo(Math.max(seconds, start + MIN_REGION_SECONDS))),
    [clampToVideo, start],
  );

  const seek = useCallback(
    (seconds: number) => player?.seekTo(clampToVideo(seconds), true),
    [player, clampToVideo],
  );

  const togglePlay = useCallback(() => {
    if (!player) return;
    if (playing) player.pauseVideo();
    else player.playVideo();
  }, [player, playing]);

  const stepRate = useCallback(
    (direction: 1 | -1) => {
      const index = availableRates.findIndex((r) => Math.abs(r - rate) < 0.001);
      const next = availableRates[Math.max(0, Math.min(availableRates.length - 1, index + direction))];
      if (next !== undefined) requestRate(next);
    },
    [availableRates, rate, requestRate],
  );

  // Auto speed-up: bump one step each time the rep count crosses a multiple.
  const lastStepRef = useRef(0);
  useEffect(() => {
    if (autoStepEvery <= 0 || reps === 0) return;
    if (reps % autoStepEvery !== 0 || reps === lastStepRef.current) return;
    lastStepRef.current = reps;
    stepRate(1);
  }, [reps, autoStepEvery, stepRate]);

  useEffect(() => {
    lastStepRef.current = 0;
  }, [loopOn, autoStepEvery]);

  const captureRecent = useCallback(() => {
    const now = player?.getCurrentTime() ?? currentTime;
    setStart(clampToVideo(now - QUICK_CAPTURE_SECONDS));
    setEndOverride(clampToVideo(now));
  }, [player, currentTime, clampToVideo]);

  const handleSave = useCallback(async () => {
    if (!videoId || !hasRegion) return;
    await saveLoop({
      videoId,
      videoTitle: meta?.title ?? videoId,
      label: meta?.title ?? "",
      startSec: start,
      endSec: end,
      playbackRate: rate,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [videoId, hasRegion, meta, start, end, rate]);

  const applyLoop = useCallback(
    (loop: Loop) => {
      if (loop.videoId !== videoId) handleLoad(loop.videoId, loop.startSec);
      else seek(loop.startSec);
      setStart(loop.startSec);
      setEndOverride(loop.endSec);
      requestRate(loop.playbackRate);
    },
    [videoId, handleLoad, seek, requestRate],
  );

  useHotkeys(
    {
      " ": togglePlay,
      a: () => updateStart(player?.getCurrentTime() ?? currentTime),
      b: () => updateEnd(player?.getCurrentTime() ?? currentTime),
      l: () => setLoopOn((on) => !on),
      arrowleft: () => seek((player?.getCurrentTime() ?? currentTime) - 0.1),
      arrowright: () => seek((player?.getCurrentTime() ?? currentTime) + 0.1),
      "shift+arrowleft": () => seek((player?.getCurrentTime() ?? currentTime) - 1),
      "shift+arrowright": () => seek((player?.getCurrentTime() ?? currentTime) + 1),
      "[": () => stepRate(-1),
      "]": () => stepRate(1),
    },
    ready,
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5">
      <header className="flex items-baseline justify-between gap-3">
        <h1 className="text-lg font-bold tracking-tight">LoopTube</h1>
        <p className="text-xs text-neutral-500">구간 반복 · 속도 조절 연습기</p>
      </header>

      <UrlInput onSubmit={handleUrlSubmit} />

      <Player
        containerRef={containerRef}
        error={error}
        hasVideo={Boolean(videoId) || playlistIds.length > 0}
      />

      {playlistIds.length > 0 && (
        <PlaylistPanel
          videoIds={playlistIds}
          activeVideoId={videoId}
          onSelect={(id) => handleLoad(id, null)}
          onClose={clearPlaylist}
        />
      )}

      {meta && (
        <p className="truncate text-sm text-neutral-300">
          {meta.title}
          {meta.author && <span className="text-neutral-500"> · {meta.author}</span>}
        </p>
      )}

      <LoopBar
        duration={duration}
        currentTime={currentTime}
        start={start}
        end={end}
        onSeek={seek}
        onChangeStart={updateStart}
        onChangeEnd={updateEnd}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!videoId}
          className="rounded-lg bg-neutral-800 px-4 py-2.5 text-sm font-medium text-neutral-100 transition hover:bg-neutral-700 disabled:opacity-40"
        >
          {playing ? "일시정지" : "재생"}
        </button>
        <button
          type="button"
          onClick={() => setLoopOn((on) => !on)}
          disabled={!hasRegion}
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 ${
            loopOn ? "bg-emerald-500 text-neutral-950" : "bg-neutral-800 text-neutral-100 hover:bg-neutral-700"
          }`}
        >
          {loopOn ? "반복 중지" : "구간 반복"}
        </button>
        <button
          type="button"
          onClick={captureRecent}
          disabled={!videoId}
          className="rounded-lg bg-neutral-800 px-4 py-2.5 text-sm text-neutral-100 transition hover:bg-neutral-700 disabled:opacity-40"
        >
          직전 {QUICK_CAPTURE_SECONDS}초를 구간으로
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasRegion}
          className="rounded-lg bg-neutral-800 px-4 py-2.5 text-sm text-neutral-100 transition hover:bg-neutral-700 disabled:opacity-40"
        >
          {saved ? "저장됨" : "구간 저장"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FineTuner
          label="A · 시작"
          value={start}
          disabled={!videoId}
          onNudge={(delta) => updateStart(start + delta)}
          onSetToPlayhead={() => updateStart(player?.getCurrentTime() ?? currentTime)}
        />
        <FineTuner
          label="B · 끝"
          value={end}
          disabled={!videoId}
          onNudge={(delta) => updateEnd(end + delta)}
          onSetToPlayhead={() => updateEnd(player?.getCurrentTime() ?? currentTime)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-neutral-900 p-3">
          <SpeedPicker
            rates={availableRates}
            current={rate}
            onChange={requestRate}
            disabled={!videoId}
          />
        </div>
        <RepCounter
          reps={reps}
          restSeconds={restSeconds}
          onRestChange={setRestSeconds}
          autoStepEvery={autoStepEvery}
          onAutoStepChange={setAutoStepEvery}
          disabled={!videoId}
        />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">저장된 구간</h2>
        <LoopLibrary videoId={videoId} onApply={applyLoop} />
      </section>

      <footer className="pb-4 text-xs leading-relaxed text-neutral-600">
        단축키 — <kbd>Space</kbd> 재생 · <kbd>A</kbd>/<kbd>B</kbd> 지점 지정 · <kbd>L</kbd> 반복 ·{" "}
        <kbd>←</kbd>/<kbd>→</kbd> 0.1초 · <kbd>Shift</kbd>+<kbd>←</kbd>/<kbd>→</kbd> 1초 ·{" "}
        <kbd>[</kbd>/<kbd>]</kbd> 속도
      </footer>
    </main>
  );
}
