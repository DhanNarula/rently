"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";

interface Listing {
  id: string;
  platform: string;
  status: string;
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
  listings: Listing[];
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, ...style }}>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useUser();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [fbConnected, setFbConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/units")
      .then((r) => r.json())
      .then((data) => { setUnits(Array.isArray(data) ? data : []); setLoading(false); });
    fetch("/api/fb-account")
      .then((r) => r.json())
      .then((data) => setFbConnected(!!(data && data.email)));
  }, []);

  const activeListings = units.flatMap((u) => u.listings.filter((l) => l.status === "active"));
  const totalRent = units.filter((u) => u.isActive).reduce((s, u) => s + u.rent, 0);
  const nextRepostMs = units
    .flatMap((u) => u.listings)
    .filter((l) => l.nextPostAt)
    .map((l) => new Date(l.nextPostAt!).getTime() - Date.now())
    .filter((ms) => ms > 0)
    .sort((a, b) => a - b)[0];
  const nextRepostLabel = nextRepostMs
    ? nextRepostMs < 3600000 ? `${Math.round(nextRepostMs / 60000)}m` : `${Math.round(nextRepostMs / 3600000)}h`
    : "—";

  const firstName = user?.firstName || user?.username || "there";

  const stats = [
    { label: "Total Units", value: String(units.length), color: "#7c3aed", sub: "properties" },
    { label: "Active Posts", value: String(activeListings.length), color: "#059669", sub: "live on Facebook" },
    { label: "Next Repost", value: nextRepostLabel, color: "#d97706", sub: "until refresh" },
    { label: "Monthly Rent", value: totalRent ? `$${(totalRent / 1000).toFixed(1)}k` : "—", color: "#dc2626", sub: "active units" },
  ];

  return (
    <div style={{ padding: "36px 40px", maxWidth: 1000, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.8px", color: "#0f172a", marginBottom: 4 }}>
          Good morning, {firstName} 👋
        </h1>
        <p style={{ fontSize: 14, color: "#64748b" }}>
          {units.length === 0
            ? "Add your first unit to get started."
            : `${units.length} unit${units.length !== 1 ? "s" : ""} · ${activeListings.length} active on Facebook`}
        </p>
      </div>

      {/* FB account onboarding banner */}
      {fbConnected === false && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderRadius: 14, marginBottom: 24,
          background: "linear-gradient(135deg, #fffbeb, #fef3c7)",
          border: "1px solid #fde68a",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "#fef08a", border: "1px solid #fde047", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
              🔗
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#92400e", letterSpacing: "-0.2px" }}>
                Connect your Facebook account to start posting
              </p>
              <p style={{ fontSize: 12, color: "#a16207", marginTop: 2 }}>
                Rently needs your Facebook login to auto-post and repost your listings daily.
              </p>
            </div>
          </div>
          <Link href="/settings" style={{ textDecoration: "none", flexShrink: 0, marginLeft: 20 }}>
            <button style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#d97706", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              Connect Account →
            </button>
          </Link>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 36 }}>
        {stats.map((s) => (
          <Card key={s.label} style={{ padding: "20px 22px" }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              {s.label}
            </p>
            <p style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-1.5px", color: s.color, lineHeight: 1, marginBottom: 4 }}>
              {s.value}
            </p>
            <p style={{ fontSize: 11, color: "#cbd5e1" }}>{s.sub}</p>
          </Card>
        ))}
      </div>

      {/* Units header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.3px" }}>My Units</h2>
        <Link href="/units/new" style={{ textDecoration: "none" }}>
          <button
            style={{
              padding: "9px 18px",
              borderRadius: 10,
              border: "1px solid rgba(124,58,237,0.3)",
              background: "rgba(124,58,237,0.06)",
              color: "#7c3aed",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add Unit
          </button>
        </Link>
      </div>

      {/* Units grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[1, 2].map((i) => (
            <div key={i} style={{ height: 120, borderRadius: 16, background: "#f1f5f9", border: "1px solid #e2e8f0" }} />
          ))}
        </div>
      ) : units.length === 0 ? (
        <Card style={{ padding: "64px 40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 20 }}>
            🏠
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8, letterSpacing: "-0.4px" }}>
            Add your first rental unit
          </h3>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 28, maxWidth: 340, lineHeight: 1.6 }}>
            Upload photos, let AI write the listing, and we'll auto-post to Facebook Marketplace every day.
          </p>
          <Link href="/units/new" style={{ textDecoration: "none" }}>
            <button style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 20px rgba(124,58,237,0.25)" }}>
              Add Your First Unit →
            </button>
          </Link>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {units.map((unit) => {
            const photos: string[] = JSON.parse(unit.photos);
            const hasActiveListing = unit.listings.some((l) => l.status === "active");
            const nextPost = unit.listings
              .filter((l) => l.nextPostAt)
              .map((l) => new Date(l.nextPostAt!).getTime() - Date.now())
              .filter((ms) => ms > 0)
              .sort((a, b) => a - b)[0];

            return (
              <Link key={unit.id} href={`/units/${unit.id}`} style={{ textDecoration: "none" }}>
                <Card style={{ padding: 0, overflow: "hidden", cursor: "pointer", display: "flex", transition: "box-shadow 0.15s" }}>
                  {/* Photo */}
                  <div style={{ width: 100, minHeight: 110, background: photos[0] ? "transparent" : "linear-gradient(135deg, #f5f3ff, #ede9fe)", flexShrink: 0, position: "relative", overflow: "hidden" }}>
                    {photos[0] ? (
                      <img src={photos[0]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🏠</div>
                    )}
                    <div style={{ position: "absolute", top: 8, left: 8 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 100, letterSpacing: "0.04em",
                        background: unit.isActive ? "#dcfce7" : "#f1f5f9",
                        color: unit.isActive ? "#059669" : "#94a3b8",
                      }}>
                        {unit.isActive ? "LIVE" : "PAUSED"}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, padding: "14px 16px" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.2px", marginBottom: 2, lineHeight: 1.3 }}>
                      {unit.title}
                    </p>
                    <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 10 }}>
                      {unit.address} · {unit.city}
                    </p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: "#7c3aed", letterSpacing: "-0.8px", marginBottom: 10 }}>
                      ${unit.rent.toLocaleString()}
                      <span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}>/mo</span>
                    </p>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, border: "1px solid #e2e8f0", color: "#64748b" }}>
                        {unit.bedrooms} bed · {unit.bathrooms} bath
                      </span>
                      {hasActiveListing && (
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#059669" }}>
                          On Facebook{nextPost && ` · ${nextPost < 3600000 ? `${Math.round(nextPost / 60000)}m` : `${Math.round(nextPost / 3600000)}h`}`}
                        </span>
                      )}
                      {unit.listings.length === 0 && (
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "#fffbeb", border: "1px solid #fde68a", color: "#d97706" }}>
                          Not posted yet
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
