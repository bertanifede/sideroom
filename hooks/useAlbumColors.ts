"use client";

import { useEffect, useState } from "react";

interface AlbumColors {
  primary: string;
  secondary: string;
  palette: string[];
}

const DEFAULT_COLORS: AlbumColors = {
  primary: "#0c51da",
  secondary: "#4a9aff",
  palette: ["#0c51da", "#4a9aff", "#ffffff"],
};

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function colorDistance(a: number[], b: number[]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function extractPalette(imageData: ImageData, count: number): string[] {
  const pixels: number[][] = [];
  const data = imageData.data;

  // Sample every 4th pixel for performance
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const [, s, l] = rgbToHsl(r, g, b);
    // Skip very dark, very light, and very desaturated pixels
    if (l > 0.1 && l < 0.9 && s > 0.15) {
      pixels.push([r, g, b, s]);
    }
  }

  if (pixels.length === 0) {
    // Fallback: just sample all pixels without saturation filter
    for (let i = 0; i < data.length; i += 16) {
      pixels.push([data[i], data[i + 1], data[i + 2], 0]);
    }
  }

  // Sort by saturation descending — prefer vibrant colors
  pixels.sort((a, b) => b[3] - a[3]);

  // Pick distinct colors from the most saturated pixels
  const picked: number[][] = [];
  for (const px of pixels) {
    if (picked.length >= count) break;
    const rgb = [px[0], px[1], px[2]];
    // Ensure this color is sufficiently different from already picked ones
    const tooClose = picked.some((p) => colorDistance(p, rgb) < 80);
    if (!tooClose) {
      picked.push(rgb);
    }
  }

  // Pad with fallback if not enough distinct colors
  while (picked.length < count) {
    picked.push(picked.length === 0 ? [12, 81, 218] : [74, 154, 255]);
  }

  return picked.map(([r, g, b]) => `rgb(${r}, ${g}, ${b})`);
}

export function useAlbumColors(
  imageUrl: string | null,
  fallbackColors?: { primary: string; secondary: string }
): AlbumColors {
  const fallback: AlbumColors = fallbackColors
    ? { ...fallbackColors, palette: [fallbackColors.primary, fallbackColors.secondary, "#ffffff"] }
    : DEFAULT_COLORS;
  const [colors, setColors] = useState<AlbumColors>(fallback);

  useEffect(() => {
    if (!imageUrl) {
      setColors(fallback);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 64; // small for performance
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { setColors(fallback); return; }

      ctx.drawImage(img, 0, 0, size, size);
      const imageData = ctx.getImageData(0, 0, size, size);
      const palette = extractPalette(imageData, 3);

      setColors({
        primary: palette[0],
        secondary: palette[1],
        palette,
      });
    };
    img.onerror = () => setColors(fallback);
    img.src = imageUrl;
  }, [imageUrl, fallback.primary, fallback.secondary]);

  return colors;
}
