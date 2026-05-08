import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RouteStack AI",
  description: "Next.js AI travel assistant using RouteStack MCP",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}