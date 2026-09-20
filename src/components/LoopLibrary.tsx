"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { deleteLoop, listLoops, type Loop } from "@/lib/db";
import { formatTime } from "@/lib/format";

interface LoopLibraryProps {
  videoId: string | null;
  onApply: (loop: Loop) => void;
}

export function LoopLibrary({ videoId, onApply }: LoopLibraryProps) {
  const loops = useLiveQuery(() => listLoops(), [], [] as Loop[]);

  if (!loops || loops.length === 0) {
    return (
      <p className="rounded-xl bg-neutral-900 p-4 text-center text-xs text-neutral-500">
        저장된 구간이 없습니다. 구간을 지정하고 저장해 보세요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {loops.map((loop) => (
        <li
          key={loop.id}
          className={`flex items-center gap-2 rounded-xl bg-neutral-900 p-3 ${
            loop.videoId === videoId ? "ring-1 ring-emerald-500/40" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => onApply(loop)}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate text-sm text-neutral-200">{loop.label || loop.videoTitle}</p>
            <p className="mt-0.5 font-mono text-xs tabular-nums text-neutral-500">
              {formatTime(loop.startSec)} – {formatTime(loop.endSec)} · {loop.playbackRate}x
            </p>
          </button>
          <button
            type="button"
            onClick={() => deleteLoop(loop.id)}
            aria-label="삭제"
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-neutral-500 transition hover:bg-neutral-800 hover:text-red-400"
          >
            삭제
          </button>
        </li>
      ))}
    </ul>
  );
}
