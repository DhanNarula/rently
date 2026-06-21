import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rently — Auto-post your rental to Facebook",
  description: "The fastest way to rent your unit. Auto-post to Facebook Marketplace and Groups daily.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={{ theme: shadcn }}>
      <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
        <body className="min-h-full bg-slate-50 text-slate-900">{children}</body>
      </html>
    </ClerkProvider>
  );
}
