"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import {
  RGBColor,
  ShaderUniforms,
  ShaderTuning,
  DEFAULT_TUNING,
} from "@/lib/shaders/types";
import {
  FULLSCREEN_VERTEX_SHADER,
  createShaderProgram,
  setupFullscreenQuad,
  getUniformLocations,
} from "@/lib/shaders/fullscreenQuad";
import presets from "@/lib/shaders/presets";

interface UseWebGLBackgroundOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  primaryColor: string;
  secondaryColor: string;
  amplitudeRef: RefObject<number>;
  isPlaying: boolean;
  preset?: string;
  enabled?: boolean;
  tuning?: ShaderTuning;
}

interface UseWebGLBackgroundResult {
  isWebGLAvailable: boolean;
  error: string | null;
}

const MAX_RESOLUTION = 1080;
const MAX_DPR = 2;
const COLOR_LERP_SPEED = 2.0;
// How fast the smoothed amplitude chases the raw value (lower = smoother)
const AMPLITUDE_SMOOTH_UP = 3.0; // rise speed (per second)
const AMPLITUDE_SMOOTH_DOWN = 1.2; // fall speed — slower decay feels musical

function parseRGBString(str: string): RGBColor {
  const match = str.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (!match) {
    const hex = str.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (hex) {
      return {
        r: parseInt(hex[1], 16) / 255,
        g: parseInt(hex[2], 16) / 255,
        b: parseInt(hex[3], 16) / 255,
      };
    }
    return { r: 0.1, g: 0.1, b: 0.12 };
  }
  return {
    r: parseInt(match[1]) / 255,
    g: parseInt(match[2]) / 255,
    b: parseInt(match[3]) / 255,
  };
}

