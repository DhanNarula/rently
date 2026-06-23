"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 bg-white" style={{ borderBottom: "1px solid #e2e8f0" }}>
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">

        {/* Logo + nav */}
        <div className="flex items-center gap-7">
          <Link href="/dashboard" className="flex items-center gap-2 no-underline">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
              style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>🏠</div>
            <span className="font-bold text-slate-900 text-base" style={{ letterSpacing: "-0.3px" }}>Rently</span>
          </Link>

          <nav className="flex items-center gap-0.5">
            {links.map((l) => (
              <Link key={l.href} href={l.href}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors no-underline",
                  pathname === l.href
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                )}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <Link href="/units/new">
            <button className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-[9px] text-sm font-semibold transition-colors"
              style={{ letterSpacing: "-0.1px" }}>
              <span className="text-base leading-none">+</span> Add Unit
            </button>
          </Link>
          <UserButton />
        </div>
      </div>
    </header>
  );
}
