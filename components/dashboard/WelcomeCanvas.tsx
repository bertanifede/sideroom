"use client";

import { useRef, useEffect, useCallback } from "react";
import Link from "next/link";

interface Dot {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface WelcomeCanvasProps {
  headline?: string;
  subheadline?: string;
  ctaLabel?: string;
  ctaHref?: string;
  fast?: boolean;
}

export function WelcomeCanvas({
  headline = "The room is empty",
  subheadline = "Let\u2019s change that",
  ctaLabel = "+ Throw a Party",
  ctaHref = "/create-party",
  fast = false,
}: WelcomeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef<number>(0);

  const SPACING = 22;
  const DOT_RADIUS = 0.8;
  const REPEL_RADIUS = 100;
  const REPEL_STRENGTH = 8;
  const SPRING = 0.03;
  const DAMPING = 0.85;

  const initDots = useCallback(
    (width: number, height: number) => {
      const dots: Dot[] = [];
      const cols = Math.ceil(width / SPACING) + 1;
      const rows = Math.ceil(height / SPACING) + 1;
      const offsetX = (width - (cols - 1) * SPACING) / 2;
      const offsetY = (height - (rows - 1) * SPACING) / 2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = offsetX + c * SPACING;
          const y = offsetY + r * SPACING;
          dots.push({ baseX: x, baseY: y, x, y, vx: 0, vy: 0 });
        }
      }
      dotsRef.current = dots;
    },
    [SPACING]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      const rect = container!.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      canvas!.style.width = `${rect.width}px`;
      canvas!.style.height = `${rect.height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      initDots(rect.width, rect.height);
    }

    resize();
    window.addEventListener("resize", resize);

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onMouseLeave() {
      mouseRef.current = { x: -1000, y: -1000 };
    }

    function onTouchMove(e: TouchEvent) {
      const rect = canvas!.getBoundingClientRect();
      const touch = e.touches[0];
      mouseRef.current = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }

    function onTouchEnd() {
      mouseRef.current = { x: -1000, y: -1000 };
    }

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd);

    function animate() {
      const dots = dotsRef.current;
      const { x: mx, y: my } = mouseRef.current;
      const w = canvas!.width / (window.devicePixelRatio || 1);
      const h = canvas!.height / (window.devicePixelRatio || 1);

      ctx!.clearRect(0, 0, w, h);

      for (const dot of dots) {
        const dx = dot.x - mx;
        const dy = dot.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < REPEL_RADIUS && dist > 0) {
          const force = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH;
          dot.vx += (dx / dist) * force;
          dot.vy += (dy / dist) * force;
        }

        // Spring back to base
        dot.vx += (dot.baseX - dot.x) * SPRING;
        dot.vy += (dot.baseY - dot.y) * SPRING;

        // Damping
        dot.vx *= DAMPING;
        dot.vy *= DAMPING;

        dot.x += dot.vx;
        dot.y += dot.vy;

        // Calculate displacement for opacity boost
        const dispX = dot.x - dot.baseX;
        const dispY = dot.y - dot.baseY;
        const displacement = Math.sqrt(dispX * dispX + dispY * dispY);
        const alpha = Math.min(0.05 + displacement * 0.015, 0.5);

        ctx!.beginPath();
        ctx!.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx!.fill();
      }

      rafRef.current = requestAnimationFrame(animate);
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [initDots]);

  return (
    <div ref={containerRef} className="flex-1 relative">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 pointer-events-none">
        <div className="text-center">
          <h1
            className="text-3xl sm:text-4xl font-semibold text-text-primary mb-2"
            style={{ opacity: 0, animation: `fadeIn ${fast ? "0.5s" : "0.8s"} ease ${fast ? "0.05s" : "0.2s"} forwards` }}
          >
            {headline}
          </h1>
          <p
            className="text-lg sm:text-xl text-text-secondary"
            style={{ opacity: 0, animation: `fadeIn ${fast ? "0.5s" : "0.8s"} ease ${fast ? "0.2s" : "0.6s"} forwards` }}
          >
            {subheadline}
          </p>
        </div>
        <Link
          href={ctaHref}
          className="pointer-events-auto px-6 py-3 border border-surface-border bg-surface rounded-full font-medium font-pixel hover:bg-brand-blue transition-colors cursor-pointer"
          style={{ opacity: 0, animation: `fadeIn ${fast ? "0.5s" : "0.8s"} ease ${fast ? "0.35s" : "1.0s"} forwards` }}
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
