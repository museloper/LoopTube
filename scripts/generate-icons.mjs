// Regenerates the PWA icons in public/icons/ from the SVG below.
// Run with: node scripts/generate-icons.mjs
// Uses the satori/resvg renderer bundled with Next (next/og) so no extra
// image tooling is needed on the machine.
import { writeFile, mkdir } from "node:fs/promises";
import { ImageResponse } from "next/og.js";

const BG = "#0a0a0a";
const ACCENT = "#10b981"; // emerald-500, the app's accent color

// Content stays inside the central 80% circle so the same art works as a
// maskable icon (Android crops it to a circle/squircle).
const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <path d="M 256 116 A 140 140 0 1 1 132 190" fill="none" stroke="${ACCENT}" stroke-width="36" stroke-linecap="round"/>
  <path d="M 160 138 L 94 170 L 168 210 Z" fill="${ACCENT}" stroke="${ACCENT}" stroke-width="10" stroke-linejoin="round"/>
  <path d="M 222 196 L 222 316 L 322 256 Z" fill="#ededed" stroke="#ededed" stroke-width="14" stroke-linejoin="round"/>
</svg>`;

const outputs = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
];

await mkdir(new URL("../public/icons/", import.meta.url), { recursive: true });
for (const [name, size] of outputs) {
  const src = `data:image/svg+xml;base64,${Buffer.from(svg(size)).toString("base64")}`;
  const res = new ImageResponse(
    { type: "img", props: { src, width: size, height: size } },
    { width: size, height: size },
  );
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(new URL(`../public/icons/${name}`, import.meta.url), buf);
  console.log(`wrote public/icons/${name} (${buf.length} bytes)`);
}
