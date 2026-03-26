export interface FontOption {
  id: string;       // stored in DB as theme.font ("" = default Geist Sans)
  label: string;    // display name
  css: string;      // CSS font-family value
  google?: boolean; // true = load from Google Fonts
}

export const FONT_OPTIONS: FontOption[] = [
  { id: "", label: "Sans", css: "var(--font-geist-sans), sans-serif" },
  { id: "mono", label: "Mono", css: "var(--font-geist-mono), monospace" },
  { id: "pixel", label: "Pixel", css: "var(--font-geist-pixel-circle), sans-serif" },
  { id: "Times New Roman", label: "Times", css: "'Times New Roman', Times, serif" },
  { id: "Space Grotesk", label: "Space Grotesk", css: "'Space Grotesk', sans-serif", google: true },
  { id: "DM Sans", label: "DM Sans", css: "'DM Sans', sans-serif", google: true },
  { id: "Playfair Display", label: "Playfair", css: "'Playfair Display', serif", google: true },
  { id: "Space Mono", label: "Space Mono", css: "'Space Mono', monospace", google: true },
  { id: "Outfit", label: "Outfit", css: "'Outfit', sans-serif", google: true },
  { id: "Sora", label: "Sora", css: "'Sora', sans-serif", google: true },
];

/** Get the CSS font-family string for a font id */
export function getFontCss(fontId: string | undefined | null): string {
  const match = FONT_OPTIONS.find((f) => f.id === fontId);
  return match?.css ?? FONT_OPTIONS[0].css;
}

/** Get the Google Fonts stylesheet URL, or null if not a Google Font */
export function getGoogleFontUrl(fontId: string | undefined | null): string | null {
  const match = FONT_OPTIONS.find((f) => f.id === fontId);
  if (!match?.google) return null;
  const family = match.id.replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700&display=swap`;
}
