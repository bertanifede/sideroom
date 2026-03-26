import { interpolate, spring } from "remotion";

export function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function fadeIn(frame: number, durationFrames: number): number {
  return interpolate(frame, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function fadeOut(frame: number, endFrame: number, durationFrames: number): number {
  return interpolate(frame, [endFrame - durationFrames, endFrame], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function slideUp(frame: number, fps: number, delay: number = 0): number {
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });
  return interpolate(progress, [0, 1], [20, 0]);
}

export function typewriter(frame: number, text: string, charsPerFrame: number = 0.5): string {
  const chars = Math.min(text.length, Math.floor(frame * charsPerFrame));
  return text.slice(0, chars);
}

export function springEntrance(frame: number, fps: number, delay: number = 0): number {
  return spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });
}
