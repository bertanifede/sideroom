import { useCurrentFrame, useVideoConfig } from "remotion";
import { useRef, useEffect } from "react";
import { AURA_COLORS } from "../data/demo-data";

function toRgba(color: string, alpha: number): string {
  const hex = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex) {
    return `rgba(${parseInt(hex[1], 16)}, ${parseInt(hex[2], 16)}, ${parseInt(hex[3], 16)}, ${alpha})`;
  }
  return color;
}

type ArtworkAuraProps = {
  colors?: string[];
  scale?: number;
  blur?: number;
  grain?: number;
  pulseSpeed?: number;
};

export const ArtworkAura: React.FC<ArtworkAuraProps> = ({
  colors = AURA_COLORS,
  scale = 2.2,
  blur = 50,
  grain = 0.35,
  pulseSpeed = 4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grainCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const size = 400;
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
    grainCanvasRef.current = grainCanvas;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const grainCanvas = grainCanvasRef.current;
    if (!canvas || !grainCanvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 400;
    const t = frame / fps;
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const amp = 0.3 + 0.2 * Math.sin(t * 2.5);

    for (let i = 0; i < colors.length; i++) {
      const phase = (i / colors.length) * Math.PI * 2;
      const basePulse = 0.7 + 0.3 * Math.sin((t * Math.PI * 2) / pulseSpeed + phase);
      const pulse = basePulse + amp * 0.4;
      const radius = (size * 0.45) * pulse;
      const driftScale = 0.12 + amp * 0.08;
      const ox = Math.sin(t * 0.3 + phase) * size * driftScale;
      const oy = Math.cos(t * 0.25 + phase * 1.3) * size * driftScale;

      const grad = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, radius);
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

    if (grain > 0) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = grain;
      ctx.drawImage(grainCanvas, 0, 0, size, size);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";
  }, [frame, fps, colors, grain, pulseSpeed]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={400}
      style={{
        width: "100%",
        height: "100%",
        filter: `blur(${blur}px)`,
        pointerEvents: "none",
      }}
    />
  );
};
