import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "sideroom",
    short_name: "sideroom",
    description:
      "Private listening sessions for unreleased music",
    start_url: "/",
    display: "standalone",
    background_color: "#0c51da",
    theme_color: "#0c51da",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
