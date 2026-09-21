"use client";

import { useCallback, useRef, useState } from "react";
import { Player } from "@/components/Player";
import { UrlInput } from "@/components/UrlInput";
import { useLoopEngine } from "@/hooks/useLoopEngine";
import { usePlayer } from "@/hooks/usePlayer";
import { summarize, type Summary } from "@/lib/stats";
import type { LoopSample } from "@/lib/loopEngine";

const TARGET_REPS = 100;
const REGION_SECONDS = 3;
const REGION_START = 10;

/**
 * Loop accuracy harness. The seam quality is the whole product, so it gets
 * measured rather than eyeballed: run a fixed region a hundred times and report
 * how far past B playback actually got.
 */
export default function DebugPage() {
  const { containerRef, player, ready, duration, rate, availableRates, error, load, requestRate } =
    usePlayer();

  const [videoId, setVideoId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState<LoopSample[]>([]);
  const samplesRef = useRef<LoopSample[]>([]);

  const handleSample = useCallback(
    (sample: LoopSample) => {
      const next = [...samplesRef.current, sample];
      samplesRef.current = next;
      setSamples(next);
      // Stop from the sample callback rather than an effect watching the
      // length, so the run ends on the rep that hits the target.
      if (next.length >= TARGET_REPS) {
        setRunning(false);
        player?.pauseVideo();
      }
    },
    [player],
  );

  const { lookahead } = useLoopEngine({
    player,
    enabled: running,
    regionStart: REGION_START,
    regionEnd: REGION_START + REGION_SECONDS,
    rate,
    restSeconds: 0,
    onSample: handleSample,
  });

  const startRun = () => {
    if (!player) return;
    samplesRef.current = [];
    setSamples([]);
    player.seekTo(REGION_START, true);
    player.playVideo();
    setRunning(true);
  };

  const overrun = summarize(samples.map((s) => s.overrunMs));
  const latency = summarize(samples.map((s) => s.latencyMs));
  // Early reps run on an uncalibrated lookahead, so report the tail separately.
  const settled = summarize(samples.slice(20).map((s) => s.overrunMs));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
      <h1 className="text-lg font-bold">루프 정확도 측정</h1>
      <p className="text-xs leading-relaxed text-neutral-500">
        {REGION_START}초부터 {REGION_SECONDS}초 구간을 {TARGET_REPS}회 반복하며 매회 B 지점을 얼마나
        지나쳤는지 기록합니다. 목표: p95 오버런 150ms 미만.
      </p>

      <UrlInput
        onSubmit={(parsed) => {
          if (!parsed.videoId) return;
          setVideoId(parsed.videoId);
          load(parsed.videoId, REGION_START);
        }}
      />

      <Player containerRef={containerRef} error={error} hasVideo={Boolean(videoId)} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={startRun}
          disabled={!ready || !videoId || running || duration <= REGION_START + REGION_SECONDS}
          className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 disabled:opacity-40"
        >
          {running ? `측정 중 ${samples.length}/${TARGET_REPS}` : "측정 시작"}
        </button>
        {availableRates.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => requestRate(r)}
            disabled={running}
            className={`rounded-lg px-3 py-2 text-xs disabled:opacity-40 ${
              Math.abs(r - rate) < 0.001 ? "bg-emerald-500 text-neutral-950" : "bg-neutral-800"
            }`}
          >
            {r}x
          </button>
        ))}
      </div>

      <p className="font-mono text-xs text-neutral-500">
        학습된 lookahead: {(lookahead * 1000).toFixed(0)}ms · 측정 배속 {rate}x
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard title="오버런 (전체)" summary={overrun} unit="ms" />
        <StatCard title="오버런 (21회 이후)" summary={settled} unit="ms" highlight />
        <StatCard title="seek 지연" summary={latency} unit="ms" />
      </div>
    </main>
  );
}

function StatCard({
  title,
  summary,
  unit,
  highlight,
}: {
  title: string;
  summary: Summary | null;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-neutral-900 p-3 ${highlight ? "ring-1 ring-emerald-500/40" : ""}`}>
      <p className="text-xs text-neutral-400">{title}</p>
      {summary ? (
        <dl className="mt-2 flex flex-col gap-1 font-mono text-xs tabular-nums text-neutral-300">
          <Row label="p50" value={`${summary.p50.toFixed(0)}${unit}`} />
          <Row label="p95" value={`${summary.p95.toFixed(0)}${unit}`} />
          <Row label="max" value={`${summary.max.toFixed(0)}${unit}`} />
          <Row label="n" value={String(summary.count)} />
        </dl>
      ) : (
        <p className="mt-2 text-xs text-neutral-600">데이터 없음</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
