import { afterEach, describe, expect, it } from "vitest";
import { LoopEngine, type LoopSample } from "./loopEngine";
import { PlayerState, type YTPlayer } from "./youtube/types";

const FRAME_MS = 16;

/**
 * A player stand-in with a controllable seek latency, driven by a virtual
 * clock. The engine's whole job is to compensate for that latency, so the only
 * way to test it deterministically is to decide what the latency is.
 */
class FakePlayer {
  time: number;
  rate = 1;
  state: number = PlayerState.PLAYING;

  private latencyMs: number;
  private clock: () => number;
  private seekTarget: number | null = null;
  private seekLandsAt = 0;

  constructor(start: number, latencyMs: number, clock: () => number) {
    this.time = start;
    this.latencyMs = latencyMs;
    this.clock = clock;
  }

  advance(dtMs: number) {
    if (this.seekTarget !== null && this.clock() >= this.seekLandsAt) {
      this.time = this.seekTarget;
      this.seekTarget = null;
      return;
    }
    // Playback keeps running while a seek is in flight — that is exactly the
    // overshoot the engine has to fire early to avoid.
    this.time += (dtMs / 1000) * this.rate;
  }

  getCurrentTime() { return this.time; }
  getPlayerState() { return this.state as never; }
  getPlaybackRate() { return this.rate; }
  getAvailablePlaybackRates() { return [0.25, 0.5, 1, 2]; }
  getDuration() { return 600; }
  seekTo(seconds: number) {
    this.seekTarget = seconds;
    this.seekLandsAt = this.clock() + this.latencyMs;
  }
  playVideo() { this.state = PlayerState.PLAYING; }
  pauseVideo() { this.state = PlayerState.PAUSED; }
  loadVideoById() {}
  cueVideoById() {}
  setPlaybackRate(rate: number) { this.rate = rate; }
  destroy() {}
}

interface RunOptions {
  latencyMs?: number;
  rate?: number;
  a?: number;
  b?: number;
  frames?: number;
}

const originalRaf = globalThis.requestAnimationFrame;
const originalCancel = globalThis.cancelAnimationFrame;
const originalPerformance = globalThis.performance;

afterEach(() => {
  globalThis.requestAnimationFrame = originalRaf;
  globalThis.cancelAnimationFrame = originalCancel;
  globalThis.performance = originalPerformance;
});

function run({ latencyMs = 120, rate = 1, a = 10, b = 13, frames = 4000 }: RunOptions = {}) {
  let now = 0;
  const pending = new Map<number, FrameRequestCallback>();
  let nextId = 1;

  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    const id = nextId++;
    pending.set(id, cb);
    return id;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => pending.delete(id)) as typeof cancelAnimationFrame;
  globalThis.performance = { now: () => now } as Performance;

  const player = new FakePlayer(a, latencyMs, () => now);
  player.rate = rate;

  const samples: LoopSample[] = [];
  const engine = new LoopEngine(player as unknown as YTPlayer, {
    onSample: (sample) => samples.push(sample),
  });
  engine.setRegion(a, b);
  engine.setRate(rate);
  engine.start();

  for (let i = 0; i < frames; i++) {
    now += FRAME_MS;
    player.advance(FRAME_MS);
    const due = [...pending.values()];
    pending.clear();
    for (const cb of due) cb(now);
  }
  engine.stop();

  return { samples, engine, player, lookaheadMs: engine.lookaheadSeconds * 1000 };
}

/** The first repetitions run on an uncalibrated estimate by design. */
const settled = (samples: LoopSample[]) => samples.slice(10);

describe("LoopEngine at 1x with a 120ms seek", () => {
  it("loops continuously", () => {
    expect(run().samples.length).toBeGreaterThan(15);
  });

  it("learns the real seek latency", () => {
    // Detection is one frame coarse, so convergence lands just above 120ms.
    expect(run().lookaheadMs).toBeGreaterThan(100);
    expect(run().lookaheadMs).toBeLessThan(165);
  });

  it("keeps every settled repetition inside the 150ms accuracy target", () => {
    const worst = Math.max(...settled(run().samples).map((s) => Math.abs(s.overrunMs)));
    expect(worst).toBeLessThan(150);
  });

  it("counts repetitions without skipping or repeating", () => {
    const reps = run().samples.map((s) => s.rep);
    expect(reps).toEqual(reps.map((_, i) => i + 1));
  });

  it("never fires before the region has been entered", () => {
    expect(run().samples.every((s) => s.triggerTime >= 10)).toBe(true);
  });
});

