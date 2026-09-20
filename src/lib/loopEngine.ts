import { PlayerState, type YTPlayer } from "./youtube/types";

export interface LoopSample {
  rep: number;
  /** Playback position when the seek was issued. */
  triggerTime: number;
  /** Wall-clock delay between seekTo() and playback actually landing back at A. */
  latencyMs: number;
  /** Estimated milliseconds of video played past B. Negative means cut early. */
  overrunMs: number;
  rate: number;
}

export interface LoopEngineOptions {
  onRep?: (rep: number) => void;
  onSample?: (sample: LoopSample) => void;
  /** Seconds to pause at the top of each repetition. */
  restSeconds?: number;
}

const MIN_LOOKAHEAD = 0.03;
const MAX_LOOKAHEAD = 0.4;
const INITIAL_LOOKAHEAD = 0.08;
/** How much the newest latency measurement moves the running estimate. */
const EMA_ALPHA = 0.15;
/** A landing counts as "arrived" once playback is back within this window of A. */
const LANDING_WINDOW = 0.5;
/** Give up waiting for a landing after this long and re-arm anyway. */
const SEEK_TIMEOUT_MS = 2000;

export const MIN_REGION_SECONDS = 0.2;

/**
 * Drives A-B looping on top of the IFrame player.
 *
 * The player gives us no gapless primitive, so the loop is a polled seek: every
 * animation frame we read the playhead and, once it comes within one seek
 * latency of B, we jump back to A. Firing exactly at B would always overshoot
 * by however long the seek takes, so the trigger runs early by `lookahead`,
 * which is itself measured from the previous repetitions and converges to the
 * real latency of this device and network.
 */
export class LoopEngine {
  private player: YTPlayer;
  private options: LoopEngineOptions;

  private a = 0;
  private b = 0;
  private running = false;
  private frame: number | null = null;
  private restTimer: ReturnType<typeof setTimeout> | null = null;

  /** Rate is only ever set from onPlaybackRateChange; the setter is a request. */
  private rate = 1;
  private lookahead = INITIAL_LOOKAHEAD;
  private reps = 0;

  private phase: "armed" | "seeking" | "resting" = "armed";
  private seekIssuedAt = 0;
  private seekTriggerTime = 0;

  constructor(player: YTPlayer, options: LoopEngineOptions = {}) {
    this.player = player;
    this.options = options;
  }

  setRegion(a: number, b: number) {
    this.a = a;
    this.b = b;
    this.phase = "armed";
  }

  /** Called from the player's onPlaybackRateChange handler. */
  setRate(rate: number) {
    this.rate = rate > 0 ? rate : 1;
  }

  setRestSeconds(seconds: number) {
    this.options.restSeconds = seconds;
  }

  get repetitions() {
    return this.reps;
  }

  get lookaheadSeconds() {
    return this.lookahead;
  }

  resetReps() {
    this.reps = 0;
  }

  /** Forget the learned latency, e.g. after switching videos. */
  resetCalibration() {
    this.lookahead = INITIAL_LOOKAHEAD;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.phase = "armed";
    this.frame = requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    if (this.restTimer !== null) clearTimeout(this.restTimer);
    this.frame = null;
    this.restTimer = null;
  }

  private tick = () => {
    if (!this.running) return;
    try {
      this.step();
    } catch {
      // The player can throw while it is tearing down an iframe; skip the frame.
    }
    this.frame = requestAnimationFrame(this.tick);
  };

  private step() {
    if (this.b - this.a < MIN_REGION_SECONDS) return;
    if (this.phase === "resting") return;

    const state = this.player.getPlayerState();
    // Buffering and ad playback both freeze the playhead; judging the region
    // during either would fire a spurious seek the moment playback resumes.
    if (state === PlayerState.BUFFERING || state === PlayerState.UNSTARTED) return;

    const t = this.player.getCurrentTime();

    if (this.phase === "seeking") {
      const elapsedMs = performance.now() - this.seekIssuedAt;
      const landed = t <= this.a + LANDING_WINDOW;
      if (landed) {
        this.recordLanding(elapsedMs);
        this.phase = this.beginRest() ? "resting" : "armed";
      } else if (elapsedMs > SEEK_TIMEOUT_MS) {
        this.phase = "armed";
      }
      return;
    }

    if (state !== PlayerState.PLAYING) return;

    // `lookahead` is wall-clock seconds, so at 0.5x it covers half as much
    // video and at 2x twice as much.
    if (t >= this.b - this.lookahead * this.rate) {
      this.seekTriggerTime = t;
      this.seekIssuedAt = performance.now();
      this.phase = "seeking";
      // The region is already buffered, so allowSeekAhead costs nothing here
      // and keeps long jumps working if the user drags A far back.
      this.player.seekTo(this.a, true);
      this.reps += 1;
      this.options.onRep?.(this.reps);
    }
  }

  private recordLanding(latencyMs: number) {
    const latencySeconds = latencyMs / 1000;
    // Converge on the measured latency: firing exactly that early makes the
    // last audible frame land on B.
    this.lookahead = clamp(
      this.lookahead * (1 - EMA_ALPHA) + latencySeconds * EMA_ALPHA,
      MIN_LOOKAHEAD,
      MAX_LOOKAHEAD,
    );

    const playedUntil = this.seekTriggerTime + latencySeconds * this.rate;
    this.options.onSample?.({
      rep: this.reps,
      triggerTime: this.seekTriggerTime,
      latencyMs,
      overrunMs: (playedUntil - this.b) * 1000,
      rate: this.rate,
    });
  }

  private beginRest(): boolean {
    const rest = this.options.restSeconds ?? 0;
    if (rest <= 0) return false;

    this.player.pauseVideo();
    this.restTimer = setTimeout(() => {
      this.restTimer = null;
      if (!this.running) return;
      this.player.playVideo();
      this.phase = "armed";
    }, rest * 1000);
    return true;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
