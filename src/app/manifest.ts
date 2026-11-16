import type { MetadataRoute } from "next";

// basePath is NOT applied to URLs inside the manifest, so prefix them here.
// On GitHub Pages this is "/LoopTube"; locally it's "" (see next.config.ts).
const base = process.env.PAGES_BASE_PATH ?? "";

// Required for `output: "export"` — emit the manifest as a static file.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${base}/`,
    name: "LoopTube — 구간 반복 연습기",
    short_name: "LoopTube",
    description: "YouTube 영상의 원하는 구간을 느린 속도로 무한 반복하는 연습 도구",
    lang: "ko",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      // The artwork keeps its content inside the maskable safe zone, so the
      // same file doubles as the maskable icon.
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
