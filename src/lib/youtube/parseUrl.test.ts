import { describe, expect, it } from "vitest";
import { parseYouTubeUrl } from "./parseUrl";

describe("parseYouTubeUrl", () => {
  it("reads a standard watch URL", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      videoId: "dQw4w9WgXcQ",
      startSeconds: null,
    });
  });

  it("keeps the video id when a playlist tags along", () => {
    expect(
      parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=2")?.videoId,
    ).toBe("dQw4w9WgXcQ");
  });

  it.each([
    ["https://youtu.be/dQw4w9WgXcQ", "short link"],
    ["youtube.com/embed/dQw4w9WgXcQ", "embed path"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "shorts"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "live"],
    ["dQw4w9WgXcQ", "bare id"],
  ])("accepts %s (%s)", (input) => {
    expect(parseYouTubeUrl(input)?.videoId).toBe("dQw4w9WgXcQ");
  });

  it("picks up a plain second count", () => {
    expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?t=90")?.startSeconds).toBe(90);
  });

  it("picks up an h/m/s timestamp", () => {
    expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?t=1h2m3s")?.startSeconds).toBe(3723);
  });

  it("falls back to the start parameter", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&start=42")?.startSeconds).toBe(42);
  });

  it.each([
    ["https://vimeo.com/12345", "another host"],
    ["https://youtu.be/abc", "an id of the wrong length"],
    ["   ", "blank input"],
    ["not a url at all !!", "garbage"],
  ])("rejects %s (%s)", (input) => {
    expect(parseYouTubeUrl(input)).toBeNull();
  });
});
