import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Agent Office — 3D Workspace",
  description:
    "A stylized 3D office where each AI agent works at its own desk. Built with Next.js, React Three Fiber, and drei.",
  keywords: [
    "Next.js",
    "React Three Fiber",
    "drei",
    "Three.js",
    "3D office",
    "AI agents",
  ],
  authors: [{ name: "AI Agent Office" }],
  openGraph: {
    title: "AI Agent Office — 3D Workspace",
    description:
      "A stylized 3D office where each AI agent works at its own desk.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Agent Office — 3D Workspace",
    description:
      "A stylized 3D office where each AI agent works at its own desk.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
