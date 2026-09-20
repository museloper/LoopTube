/** 83.4 -> "1:23.4" — tenths matter when nudging a loop point. */
export function formatTime(seconds: number, withTenths = true): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;

  // Round to tenths first and derive everything from that, so 59.9 cannot
  // become "0:59.8" via a floating-point remainder, and 59.96 carries into
  // the next second instead of showing a tenths digit of 10.
  const deciseconds = Math.round(seconds * 10);
  const total = Math.floor(deciseconds / 10);
  const tenths = deciseconds % 10;

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const base =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
      : `${minutes}:${String(secs).padStart(2, "0")}`;

  return withTenths ? `${base}.${tenths}` : base;
}
