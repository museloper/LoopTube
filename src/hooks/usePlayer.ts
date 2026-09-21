"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadYouTubeApi } from "@/lib/youtube/loadApi";
import { PlayerError, PlayerState, type PlayerStateValue, type YTPlayer } from "@/lib/youtube/types";

const DEFAULT_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export interface UsePlayerResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  player: YTPlayer | null;
  ready: boolean;
  playerState: PlayerStateValue;
  duration: number;
  /** Confirmed by onPlaybackRateChange — never assumed from setPlaybackRate. */
  rate: number;
  availableRates: number[];
  error: string | null;
  /**
   * Video ids of the most recently resolved playlist, in order. Persists
   * across loading an individual video from that list (so it stays
   * browsable) until a new playlist is cued or clearPlaylist() is called.
   */
  playlistIds: string[];
  load: (videoId: string, startSeconds?: number) => void;
  cuePlaylist: (playlistId: string) => void;
  clearPlaylist: () => void;
  requestRate: (rate: number) => void;
}

function describeError(code: number): string {
  switch (code) {
    case PlayerError.EMBED_DISALLOWED:
    case PlayerError.EMBED_DISALLOWED_ALT:
      return "이 영상은 저작권자가 외부 재생을 막아두었습니다. YouTube에서만 볼 수 있어요.";
    case PlayerError.NOT_FOUND:
      return "영상을 찾을 수 없습니다. 삭제되었거나 비공개일 수 있어요.";
    case PlayerError.INVALID_PARAM:
      return "영상 ID가 올바르지 않습니다.";
    default:
      return "영상을 재생할 수 없습니다. 다른 영상으로 시도해 주세요.";
  }
}

export function usePlayer(): UsePlayerResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  /** Mirrors the state copy so callbacks never close over a stale player. */
  const playerRef = useRef<YTPlayer | null>(null);
  /** Survives the cue-time rate reset so we can re-apply the user's choice. */
  const desiredRateRef = useRef(1);
  const pendingLoadRef = useRef<{ videoId: string; startSeconds: number } | null>(null);
  const pendingPlaylistRef = useRef<string | null>(null);

  const [player, setPlayer] = useState<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerStateValue>(PlayerState.UNSTARTED);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [availableRates, setAvailableRates] = useState<number[]>(DEFAULT_RATES);
  const [error, setError] = useState<string | null>(null);
  const [playlistIds, setPlaylistIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !containerRef.current) return;

        const instance = new YT.Player(containerRef.current, {
          playerVars: {
            // Without playsinline iOS force-fullscreens playback and our
            // controls disappear behind the native player.
            playsinline: 1,
            rel: 0,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              // Publishing the player from onReady rather than from the
              // constructor keeps consumers from touching it before its
              // methods exist.
              setPlayer(e.target);
              setReady(true);
              setAvailableRates(readRates(e.target));
              const queued = pendingLoadRef.current;
              const queuedPlaylist = pendingPlaylistRef.current;
              if (queued) {
                pendingLoadRef.current = null;
                e.target.loadVideoById(queued.videoId, queued.startSeconds);
              } else if (queuedPlaylist) {
                pendingPlaylistRef.current = null;
                e.target.cuePlaylist({ list: queuedPlaylist, listType: "playlist" });
              }
            },
            onStateChange: (e) => {
              if (cancelled) return;
              const state = e.data as PlayerStateValue;
              setPlayerState(state);

              if (state === PlayerState.CUED || state === PlayerState.PLAYING) {
                setDuration(e.target.getDuration());
                setAvailableRates(readRates(e.target));
                // Loading a video resets the rate to 1, so put it back.
                if (e.target.getPlaybackRate() !== desiredRateRef.current) {
                  e.target.setPlaybackRate(desiredRateRef.current);
                }
                // Undefined right after loadVideoById (no playlist context).
                // Leave playlistIds as-is then, rather than clearing it, so
                // picking a video out of a resolved list doesn't drop the list.
                const ids = e.target.getPlaylist();
                if (Array.isArray(ids) && ids.length > 0) setPlaylistIds(ids);
              }
            },
            onPlaybackRateChange: (e) => {
              if (!cancelled) setRate(e.data);
            },
            onError: (e) => {
              if (!cancelled) setError(describeError(e.data));
            },
          },
        });
        playerRef.current = instance;
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
      setPlayer(null);
    };
  }, []);

  const load = useCallback((videoId: string, startSeconds = 0) => {
    setError(null);
    setDuration(0);
    pendingPlaylistRef.current = null;
    const player = playerRef.current;
    if (!player) {
      pendingLoadRef.current = { videoId, startSeconds };
      return;
    }
    player.loadVideoById(videoId, startSeconds);
  }, []);

  const cuePlaylist = useCallback((playlistId: string) => {
    setError(null);
    setDuration(0);
    setPlaylistIds([]);
    pendingLoadRef.current = null;
    const player = playerRef.current;
    if (!player) {
      pendingPlaylistRef.current = playlistId;
      return;
    }
    player.cuePlaylist({ list: playlistId, listType: "playlist" });
  }, []);

  const clearPlaylist = useCallback(() => setPlaylistIds([]), []);

  const requestRate = useCallback((next: number) => {
    desiredRateRef.current = next;
    playerRef.current?.setPlaybackRate(next);
  }, []);

  return {
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
  };
}

/** Never hard-code the rate list: it varies by video and by player build. */
function readRates(player: YTPlayer): number[] {
  const rates = player.getAvailablePlaybackRates?.();
  return Array.isArray(rates) && rates.length > 0 ? rates : DEFAULT_RATES;
}
