"use client";

import { RefObject, useEffect, useRef } from "react";

interface PartyGlowBackgroundProps {
  primaryColor: string;
  secondaryColor: string;
  amplitudeRef: RefObject<number>;
  isPlaying: boolean;
}

export default function PartyGlowBackground({
  primaryColor,
  secondaryColor,
  amplitudeRef,
  isPlaying,
}: PartyGlowBackgroundProps) {
  const glowRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const el = glowRef.current;
    if (!el) return;

    if (!isPlaying) {
      el.style.setProperty("--glow-duration", "4s");
      el.style.setProperty("--glow-opacity-max", "0.4");
      return;
    }

    function tick() {
      if (!el) return;
      const amp = amplitudeRef.current;
      // Louder = faster pulse (1.5s-4s) + higher opacity (0.4-0.85)
      const duration = 4 - amp * 2.5;
      const opacityMax = 0.4 + amp * 0.45;
      el.style.setProperty("--glow-duration", `${duration}s`);
      el.style.setProperty("--glow-opacity-max", `${opacityMax}`);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, amplitudeRef]);

  return (
    <div
      ref={glowRef}
      className="party-glow fixed inset-0 z-0 pointer-events-none"
      style={{
        background: `radial-gradient(ellipse 50% 40% at 50% 45%, ${primaryColor} 0%, ${secondaryColor} 35%, transparent 65%)`,
      }}
    />
  );
}
