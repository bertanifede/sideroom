"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { TrackAnnotation } from "@/types";

interface WaveformDisplayProps {
  bars: number[];
  duration: number;
  currentTime: number;
  annotations: TrackAnnotation[];
  accentColor: string;
  surfaceColor: string;
  fgColor: string;
  onSeek: (timestampSec: number) => void;
}

export default function WaveformDisplay({
  bars,
  duration,
  currentTime,
  annotations,
  accentColor,
  surfaceColor,
  fgColor,
  onSeek,
}: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || bars.length === 0 || !duration) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const barWidth = width / bars.length;
    const gap = Math.max(1, barWidth * 0.2);
    const barDrawWidth = barWidth - gap;
    const progress = duration > 0 ? currentTime / duration : 0;
    const progressX = progress * width;

    ctx.clearRect(0, 0, width, height);

    // Draw bars
    const barAreaHeight = height - 16; // reserve top 16px for annotation markers
    const barTop = 16;

    for (let i = 0; i < bars.length; i++) {
      const x = i * barWidth;
      const barHeight = Math.max(2, bars[i] * barAreaHeight * 0.9);
      const y = barTop + (barAreaHeight - barHeight) / 2;

      ctx.fillStyle = x + barWidth <= progressX ? accentColor : surfaceColor;
      ctx.fillRect(x + gap / 2, y, barDrawWidth, barHeight);
    }

    // Draw annotation markers
    for (const ann of annotations) {
      const x = (ann.timestamp_sec / duration) * width;
      ctx.beginPath();
      ctx.arc(x, 8, 4, 0, Math.PI * 2);
      ctx.fillStyle = fgColor;
      ctx.globalAlpha = 0.7;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Draw playhead
    if (progress > 0 && progress < 1) {
      ctx.fillStyle = fgColor;
      ctx.fillRect(progressX - 1, barTop, 2, barAreaHeight);
    }
  }, [bars, duration, currentTime, annotations, accentColor, surfaceColor, fgColor]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  const [isDragging, setIsDragging] = useState(false);

  const seekFromEvent = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return;
    const rect = canvas.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(fraction * duration);
  }, [duration, onSeek]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    seekFromEvent(e.clientX);
  }, [seekFromEvent]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => seekFromEvent(e.clientX);
    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, seekFromEvent]);

  // Touch support for mobile drag-to-scrub
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    seekFromEvent(e.touches[0].clientX);
  }, [seekFromEvent]);

  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      seekFromEvent(e.touches[0].clientX);
    };
    const handleTouchEnd = () => setIsDragging(false);

    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, seekFromEvent]);

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        className="w-full h-20 cursor-pointer rounded select-none"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      />
      <p className="text-[10px] mt-1 opacity-40">
        Click or drag to seek
      </p>
    </div>
  );
}
