"use client";

import { RefObject, useEffect, useRef } from "react";

interface ArtworkAuraProps {
  colors?: string[];
  /** Scale relative to the artwork (1 = same size, 1.5 = 50% larger) */
  scale?: number;
  /** Blur amount in px */
  blur?: number;
  /** Grain intensity 0-1 */
  grain?: number;
  /** Pulse speed in seconds per cycle */
  pulseSpeed?: number;
  /** Audio amplitude ref (0-1), drives blob reactivity */
  amplitudeRef?: RefObject<number>;
}

function toRgba(color: string, alpha: number): string {
  // Parse hex (#rrggbb) or rgb(r, g, b) into rgba
  const hex = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) {
    return `rgba(${parseInt(hex[1], 16)}, ${parseInt(hex[2], 16)}, ${parseInt(hex[3], 16)}, ${alpha})`;
  }
  const rgb = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgb) {
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  }
  return color;
}

export default function ArtworkAura({
  colors = ["#4a9aff", "#0c51da", "#ffffff"],
  scale = 1.6,
  blur = 80,
  grain = 0.35,
  pulseSpeed = 4,
  amplitudeRef,
}: ArtworkAuraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 400;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    // Pre-generate a grain texture
    const grainCanvas = document.createElement("canvas");
    grainCanvas.width = size;
    grainCanvas.height = size;
    const grainCtx = grainCanvas.getContext("2d")!;
    const grainData = grainCtx.createImageData(size, size);
    for (let i = 0; i < grainData.data.length; i += 4) {
      const v = Math.random() * 255;
      grainData.data[i] = v;
      grainData.data[i + 1] = v;
      grainData.data[i + 2] = v;
      grainData.data[i + 3] = 255;
    }
    grainCtx.putImageData(grainData, 0, 0);

    function draw(time: number) {
      if (!ctx || !canvas) return;

      const t = time / 1000;
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;

      const amp = amplitudeRef?.current ?? 0;

      // Pulsing blobs — audio amplitude boosts radius and drift
      for (let i = 0; i < colors.length; i++) {
        const phase = (i / colors.length) * Math.PI * 2;
        const basePulse = 0.7 + 0.3 * Math.sin((t * Math.PI * 2) / pulseSpeed + phase);
        const pulse = basePulse + amp * 0.4;
        const radius = (size * 0.45) * pulse;
        // Orbital drift — amplitude widens the orbit
        const driftScale = 0.12 + amp * 0.08;
        const ox = Math.sin(t * 0.3 + phase) * size * driftScale;
        const oy = Math.cos(t * 0.25 + phase * 1.3) * size * driftScale;

        const grad = ctx.createRadialGradient(
          cx + ox, cy + oy, 0,
          cx + ox, cy + oy, radius
        );
        grad.addColorStop(0, toRgba(colors[i], 0.93));
        grad.addColorStop(0.4, toRgba(colors[i], 0.53));
        grad.addColorStop(0.7, toRgba(colors[i], 0.2));
        grad.addColorStop(1, toRgba(colors[i], 0));

        ctx.globalCompositeOperation = i === 0 ? "source-over" : "screen";
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Overlay grain — only where blobs have been drawn (source-atop)
      if (grain > 0) {
        ctx.globalCompositeOperation = "source-atop";
        ctx.globalAlpha = grain;
        ctx.drawImage(grainCanvas, 0, 0, size, size);
        ctx.globalAlpha = 1;
      }

      ctx.globalCompositeOperation = "source-over";
      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef.current);
    };
  }, [colors, grain, pulseSpeed]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute pointer-events-none"
      style={{
        width: `${scale * 100}%`,
        height: `${scale * 100}%`,
        top: `${((1 - scale) / 2) * 100}%`,
        left: `${((1 - scale) / 2) * 100}%`,
        filter: `blur(${blur}px)`,
        opacity: 1,
      }}
    />
  );
}
