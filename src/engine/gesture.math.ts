export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function formatSignedDeltaMs(deltaMs: number): string {
  const sign = deltaMs >= 0 ? '+' : '-';
  const absSeconds = Math.round(Math.abs(deltaMs) / 1000);
  const mins = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${sign}${pad(mins)}:${pad(secs)}`;
}

export function calculateVerticalSwipeValue(
  initialValue: number,
  translationY: number,
  containerHeight: number,
  maxLimit = 1.0
): number {
  const sensitivity = 1.25;
  const delta = (-translationY / Math.max(containerHeight, 200)) * sensitivity * maxLimit;
  const raw = initialValue + delta;
  return Math.max(0, Math.min(maxLimit, Number(raw.toFixed(2))));
}

export function calculateHorizontalSeekTarget(
  initialPositionMs: number,
  translationX: number,
  containerWidth: number,
  durationMs: number
): { targetMs: number; deltaMs: number } {
  const fullSwipeSpanMs = Math.min(Math.max(durationMs * 0.35, 30000), 180000);
  const ratio = translationX / Math.max(containerWidth, 250);
  const deltaMs = Math.round(ratio * fullSwipeSpanMs);
  const targetMs = Math.max(0, Math.min(durationMs, initialPositionMs + deltaMs));
  return { targetMs, deltaMs: targetMs - initialPositionMs };
}
