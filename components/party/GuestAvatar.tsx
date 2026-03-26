"use client";

import { Facehash } from "facehash";

const AVATAR_COLORS = [
  "#f87171", // red
  "#fb923c", // orange
  "#fbbf24", // amber
  "#a3e635", // lime
  "#34d399", // emerald
  "#22d3ee", // cyan
  "#60a5fa", // blue
  "#818cf8", // indigo
  "#a78bfa", // violet
  "#e879f9", // fuchsia
  "#fb7185", // rose
  "#2dd4bf", // teal
];

interface GuestAvatarProps {
  name: string;
  size?: number;
}

export default function GuestAvatar({ name, size = 32 }: GuestAvatarProps) {
  if (!name) return null;

  return (
    <Facehash
      name={name}
      size={size}
      colors={AVATAR_COLORS}
      enableBlink={true}
      showInitial={false}
      intensity3d="medium"
      style={{ borderRadius: "50%" }}
    />
  );
}
