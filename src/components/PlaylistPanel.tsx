"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { fetchVideoMeta, type VideoMeta } from "@/lib/youtube/oembed";

interface PlaylistPanelProps {
  videoIds: string[];
  activeVideoId: string | null;
  onSelect: (videoId: string) => void;
  onClose: () => void;
}

/** Keeps oEmbed lookups polite on long playlists instead of firing them all at once. */
const CONCURRENCY = 6;

export function PlaylistPanel({ videoIds, activeVideoId, onSelect, onClose }: PlaylistPanelProps) {
  const [metaById, setMetaById] = useState<Record<string, VideoMeta | null>>({});

  useEffect(() => {
    // Ids are globally unique, so entries from a previous list are simply
    // never read again — no need to clear the map when videoIds changes.
    let cancelled = false;
    let cursor = 0;

    async function worker() {
      while (!cancelled) {
        const index = cursor++;
        if (index >= videoIds.length) return;
        const id = videoIds[index];
        const meta = await fetchVideoMeta(id);
        if (!cancelled) setMetaById((prev) => ({ ...prev, [id]: meta }));
      }
    }

    Array.from({ length: Math.min(CONCURRENCY, videoIds.length) }, worker);

    return () => {
      cancelled = true;
    };
  }, [videoIds]);

  if (videoIds.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          재생목록 · {videoIds.length}개 영상
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-800 hover:text-neutral-300"
        >
          닫기
        </button>
      </div>
      <ol className="flex max-h-80 flex-col gap-1 overflow-y-auto rounded-xl bg-neutral-900 p-2">
        {videoIds.map((id, index) => {
          const meta = metaById[id];
          const active = id === activeVideoId;
          return (
            <li key={`${id}-${index}`}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${
                  active ? "bg-emerald-500/15 ring-1 ring-emerald-500" : "hover:bg-neutral-800"
                }`}
              >
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                  {index + 1}
                </span>
                <Image
                  src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`}
                  alt=""
                  width={112}
                  height={63}
                  unoptimized
                  className="h-9 w-16 shrink-0 rounded bg-neutral-800 object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-100">
                  {meta === undefined ? "불러오는 중…" : (meta?.title ?? id)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
