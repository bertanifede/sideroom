"use client";

import { RefObject, useRef, useState } from "react";
import { useWebGLBackground } from "@/hooks/useWebGLBackground";
import { ShaderTuning, DEFAULT_TUNING } from "@/lib/shaders/types";
import PartyGlowBackground from "./PartyGlowBackground";
import ShaderDevControls from "./ShaderDevControls";

interface PartyWebGLBackgroundProps {
  primaryColor: string;
  secondaryColor: string;
  amplitudeRef: RefObject<number>;
  isPlaying: boolean;
  preset?: string;
}

const SHOW_TUNING_TOGGLE = process.env.NODE_ENV === "development";

export default function PartyWebGLBackground({
  primaryColor,
  secondaryColor,
  amplitudeRef,
  isPlaying,
  preset = "cosmicFlow",
}: PartyWebGLBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tuning, setTuning] = useState<ShaderTuning>({ ...DEFAULT_TUNING });
  const [showControls, setShowControls] = useState(false);

  const { isWebGLAvailable } = useWebGLBackground({
    canvasRef,
    primaryColor,
    secondaryColor,
    amplitudeRef,
    isPlaying,
    preset,
    tuning,
  });

  if (!isWebGLAvailable) {
    return (
      <PartyGlowBackground
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        amplitudeRef={amplitudeRef}
        isPlaying={isPlaying}
      />
    );
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none w-full h-full"
      />
      {SHOW_TUNING_TOGGLE && (
        <>
          {showControls ? (
            <ShaderDevControls
              tuning={tuning}
              onChange={setTuning}
              onClose={() => setShowControls(false)}
            />
          ) : (
            <button
              onClick={() => setShowControls(true)}
              className="fixed top-4 left-4 z-50 w-8 h-8 bg-black/60 hover:bg-black/80
                border border-white/10 rounded-md flex items-center justify-center
                text-white/40 hover:text-white/80 text-xs font-mono transition-colors"
              title="Shader tuning controls"
            >
              S
            </button>
          )}
        </>
      )}
    </>
  );
}
