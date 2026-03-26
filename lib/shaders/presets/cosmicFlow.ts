import { ShaderPreset } from "../types";

const cosmicFlow: ShaderPreset = {
  name: "cosmicFlow",
  fragmentShader: `
precision mediump float;

uniform float uTime;
uniform float uAmplitude;
uniform vec2 uResolution;
uniform vec3 uPrimaryColor;
uniform vec3 uSecondaryColor;
uniform float uPixelRatio;

uniform float uSpeed;
uniform float uNoiseScale;
uniform float uWarpIntensity;
uniform float uBrightness;
uniform float uContrastBoost;
uniform float uVignetteStart;
uniform float uVignetteEnd;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
   -0.577350269189626,
    0.024390243902439
  );

  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;

  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 3; i++) {
    value += amp * snoise(p * freq);
    freq *= 2.0;
    amp *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 centered = uv - 0.5;
  float aspect = uResolution.x / uResolution.y;
  centered.x *= aspect;

  vec2 p = centered * uNoiseScale;

  // Constant slow drift — always moving regardless of audio
  float t = uTime * uSpeed;

  // Slow organic wander using different time offsets per axis
  vec2 drift = vec2(
    sin(t * 0.7 + 1.3) * 0.15 + cos(t * 0.3) * 0.1,
    cos(t * 0.5 + 2.1) * 0.15 + sin(t * 0.4) * 0.1
  );
  p += drift;

  // Domain warping — smooth, large-scale distortion
  vec2 q = vec2(
    fbm(p + vec2(0.0, t * 0.13)),
    fbm(p + vec2(5.2, t * 0.11))
  );

  float warp = uWarpIntensity + uAmplitude * 0.3;
  vec2 r = vec2(
    fbm(p + warp * q + vec2(1.7, 9.2) + t * 0.07),
    fbm(p + warp * q + vec2(8.3, 2.8) + t * 0.05)
  );

  float f = fbm(p + warp * r);

  float pattern = clamp(f * 0.5 + 0.5, 0.0, 1.0);

  // Blend album colors
  vec3 color = mix(uSecondaryColor, uPrimaryColor, pattern);

  // Audio adds subtle glow — smooth because uAmplitude is already smoothed
  float brightness = uBrightness + uAmplitude * 0.25;
  float contrast = 1.0 + uAmplitude * uContrastBoost;
  color = ((color - 0.5) * contrast + 0.5) * brightness;

  // Faint color shift from warp layers
  color += vec3(0.04, 0.02, 0.01) * (q.x + q.y) * 0.15;

  // Vignette
  float dist = length(centered);
  float vignette = 1.0 - smoothstep(uVignetteStart, uVignetteEnd, dist);
  // Premultiplied alpha — edges become fully transparent
  color *= vignette;
  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, vignette);
}
`,
};

export default cosmicFlow;