function lerpColor(a: RGBColor, b: RGBColor, t: number): RGBColor {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

function isSoftwareRenderer(gl: WebGLRenderingContext): boolean {
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  if (!debugInfo) return false;
  const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
  return /swiftshader|llvmpipe|software/i.test(renderer);
}

function setTuningUniforms(
  gl: WebGLRenderingContext,
  uniforms: ShaderUniforms,
  tuning: ShaderTuning
) {
  gl.uniform1f(uniforms.uSpeed, tuning.speed);
  gl.uniform1f(uniforms.uNoiseScale, tuning.noiseScale);
  gl.uniform1f(uniforms.uWarpIntensity, tuning.warpIntensity);
  gl.uniform1f(uniforms.uBrightness, tuning.brightness);
  gl.uniform1f(uniforms.uContrastBoost, tuning.contrastBoost);
  gl.uniform1f(uniforms.uVignetteStart, tuning.vignetteStart);
  gl.uniform1f(uniforms.uVignetteEnd, tuning.vignetteEnd);
}

export function useWebGLBackground({
  canvasRef,
  primaryColor,
  secondaryColor,
  amplitudeRef,
  isPlaying,
  preset = "cosmicFlow",
  enabled = true,
  tuning = DEFAULT_TUNING,
}: UseWebGLBackgroundOptions): UseWebGLBackgroundResult {
  const [isWebGLAvailable, setIsWebGLAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const uniformsRef = useRef<ShaderUniforms | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const tuningRef = useRef(tuning);
  const smoothAmplitude = useRef(0);

  const targetPrimaryRef = useRef<RGBColor>(parseRGBString(primaryColor));
  const targetSecondaryRef = useRef<RGBColor>(parseRGBString(secondaryColor));
  const currentPrimaryRef = useRef<RGBColor>(parseRGBString(primaryColor));
  const currentSecondaryRef = useRef<RGBColor>(parseRGBString(secondaryColor));
  const lastFrameTimeRef = useRef(0);

  useEffect(() => {
    tuningRef.current = tuning;
  }, [tuning]);

  useEffect(() => {
    targetPrimaryRef.current = parseRGBString(primaryColor);
    targetSecondaryRef.current = parseRGBString(secondaryColor);
  }, [primaryColor, secondaryColor]);

  // Main WebGL setup + always-running render loop
  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });

    if (!gl) {
      setIsWebGLAvailable(false);
      setError("WebGL not supported");
      return;
    }

    if (isSoftwareRenderer(gl)) {
      setIsWebGLAvailable(false);
      setError("Software renderer detected");
      return;
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const shaderPreset = presets[preset];
    if (!shaderPreset) {
      setError(`Unknown preset: ${preset}`);
      setIsWebGLAvailable(false);
      return;
    }

    let program: WebGLProgram;
    try {
      program = createShaderProgram(
        gl,
        FULLSCREEN_VERTEX_SHADER,
        shaderPreset.fragmentShader
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Shader compilation failed");
      setIsWebGLAvailable(false);
      return;
    }

    gl.useProgram(program);
    setupFullscreenQuad(gl, program);
    const uniforms = getUniformLocations(gl, program);

    glRef.current = gl;
    programRef.current = program;
    uniformsRef.current = uniforms;
    startTimeRef.current = performance.now() / 1000;
    lastFrameTimeRef.current = performance.now() / 1000;

    function resize() {
      if (!canvas || !gl) return;
      const dpr = Math.min(window.devicePixelRatio, MAX_DPR);
      const rect = canvas.getBoundingClientRect();
      const w = Math.min(rect.width * dpr, MAX_RESOLUTION);
      const h = Math.min(rect.height * dpr, MAX_RESOLUTION);

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    // Always-running loop — gentle ambient drift even when paused
    function render() {
      if (!gl || !uniforms || !canvas) return;

      const now = performance.now() / 1000;
      const deltaTime = Math.min(now - lastFrameTimeRef.current, 0.1); // cap to avoid jumps
      lastFrameTimeRef.current = now;

      // Smooth the amplitude — fast rise, slow fall
      const rawAmplitude = amplitudeRef.current ?? 0;
      const speed =
        rawAmplitude > smoothAmplitude.current
          ? AMPLITUDE_SMOOTH_UP
          : AMPLITUDE_SMOOTH_DOWN;
      const ampLerp = Math.min(1, deltaTime * speed);
      smoothAmplitude.current +=
        (rawAmplitude - smoothAmplitude.current) * ampLerp;

      // Smooth colors
      const colorLerp = Math.min(1, deltaTime * COLOR_LERP_SPEED);
      currentPrimaryRef.current = lerpColor(
        currentPrimaryRef.current,
        targetPrimaryRef.current,
        colorLerp
      );
      currentSecondaryRef.current = lerpColor(
        currentSecondaryRef.current,
        targetSecondaryRef.current,
        colorLerp
      );

      const time = now - startTimeRef.current;
      const primary = currentPrimaryRef.current;
      const secondary = currentSecondaryRef.current;
      const dpr = Math.min(window.devicePixelRatio, MAX_DPR);

      gl.uniform1f(uniforms.uTime, time);
      gl.uniform1f(uniforms.uAmplitude, smoothAmplitude.current);
      gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
      gl.uniform3f(uniforms.uPrimaryColor, primary.r, primary.g, primary.b);
      gl.uniform3f(
        uniforms.uSecondaryColor,
        secondary.r,
        secondary.g,
        secondary.b
      );
      gl.uniform1f(uniforms.uPixelRatio, dpr);
      setTuningUniforms(gl, uniforms, tuningRef.current);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);

    function handleContextLost(e: Event) {
      e.preventDefault();
      cancelAnimationFrame(rafRef.current);
    }

    function handleContextRestored() {
      if (!canvas) return;
      const newGl = canvas.getContext("webgl");
      if (!newGl) return;

      try {
        const newProgram = createShaderProgram(
          newGl,
          FULLSCREEN_VERTEX_SHADER,
          shaderPreset.fragmentShader
        );
        newGl.useProgram(newProgram);
        setupFullscreenQuad(newGl, newProgram);
        const newUniforms = getUniformLocations(newGl, newProgram);

        glRef.current = newGl;
        programRef.current = newProgram;
        uniformsRef.current = newUniforms;

        resize();
        rafRef.current = requestAnimationFrame(render);
      } catch {
        setIsWebGLAvailable(false);
      }
    }

    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      if (programRef.current && glRef.current) {
        glRef.current.deleteProgram(programRef.current);
      }
      glRef.current = null;
      programRef.current = null;
      uniformsRef.current = null;
    };
  }, [canvasRef, enabled, preset, amplitudeRef]);

  return { isWebGLAvailable, error };
}
