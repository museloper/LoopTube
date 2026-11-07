"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function detectMac(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? "";
  return /mac/i.test(platform);
}

/**
 * False during the static-export prerender and the first hydration pass, so
 * server and client markup match; the real value lands right after.
 */
export function useIsMac(): boolean {
  return useSyncExternalStore(subscribe, detectMac, () => false);
}
