"use client";

import { ShaderTuning, DEFAULT_TUNING } from "@/lib/shaders/types";

interface ShaderDevControlsProps {
  tuning: ShaderTuning;
  onChange: (tuning: ShaderTuning) => void;
  onClose: () => void;
}

interface SliderConfig {
  key: keyof ShaderTuning;
  label: string;
  min: number;
  max: number;
  step: number;
}

const SLIDERS: SliderConfig[] = [
  { key: "speed", label: "Speed", min: 0, max: 0.3, step: 0.005 },
  { key: "noiseScale", label: "Noise Scale", min: 0.1, max: 3, step: 0.05 },
  { key: "warpIntensity", label: "Warp Intensity", min: 0, max: 4, step: 0.1 },
  { key: "brightness", label: "Brightness", min: 0.2, max: 2, step: 0.05 },
  { key: "contrastBoost", label: "Contrast Boost", min: 0, max: 1, step: 0.05 },
  { key: "vignetteStart", label: "Vignette Start", min: 0, max: 1, step: 0.05 },
  { key: "vignetteEnd", label: "Vignette End", min: 0.2, max: 2, step: 0.05 },
];

export default function ShaderDevControls({
  tuning,
  onChange,
  onClose,
}: ShaderDevControlsProps) {
  const handleChange = (key: keyof ShaderTuning, value: number) => {
    onChange({ ...tuning, [key]: value });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_TUNING });
  };

  const handleCopy = () => {
    const code = JSON.stringify(tuning, null, 2);
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="fixed top-4 left-4 z-50 w-72 bg-black/90 backdrop-blur-sm border border-white/10 rounded-lg p-4 text-white font-mono text-xs select-none">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-sm">Shader Tuning</span>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/80 text-lg leading-none"
        >
          x
        </button>
      </div>

      <div className="space-y-3">
        {SLIDERS.map(({ key, label, min, max, step }) => (
          <div key={key}>
            <div className="flex justify-between mb-1">
              <label className="text-white/60">{label}</label>
              <span className="text-white/80 tabular-nums">
                {tuning[key].toFixed(3)}
              </span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={tuning[key]}
              onChange={(e) => handleChange(key, parseFloat(e.target.value))}
              className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={handleReset}
          className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 rounded text-center transition-colors"
        >
          Reset
        </button>
        <button
          onClick={handleCopy}
          className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 rounded text-center transition-colors"
        >
          Copy JSON
        </button>
      </div>
    </div>
  );
}
