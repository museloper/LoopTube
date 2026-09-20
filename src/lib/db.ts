import Dexie, { type EntityTable } from "dexie";

export interface Loop {
  id: string;
  videoId: string;
  videoTitle: string;
  label: string;
  startSec: number;
  endSec: number;
  playbackRate: number;
  createdAt: number;
  updatedAt: number;
  /** Set once the row has been pushed to Supabase; null means local-only. */
  syncedAt: number | null;
  /** Tombstone, so a delete can still propagate on the next sync. */
  deleted: boolean;
}

const db = new Dexie("looptube") as Dexie & {
  loops: EntityTable<Loop, "id">;
};

// videoId is indexed so the library can filter to the video on screen.
db.version(1).stores({
  loops: "id, videoId, updatedAt, syncedAt, deleted",
});

export { db };

export function newLoopId() {
  return crypto.randomUUID();
}

export async function saveLoop(
  input: Omit<Loop, "id" | "createdAt" | "updatedAt" | "syncedAt" | "deleted"> & { id?: string },
): Promise<string> {
  const now = Date.now();
  const id = input.id ?? newLoopId();
  const existing = input.id ? await db.loops.get(input.id) : undefined;

  await db.loops.put({
    ...input,
    id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    syncedAt: null,
    deleted: false,
  });
  return id;
}

/** Soft delete, so the row can still be reconciled with the server later. */
export async function deleteLoop(id: string) {
  await db.loops.update(id, { deleted: true, updatedAt: Date.now(), syncedAt: null });
}

export function listLoops(videoId?: string) {
  const collection = videoId
    ? db.loops.where("videoId").equals(videoId)
    : db.loops.toCollection();
  return collection.filter((loop) => !loop.deleted).reverse().sortBy("updatedAt");
}
