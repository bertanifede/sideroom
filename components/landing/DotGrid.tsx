"use client";

import { useCallback, useEffect, useRef } from "react";

const DOT_PATTERN =
  "radial-gradient(circle, rgba(255,255,255,0.15) 0.6px, transparent 0.6px)";
const DOT_SIZE = "5px 5px";

export function DotGrid() {
  const overlayRef = useRef<HTMLDivElement>(null);

  const setMask = useCallback((value: string) => {
    const el = overlayRef.current;
    if (!el) return;
    el.style.maskImage = value;
    el.style.setProperty("-webkit-mask-image", value);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMask(`radial-gradient(circle 300px at ${e.clientX}px ${e.clientY}px, black 0%, rgba(0,0,0,0.5) 50%, transparent 100%)`);
  }, [setMask]);

  const handleMouseLeave = useCallback(() => {
    setMask("none");
  }, [setMask]);

  useEffect(() => {
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 pointer-events-none z-50 mix-blend-screen"
      style={{
        backgroundImage: DOT_PATTERN,
        backgroundSize: DOT_SIZE,
        maskImage: "none",
      }}
    />
  );
}
