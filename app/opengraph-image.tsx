import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "sideroom — Private listening sessions for unreleased music";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  const fontData = await readFile(
    join(process.cwd(), "public/fonts/GeistPixel-Circle.ttf")
  );

  // Build dot grid as SVG data URI for the background
  const dotSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"><circle cx="2.5" cy="2.5" r="0.6" fill="rgba(255,255,255,0.3)"/></svg>`;
  const dotBg = `url("data:image/svg+xml,${encodeURIComponent(dotSvg)}")`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0c51da",
          backgroundImage: dotBg,
          backgroundSize: "5px 5px",
          padding: "80px",
          fontFamily: "GeistPixel",
          position: "relative",
        }}
      >
        {/* Headline — true center */}
        <div
          style={{
            color: "white",
            fontSize: 56,
            textAlign: "center",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
          }}
        >
          Private listening sessions for your unreleased music
        </div>
        {/* sideroom — absolute, 26px below center block */}
        <div
          style={{
            position: "absolute",
            bottom: 150,
            color: "rgba(255,255,255,0.7)",
            fontSize: 28,
            letterSpacing: "0.25em",
            fontWeight: 900,
          }}
        >
          sideroom
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "GeistPixel",
          data: fontData,
          style: "normal",
          weight: 500,
        },
      ],
    }
  );
}