describe("LoopEngine at practice speeds", () => {
  it("still loops at 0.5x", () => {
    expect(run({ rate: 0.5, frames: 6000 }).samples.length).toBeGreaterThan(8);
  });

  it("learns the same latency regardless of rate", () => {
    // lookahead is wall-clock, so it must not scale with playback rate.
    const slow = run({ rate: 0.5, frames: 6000 }).lookaheadMs;
    const fast = run({ rate: 2, frames: 3000 }).lookaheadMs;
    expect(Math.abs(slow - fast)).toBeLessThan(40);
  });

  it("holds the accuracy target at 0.5x", () => {
    const worst = Math.max(
      ...settled(run({ rate: 0.5, frames: 6000 }).samples).map((s) => Math.abs(s.overrunMs)),
    );
    expect(worst).toBeLessThan(150);
  });
});

describe("LoopEngine on a one-second region", () => {
  const options = { rate: 0.5, a: 10, b: 11, frames: 6000 } as const;

  it("loops the shortest realistic phrase", () => {
    expect(run(options).samples.length).toBeGreaterThan(10);
  });

  it("does not re-fire on the frames right after landing", () => {
    // Without the seeking guard the stale playhead would trigger again at once.
    expect(run(options).samples.every((s) => s.triggerTime > 10.3)).toBe(true);
  });
});

describe("LoopEngine on a region shorter than the landing window", () => {
  const options = { a: 10, b: 10.3, latencyMs: 120 } as const;

  it("waits for the playhead to jump back before counting a landing", () => {
    // Before the seek lands the playhead is already within half a second of A,
    // so proximity alone would log a one-frame latency.
    expect(run(options).lookaheadMs).toBeGreaterThan(100);
  });

  it("measures the real latency on every repetition", () => {
    // A premature landing also re-arms the trigger while the first seek is
    // still in flight, firing a second one and double-counting the rep.
    expect(run(options).samples.every((s) => s.latencyMs >= 100)).toBe(true);
  });
});

describe("LoopEngine guards", () => {
  it("clamps the learned latency to a floor on a fast connection", () => {
    const { lookaheadMs } = run({ latencyMs: 30 });
    expect(lookaheadMs).toBeGreaterThanOrEqual(30);
    expect(lookaheadMs).toBeLessThan(80);
  });

  it("clamps to a ceiling on a slow one", () => {
    expect(run({ latencyMs: 2000, frames: 8000 }).lookaheadMs).toBeLessThanOrEqual(400);
  });

  it("refuses a region below the minimum length", () => {
    expect(run({ b: 10.1 }).samples).toHaveLength(0);
  });

  it("does nothing while the player is buffering", () => {
    let now = 0;
    const pending = new Map<number, FrameRequestCallback>();
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      pending.set(pending.size + 1, cb);
      return pending.size;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof cancelAnimationFrame;
    globalThis.performance = { now: () => now } as Performance;

    const player = new FakePlayer(12.99, 120, () => now);
    player.state = PlayerState.BUFFERING;
    const samples: LoopSample[] = [];
    const engine = new LoopEngine(player as unknown as YTPlayer, {
      onSample: (s) => samples.push(s),
    });
    engine.setRegion(10, 13);
    engine.start();

    for (let i = 0; i < 100; i++) {
      now += FRAME_MS;
      const due = [...pending.values()];
      pending.clear();
      for (const cb of due) cb(now);
    }
    engine.stop();

    // Sitting past B while buffering must not queue up a burst of seeks.
    expect(samples).toHaveLength(0);
  });

  it("stops cleanly", () => {
    const { samples } = run({ frames: 0 });
    expect(samples).toHaveLength(0);
  });
});
