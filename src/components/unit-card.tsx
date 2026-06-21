"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

export function UnitCard({ unit, onDelete }: { unit: Unit; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const photos: string[] = JSON.parse(unit.photos);
  const marketplaceListing = unit.listings.find((l) => l.platform === "marketplace");
  const groupListings = unit.listings.filter((l) => l.platform === "group");

  async function handleDelete() {
    if (!confirm("Delete this unit and all its listings?")) return;
    setDeleting(true);
    await fetch(`/api/units/${unit.id}`, { method: "DELETE" });
    onDelete(unit.id);
  }

  function formatNext(date: string | null) {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const diffH = Math.round((d.getTime() - now.getTime()) / 3600000);
    if (diffH < 1) return "< 1 hour";
    if (diffH < 24) return `${diffH}h`;
    return `${Math.round(diffH / 24)}d`;
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex">
        {photos[0] ? (
          <img src={photos[0]} alt="unit" className="w-32 h-32 object-cover flex-shrink-0" />
        ) : (
          <div className="w-32 h-32 bg-slate-100 flex items-center justify-center flex-shrink-0 text-3xl">🏠</div>
        )}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900 text-sm leading-tight line-clamp-1">{unit.title}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {unit.address}, {unit.city}
              </p>
            </div>
            <Badge className={unit.isActive ? "bg-green-100 text-green-700 border-0" : "bg-slate-100 text-slate-500 border-0"}>
              {unit.isActive ? "Active" : "Paused"}
            </Badge>
          </div>

          <div className="flex gap-3 mt-2 text-sm text-slate-600">
            <span className="font-semibold text-blue-600">${unit.rent}/mo</span>
            <span>{unit.bedrooms}bd</span>
            <span>{unit.bathrooms}ba</span>
          </div>

          <div className="flex gap-1.5 mt-2 flex-wrap">
            {marketplaceListing && (
              <Badge variant="outline" className="text-xs">
                FB Marketplace {marketplaceListing.status === "active" && formatNext(marketplaceListing.nextPostAt) ? `· repost in ${formatNext(marketplaceListing.nextPostAt)}` : ""}
              </Badge>
            )}
            {groupListings.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {groupListings.length} group{groupListings.length !== 1 ? "s" : ""}
              </Badge>
            )}
            {unit.videoUrl && (
              <Badge variant="outline" className="text-xs text-purple-600 border-purple-200">
                Video ready
              </Badge>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            <Link href={`/units/${unit.id}`}>
              <Button size="sm" variant="outline" className="h-7 text-xs">Manage</Button>
            </Link>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50" onClick={handleDelete} disabled={deleting}>
              {deleting ? "..." : "Delete"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
