"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LoopEngine, type LoopSample } from "@/lib/loopEngine";
import type { YTPlayer } from "@/lib/youtube/types";

export interface UseLoopEngineArgs {
  player: YTPlayer | null;
  enabled: boolean;
  regionStart: number;
  regionEnd: number;
  rate: number;
  restSeconds: number;
  onSample?: (sample: LoopSample) => void;
}

export interface UseLoopEngineResult {
  reps: number;
  /** Learned seek latency in seconds; surfaced so the debug page can watch it converge. */
  lookahead: number;
  resetReps: () => void;
}

interface Snapshot {
  reps: number;
  lookahead: number;
}

/**
 * The engine runs on animation frames outside React, so its counters are read
 * through an external store rather than mirrored into state by an effect.
 */
function createStore() {
  let snapshot: Snapshot = { reps: 0, lookahead: 0.08 };
  const listeners = new Set<() => void>();

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    set(next: Partial<Snapshot>) {
      snapshot = { ...snapshot, ...next };
      for (const listener of listeners) listener();
    },
  };
}

export function useLoopEngine({
  player,
  enabled,
  regionStart,
  regionEnd,
  rate,
  restSeconds,
  onSample,
}: UseLoopEngineArgs): UseLoopEngineResult {
  const [store] = useState(createStore);
  const { reps, lookahead } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );

  const engineRef = useRef<LoopEngine | null>(null);
  const sampleRef = useRef(onSample);

  useEffect(() => {
    sampleRef.current = onSample;
  }, [onSample]);

  useEffect(() => {
    if (!player) return;

    const engine = new LoopEngine(player, {
      onRep: (rep) => store.set({ reps: rep }),
      onSample: (sample) => {
        store.set({ lookahead: engine.lookaheadSeconds });
        sampleRef.current?.(sample);
      },
    });
    engineRef.current = engine;

    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, [player, store]);

  // `player` is a dependency so these also run right after the effect above
  // replaces the engine; otherwise a fresh engine keeps its defaults (an empty
  // region) until one of the values happens to change.
  useEffect(() => {
    engineRef.current?.setRegion(regionStart, regionEnd);
  }, [player, regionStart, regionEnd]);

  useEffect(() => {
    engineRef.current?.setRate(rate);
  }, [player, rate]);

  useEffect(() => {
    engineRef.current?.setRestSeconds(restSeconds);
  }, [player, restSeconds]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (enabled) {
      engine.resetReps();
      store.set({ reps: 0 });
      engine.start();
    } else {
      engine.stop();
    }
    return () => engine.stop();
  }, [enabled, player, store]);

  const resetReps = useCallback(() => {
    engineRef.current?.resetReps();
    store.set({ reps: 0 });
  }, [store]);

  return { reps, lookahead, resetReps };
}
