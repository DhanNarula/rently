import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rently — Rental management for independent landlords",
  description: "AI-written listings, Facebook auto-posting, maintenance tracking, and tax-ready expenses. Built for landlords with 1–20 units.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={{ theme: shadcn }}>
      <html lang="en" className={geistSans.variable} style={{ background: "#ffffff" }}>
        <body style={{ background: "#ffffff", color: "#0f172a", minHeight: "100vh" }}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
