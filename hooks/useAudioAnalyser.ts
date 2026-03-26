"use client";

import { useEffect, useRef, RefObject } from "react";

interface UseAudioAnalyserOptions {
  audioRef: RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  swapCount?: number;
}

export function useAudioAnalyser({ audioRef, isPlaying, swapCount }: UseAudioAnalyserOptions) {
  const amplitudeRef = useRef(0);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const connectedElementsRef = useRef(new WeakSet<HTMLAudioElement>());
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isPlaying) return;

    if (!contextRef.current) {
      contextRef.current = new AudioContext();
    }

    const ctx = contextRef.current;

    if (!analyserRef.current) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
    }

    // Connect this element if not already connected
    if (!connectedElementsRef.current.has(audio)) {
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyserRef.current);
      connectedElementsRef.current.add(audio);
    }

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser!.getByteFrequencyData(dataArray);
      let sum = 0;
      let weightSum = 0;
      for (let i = 0; i < 32; i++) {
        const weight = i < 8 ? 1.0 : i < 16 ? 0.5 : 0.25;
        sum += dataArray[i] * weight;
        weightSum += weight;
      }
      amplitudeRef.current = sum / (weightSum * 255);
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [audioRef, isPlaying, swapCount]);

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (contextRef.current) {
        contextRef.current.close();
      }
    };
  }, []);

  return { amplitudeRef };
}
