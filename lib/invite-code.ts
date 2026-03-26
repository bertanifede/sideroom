const adjectives = [
  "cosmic", "velvet", "golden", "silent", "lunar", "neon", "crystal", "shadow",
  "amber", "violet", "copper", "mystic", "arctic", "solar", "thunder", "iron",
  "coral", "ember", "frost", "jade", "ocean", "ruby", "sage", "dusk",
];

const nouns = [
  "session", "groove", "wave", "echo", "pulse", "loop", "vibe", "tone",
  "drift", "bloom", "spark", "chord", "bass", "beat", "haze", "glow",
  "sonic", "flux", "realm", "orbit", "phase", "ride", "rush", "dawn",
];

function secureRandomIndex(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

export function generateInviteCode(): string {
  const adj = adjectives[secureRandomIndex(adjectives.length)];
  const noun = nouns[secureRandomIndex(nouns.length)];
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${adj}-${noun}-${hex}`;
}
