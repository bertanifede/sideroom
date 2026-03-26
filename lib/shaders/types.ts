export interface RGBColor {
  r: number; // 0-1 normalized
  g: number;
  b: number;
}

export interface ShaderUniforms {
  uTime: WebGLUniformLocation | null;
  uAmplitude: WebGLUniformLocation | null;
  uResolution: WebGLUniformLocation | null;
  uPrimaryColor: WebGLUniformLocation | null;
  uSecondaryColor: WebGLUniformLocation | null;
  uPixelRatio: WebGLUniformLocation | null;
  uSpeed: WebGLUniformLocation | null;
  uNoiseScale: WebGLUniformLocation | null;
  uWarpIntensity: WebGLUniformLocation | null;
  uBrightness: WebGLUniformLocation | null;
  uContrastBoost: WebGLUniformLocation | null;
  uVignetteStart: WebGLUniformLocation | null;
  uVignetteEnd: WebGLUniformLocation | null;
}

export interface ShaderPreset {
  name: string;
  fragmentShader: string;
  defaults?: {
    speed?: number;
    intensity?: number;
  };
}

export interface ShaderTuning {
  speed: number;
  noiseScale: number;
  warpIntensity: number;
  brightness: number;
  contrastBoost: number;
  vignetteStart: number;
  vignetteEnd: number;
}

export const DEFAULT_TUNING: ShaderTuning = {
  speed: 0.075,
  noiseScale: 0.8,
  warpIntensity: 0.5,
  brightness: 1.45,
  contrastBoost: 0.5,
  vignetteStart: 0.15,
  vignetteEnd: 0.55,
};
