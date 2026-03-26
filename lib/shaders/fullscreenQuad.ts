import { ShaderUniforms } from "./types";

// Fullscreen triangle — covers the entire viewport with a single triangle.
// More efficient than a quad (one drawArrays call, no index buffer).
export const FULLSCREEN_VERTEX_SHADER = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export function createShaderProgram(
  gl: WebGLRenderingContext,
  vertSrc: string,
  fragSrc: string
): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);

  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create WebGL program");

  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed: ${info}`);
  }

  // Shaders are linked; no longer needed individually
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  return program;
}

export function setupFullscreenQuad(
  gl: WebGLRenderingContext,
  program: WebGLProgram
): void {
  // Fullscreen triangle vertices (covers clip space with one oversized triangle)
  const vertices = new Float32Array([-1, -1, 3, -1, -1, 3]);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const loc = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}

export function getUniformLocations(
  gl: WebGLRenderingContext,
  program: WebGLProgram
): ShaderUniforms {
  return {
    uTime: gl.getUniformLocation(program, "uTime"),
    uAmplitude: gl.getUniformLocation(program, "uAmplitude"),
    uResolution: gl.getUniformLocation(program, "uResolution"),
    uPrimaryColor: gl.getUniformLocation(program, "uPrimaryColor"),
    uSecondaryColor: gl.getUniformLocation(program, "uSecondaryColor"),
    uPixelRatio: gl.getUniformLocation(program, "uPixelRatio"),
    uSpeed: gl.getUniformLocation(program, "uSpeed"),
    uNoiseScale: gl.getUniformLocation(program, "uNoiseScale"),
    uWarpIntensity: gl.getUniformLocation(program, "uWarpIntensity"),
    uBrightness: gl.getUniformLocation(program, "uBrightness"),
    uContrastBoost: gl.getUniformLocation(program, "uContrastBoost"),
    uVignetteStart: gl.getUniformLocation(program, "uVignetteStart"),
    uVignetteEnd: gl.getUniformLocation(program, "uVignetteEnd"),
  };
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${info}`);
  }

  return shader;
}
