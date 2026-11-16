"use client";

import { useEffect } from "react";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Registers public/sw.js. Production only — in `next dev` a caching worker
 * would serve stale chunks and fight hot reload.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(`${base}/sw.js`, { scope: `${base}/`, updateViaCache: "none" })
      .catch((err) => console.warn("[sw] registration failed", err));
  }, []);
  return null;
}
