import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Research Plagiarism Detection System",
  description: "AI-powered research similarity detection and plagiarism analysis system",
  icons: {
    icon: [
      { url: '/assets/bu-logo.png' },
      { url: '/assets/bu-logo.png', sizes: '32x32', type: 'image/png' },
      { url: '/assets/bu-logo.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/assets/bu-logo.png',
  },
};

import { Toaster } from "sonner";
import SpeedInsights from '@/components/SpeedInsights'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Toaster />
        {/* Speed Insights (Vercel) script will be injected on the client to capture page vitals */}
        {/* This client component will call @vercel/speed-insights.injectSpeedInsights */}
        <SpeedInsights />
        {children}
      </body>
    </html>
  );
}
