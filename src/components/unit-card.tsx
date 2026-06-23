"use client";

import Link from "next/link";
import { useState } from "react";

interface Listing {
  id: string;
  platform: string;
  status: string;
  lastPostedAt: string | null;
  nextPostAt: string | null;
}

interface Unit {
  id: string;
  title: string;
  address: string;
  city: string;
  province: string;
  rent: number;
  bedrooms: number;
  bathrooms: number;
  isActive: boolean;
  photos: string;
  videoUrl: string | null;
  listings: Listing[];
}

function timeUntil(date: string | null) {
  if (!date) return null;
  const ms = new Date(date).getTime() - Date.now();
  if (ms <= 0) return "soon";
  const h = Math.round(ms / 3600000);
  if (h < 1) return `${Math.round(ms / 60000)}m`;
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function UnitCard({ unit, onDelete }: { unit: Unit; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const photos: string[] = JSON.parse(unit.photos);
  const marketplaceListing = unit.listings.find((l) => l.platform === "marketplace");
  const groupListings = unit.listings.filter((l) => l.platform === "group" && l.status === "active");
  const nextRepost = timeUntil(marketplaceListing?.nextPostAt ?? null);

  async function handleDelete() {
    if (!confirm("Delete this unit and all its listings?")) return;
    setDeleting(true);
    await fetch(`/api/units/${unit.id}`, { method: "DELETE" });
    onDelete(unit.id);
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden flex transition-shadow hover:shadow-md"
      style={{ border: "1px solid #e2e8f0" }}>

      {/* Photo */}
      <div className="w-32 flex-shrink-0 relative" style={{ background: "linear-gradient(135deg,#dbeafe,#bfdbfe)" }}>
        {photos[0] ? (
          <img src={photos[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">🏠</div>
        )}
        {/* Status pill */}
        <div className="absolute top-2 left-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={unit.isActive
              ? { background: "#dcfce7", color: "#16a34a" }
              : { background: "#f1f5f9", color: "#64748b" }}>
            {unit.isActive ? "Live" : "Paused"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-slate-900 leading-tight line-clamp-1">{unit.title}</p>
        </div>
        <p className="text-xs text-slate-400 mb-3 truncate">{unit.address} · {unit.city}, {unit.province}</p>

        {/* Rent + beds */}
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-base font-bold text-blue-600">${unit.rent.toLocaleString()}<span className="text-xs font-normal text-slate-400">/mo</span></span>
          <span className="text-xs text-slate-500">{unit.bedrooms} bed · {unit.bathrooms} bath</span>
        </div>

        {/* Badges */}
        <div className="flex gap-1.5 flex-wrap mb-3">
          {marketplaceListing?.status === "active" && (
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ border: "1px solid #e2e8f0", color: "#64748b" }}>
              Marketplace{nextRepost ? ` · ${nextRepost}` : ""}
            </span>
          )}
          {groupListings.length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ border: "1px solid #e2e8f0", color: "#64748b" }}>
              {groupListings.length} group{groupListings.length !== 1 ? "s" : ""}
            </span>
          )}
          {unit.videoUrl && (
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ border: "1px solid #ddd6fe", color: "#7c3aed" }}>
              🎬 Video
            </span>
          )}
          {unit.listings.length === 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ border: "1px solid #fde68a", color: "#92400e", background: "#fffbeb" }}>
              Not posted yet
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link href={`/units/${unit.id}`}>
            <button className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
              style={{ border: "1px solid #e2e8f0", color: "#374151", background: "white" }}>
              Manage
            </button>
          </Link>
          <button onClick={handleDelete} disabled={deleting}
            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
            style={{ color: "#94a3b8", background: "transparent" }}>
            {deleting ? "..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
