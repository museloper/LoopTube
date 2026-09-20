export interface ParsedVideo {
  videoId: string;
  /** Seconds from a ?t= / ?start= parameter, if the URL carried one. */
  startSeconds: number | null;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** "1h2m3s" | "90s" | "90" -> seconds */
function parseTimeParam(raw: string | null): number | null {
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match || !match[0]) return null;
  const [, h, m, s] = match;
  const total = Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
  return total > 0 ? total : null;
}

/**
 * Accepts a bare video id or any of the URL shapes YouTube hands out:
 * watch?v=, youtu.be/, /embed/, /shorts/, /live/.
 */
export function parseYouTubeUrl(input: string): ParsedVideo | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (ID_PATTERN.test(trimmed)) return { videoId: trimmed, startSeconds: null };

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  let videoId: string | null = null;

  if (host === "youtu.be") {
    videoId = url.pathname.slice(1).split("/")[0] ?? null;
  } else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] === "watch") videoId = url.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(segments[0] ?? "")) videoId = segments[1] ?? null;
  }

  if (!videoId || !ID_PATTERN.test(videoId)) return null;

  const startSeconds =
    parseTimeParam(url.searchParams.get("t")) ?? parseTimeParam(url.searchParams.get("start"));

  return { videoId, startSeconds };
}
