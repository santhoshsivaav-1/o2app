import type { Metadata, Viewport } from "next";
import Providers from "../components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "O2 Oxygen Fitness Studio — Gym Management",
  description:
    "Member, membership, billing and attendance management for O2 Oxygen Fitness Studio.",
};

export const viewport: Viewport = {
  themeColor: "#0a0908",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
