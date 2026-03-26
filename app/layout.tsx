import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { GeistPixelCircle } from "geist/font/pixel";
import { Toaster } from "sonner";
import "./globals.css";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
  || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "sideroom — Private listening sessions for unreleased music",
  description:
    "Host private, synchronized listening sessions for unreleased music. Everyone hears it at the same time, chats live, and files disappear after 48 hours. No accounts needed for guests. Just $10.",
  openGraph: {
    title: "sideroom — Private listening sessions for unreleased music",
    description:
      "Host private, synchronized listening sessions for unreleased music. Everyone hears it at the same time, chats live, and files disappear after 48 hours.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
  keywords: [
    "listening party",
    "unreleased music",
    "private listening session",
    "music release",
    "independent artist",
    "pre-release",
    "synchronized playback",
  ],
  verification: {
    google: "yOqFvMPqZe8bZM6V4NyAy-x0GrVCXgMkXMwGW87Ejzk",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelCircle.variable} antialiased`}
      >
        {children}
        <Toaster
          theme="dark"
          position="top-center"
          toastOptions={{
            style: {
              background: "var(--surface)",
              borderRadius: "9999px",
              border: "1px solid var(--surface-border)",
              color: "var(--text-primary)",
              fontSize: "14px",
              fontWeight: "700",
              fontFamily: "var(--font-geist-pixel-circle)",
            },
          }}
        />
      </body>
    </html>
  );
}
