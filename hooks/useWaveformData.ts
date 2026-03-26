"use client";

import { useState, useEffect } from "react";

const BAR_COUNT = 200;

export function useWaveformData(audioUrl: string | null) {
  const [bars, setBars] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!audioUrl) return;

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();

        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Use first channel
        const channelData = audioBuffer.getChannelData(0);
        const samplesPerBar = Math.floor(channelData.length / BAR_COUNT);
        const peaks: number[] = [];

        for (let i = 0; i < BAR_COUNT; i++) {
          let peak = 0;
          const start = i * samplesPerBar;
          for (let j = start; j < start + samplesPerBar && j < channelData.length; j++) {
            const abs = Math.abs(channelData[j]);
            if (abs > peak) peak = abs;
          }
          peaks.push(peak);
        }

        // Normalize to 0-1
        const max = Math.max(...peaks, 0.01);
        const normalized = peaks.map((p) => p / max);

        await audioContext.close();

        if (!cancelled) {
          setBars(normalized);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioUrl]);

  return { bars, isLoading };
}
