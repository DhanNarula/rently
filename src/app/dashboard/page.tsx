"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UnitCard } from "@/components/unit-card";

interface Listing {
  id: string;
  platform: string;
  status: string;
  lastPostedAt: string | null;
  nextPostAt: string | null;
  groupName: string | null;
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
  createdAt: string;
}

export default function Dashboard() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/units")
      .then((r) => r.json())
      .then((data) => {
        setUnits(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  const activeListings = units.flatMap((u) => u.listings.filter((l) => l.status === "active"));

  return (
    <div className="min-h-screen bg-slate-50">
      <Nav />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">Manage your rental units and auto-posting</p>
          </div>
          <Link href="/units/new">
            <Button className="bg-blue-600 hover:bg-blue-700">+ Add New Unit</Button>
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Total Units</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{units.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Active Listings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{activeListings.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Auto-Reposting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {activeListings.filter((l) => l.nextPostAt).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading...</div>
        ) : units.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🏠</div>
            <h2 className="text-xl font-semibold text-slate-700 mb-2">No units yet</h2>
            <p className="text-slate-500 mb-6">Add your first rental unit to start auto-posting to Facebook.</p>
            <Link href="/units/new">
              <Button className="bg-blue-600 hover:bg-blue-700">Add Your First Unit</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {units.map((unit) => (
              <UnitCard key={unit.id} unit={unit} onDelete={(id) => setUnits((u) => u.filter((x) => x.id !== id))} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
