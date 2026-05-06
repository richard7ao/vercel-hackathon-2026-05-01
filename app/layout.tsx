import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BRIDGE // Production War Room",
  description: "Multi-agent deploy security war room powered by Vercel Workflow SDK",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body>{children}</body>
    </html>
  );
}
