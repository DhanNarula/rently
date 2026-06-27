"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";

interface Listing {
  id: string; platform: string; status: string;
  lastPostedAt: string | null; nextPostAt: string | null;
  groupId: string | null; groupName: string | null;
}

interface Unit {
  id: string; title: string; address: string; city: string; province: string;
  postalCode: string; rent: number; bedrooms: number; bathrooms: number;
  sqft: number | null; description: string; photos: string;
  videoUrl: string | null; isActive: boolean; listings: Listing[];
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, ...style }}>{children}</div>;
}

function fmt(d: string | null) {
  if (!d) return "—";
  const diff = new Date(d).getTime() - Date.now();
  if (diff > 0) { const h = Math.round(diff / 3600000); return h < 1 ? `in ${Math.round(diff / 60000)}m` : `in ${h}h`; }
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const inp: React.CSSProperties = { width: "100%", padding: "10px 13px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#ffffff", color: "#0f172a", fontSize: 13.5, outline: "none", fontFamily: "inherit" };
const btnGhost: React.CSSProperties = { padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#ffffff", color: "#374151", fontSize: 12, fontWeight: 500, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { padding: "6px 12px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" };

export default function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [success, setSuccess] = useState("");
  const [confirmed, setConfirmed] = useState<{ marketplace: boolean; groups: number } | null>(null);
  const [fbConnected, setFbConnected] = useState<boolean | null>(null);
  const [postOptions, setPostOptions] = useState({ marketplace: true, groups: true });
  const [editingDesc, setEditingDesc] = useState(false);
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/units/${id}`).then((r) => r.json()).then((data) => {
      setUnit(data); setDescription(data.description || ""); setTitle(data.title || ""); setLoading(false);
    });
    fetch("/api/fb-account").then((r) => r.json()).then((data) => setFbConnected(!!(data && data.email)));
  }, [id]);

  async function saveDescription() {
    const res = await fetch(`/api/units/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description }) });
    const data = await res.json(); setUnit(data); setEditingDesc(false); flash("Changes saved.");
  }

  async function regenerateAI() {
    if (!unit) return; setAiLoading(true);
    const res = await fetch("/api/generate-description", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: unit.address, city: unit.city, province: unit.province, rent: unit.rent, bedrooms: unit.bedrooms, bathrooms: unit.bathrooms, sqft: unit.sqft }) });
    const data = await res.json();
    if (data.title) setTitle(data.title);
    if (data.description) setDescription(data.description);
    setAiLoading(false);
  }

  async function generateVideo() {
    setVideoLoading(true); setError("");
    const res = await fetch("/api/generate-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unitId: id }) });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Video generation failed");
    else { setUnit((u) => u ? { ...u, videoUrl: data.videoUrl } : u); flash("Video created!"); }
    setVideoLoading(false);
  }

  async function postToFacebook() {
    setPosting(true); setError(""); setSuccess(""); setSessionExpired(false); setConfirmed(null);
    try {
      const res = await fetch("/api/facebook", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unitId: id, postToMarketplace: postOptions.marketplace, postToGroups: postOptions.groups }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Posting failed");

      const failures: string[] = [];
      let expired = false;
      let marketplaceOk = false;
      let groupsOk = 0;

      if (data.marketplace) {
        if (data.marketplace.success) marketplaceOk = true;
        else if (data.marketplace.error === "SESSION_EXPIRED") expired = true;
        else failures.push(`Marketplace failed: ${data.marketplace.error}`);
      }
      if (data.groups) {
        const ok = (data.groups as { success: boolean; error?: string }[]).filter((g) => g.success).length;
        const fail = (data.groups as { success: boolean; error?: string }[]).filter((g) => !g.success);
        groupsOk = ok;
        if (fail.some((g) => g.error === "SESSION_EXPIRED")) expired = true;
        else if (fail.length > 0) failures.push(`${fail.length} group(s) failed: ${fail[0]?.error}`);
      }

      if (expired) setSessionExpired(true);
      else if (failures.length > 0) setError(failures.join("\n"));

      if (marketplaceOk || groupsOk > 0) {
        setConfirmed({ marketplace: marketplaceOk, groups: groupsOk });
      }

      const refreshed = await fetch(`/api/units/${id}`).then((r) => r.json()); setUnit(refreshed);
    } catch (e) { setError(e instanceof Error ? e.message : "Posting failed"); }
    finally { setPosting(false); }
  }

  async function toggleActive() {
    const res = await fetch(`/api/units/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !unit?.isActive }) });
    setUnit(await res.json());
  }

  function flash(msg: string) { setSuccess(msg); setTimeout(() => setSuccess(""), 5000); }

  if (loading) return <div style={{ padding: "36px 40px", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}><p style={{ color: "#94a3b8", fontSize: 14 }}>Loading...</p></div>;
  if (!unit) return <div style={{ padding: "36px 40px" }}><p style={{ color: "#dc2626" }}>Unit not found.</p><Link href="/dashboard" style={{ color: "#7c3aed", fontSize: 13 }}>← Dashboard</Link></div>;

  const photos: string[] = JSON.parse(unit.photos);
  const marketplaceListing = unit.listings.find((l) => l.platform === "marketplace");
  const groupListings = unit.listings.filter((l) => l.platform === "group");

  return (
    <div style={{ padding: "36px 40px", maxWidth: 780, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8", marginBottom: 24 }}>
        <Link href="/dashboard" style={{ color: "#64748b", textDecoration: "none" }}>Dashboard</Link>
        <span>/</span>
        <span style={{ color: "#374151" }}>{unit.title}</span>
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.6px" }}>{unit.title}</h1>
            <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 100, letterSpacing: "0.05em", background: unit.isActive ? "#dcfce7" : "#f1f5f9", color: unit.isActive ? "#059669" : "#94a3b8" }}>
              {unit.isActive ? "LIVE" : "PAUSED"}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#64748b" }}>{unit.address} · {unit.city}, {unit.province} · ${unit.rent.toLocaleString()}/mo · {unit.bedrooms} bed · {unit.bathrooms} bath</p>
        </div>
        <button onClick={toggleActive} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#ffffff", color: "#374151", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
          {unit.isActive ? "Pause" : "Resume"}
        </button>
      </div>

      {error && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, marginBottom: 20 }}>{error}</div>}
      {sessionExpired && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderRadius: 12, background: "linear-gradient(135deg,#fffbeb,#fef3c7)", border: "1px solid #fde68a", marginBottom: 20, gap: 16 }}>
          <div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: "#92400e", marginBottom: 2 }}>Facebook session expired</p>
            <p style={{ fontSize: 12.5, color: "#a16207" }}>Go to Settings and click "Reconnect" to refresh your login.</p>
          </div>
          <Link href="/settings" style={{ textDecoration: "none", flexShrink: 0 }}>
            <button style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: "#d97706", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Reconnect →</button>
          </Link>
        </div>
      )}
      {success && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#059669", fontSize: 13, marginBottom: 20 }}>{success}</div>}

      {confirmed && (
        <div style={{ padding: "20px 24px", borderRadius: 16, background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1px solid #86efac", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>✓</div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#15803d", letterSpacing: "-0.3px", marginBottom: 4 }}>
              {confirmed.marketplace ? "Your listing is live on Facebook Marketplace!" : `Posted to ${confirmed.groups} rental group${confirmed.groups > 1 ? "s" : ""}!`}
            </p>
            <p style={{ fontSize: 13, color: "#16a34a", lineHeight: 1.5 }}>
              {confirmed.marketplace && confirmed.groups > 0
                ? `Confirmed on Marketplace and ${confirmed.groups} rental group${confirmed.groups > 1 ? "s" : ""}. Auto-reposting every 24h.`
                : confirmed.marketplace
                ? "Confirmed on Marketplace. Rently will auto-repost every 24h to keep it at the top of results."
                : `Confirmed in ${confirmed.groups} group${confirmed.groups > 1 ? "s" : ""}. Auto-reposting every 24h.`}
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Photos */}
        {photos.length > 0 && (
          <Card style={{ padding: "20px" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>{photos.length} Photos</p>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {photos.map((url, i) => (
                <div key={url} style={{ position: "relative", flexShrink: 0 }}>
                  <img src={url} alt="" style={{ height: 80, width: 112, objectFit: "cover", borderRadius: 10 }} />
                  {i === 0 && <div style={{ position: "absolute", bottom: 4, left: 4, background: "#7c3aed", color: "#fff", fontSize: 8, fontWeight: 700, padding: "2px 5px", borderRadius: 4 }}>COVER</div>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Listing text */}
        <Card style={{ padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Listing Text</p>
            <div style={{ display: "flex", gap: 8 }}>
              {editingDesc && <button onClick={regenerateAI} disabled={aiLoading} style={btnGhost}>{aiLoading ? "Writing..." : "✨ Regenerate"}</button>}
              <button onClick={() => setEditingDesc(!editingDesc)} style={btnGhost}>{editingDesc ? "Cancel" : "Edit"}</button>
              {editingDesc && <button onClick={saveDescription} style={btnPrimary}>Save</button>}
            </div>
          </div>
          {editingDesc ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ ...inp, fontWeight: 700 }} placeholder="Listing title..." />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }} placeholder="Description..." />
            </div>
          ) : (
            <div>
              <p style={{ fontWeight: 700, color: "#0f172a", fontSize: 14, marginBottom: 8, letterSpacing: "-0.2px" }}>{unit.title}</p>
              <p style={{ fontSize: 13.5, color: "#64748b", lineHeight: 1.7, whiteSpace: "pre-line" }}>{unit.description}</p>
            </div>
          )}
        </Card>

        {/* Video */}
        <Card style={{ padding: "20px" }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>Slideshow Video</p>
          {unit.videoUrl ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <video src={unit.videoUrl} controls style={{ width: "100%", borderRadius: 12, maxHeight: 220 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={generateVideo} disabled={videoLoading} style={btnGhost}>{videoLoading ? "Generating..." : "Regenerate"}</button>
                <a href={unit.videoUrl} target="_blank" rel="noreferrer"><button style={btnGhost}>Download</button></a>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Create a slideshow from your photos to post in Facebook Groups.</p>
              <button onClick={generateVideo} disabled={videoLoading || photos.length === 0} style={{ padding: "11px 24px", borderRadius: 10, border: "1px solid rgba(124,58,237,0.3)", background: "rgba(124,58,237,0.06)", color: "#7c3aed", fontSize: 13, fontWeight: 600, cursor: videoLoading || photos.length === 0 ? "not-allowed" : "pointer" }}>
                {videoLoading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 14, height: 14, border: "2px solid #ddd6fe", borderTopColor: "#7c3aed", borderRadius: "50%", display: "inline-block" }} />Generating...
                  </span>
                ) : "🎬 Generate Video"}
              </button>
              {photos.length === 0 && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Upload photos first</p>}
            </div>
          )}
        </Card>

        {/* Post to Facebook */}
        {fbConnected === false ? (
          <div style={{ padding: "24px", borderRadius: 16, background: "linear-gradient(135deg,#fffbeb,#fef3c7)", border: "1px solid #fde68a", display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fef08a", border: "1px solid #fde047", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🔗</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#92400e", letterSpacing: "-0.2px", marginBottom: 4 }}>Connect Facebook to post this listing</p>
              <p style={{ fontSize: 13, color: "#a16207", lineHeight: 1.5 }}>Add your Facebook credentials in Settings and Rently will auto-post and repost this unit every day.</p>
            </div>
            <Link href="/settings" style={{ textDecoration: "none", flexShrink: 0 }}>
              <button style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: "#d97706", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                Go to Settings →
              </button>
            </Link>
          </div>
        ) : (
          <div style={{ padding: "20px", borderRadius: 16, background: "#f5f3ff", border: "1px solid #ddd6fe" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#7c3aed", marginBottom: 4, letterSpacing: "-0.2px" }}>Post to Facebook</p>
            <p style={{ fontSize: 12, color: "#a78bfa", marginBottom: 20 }}>After posting, auto-reposts every 24h to stay at the top of results.</p>
            <div style={{ display: "flex", gap: 20, marginBottom: 20 }}>
              {[{ key: "marketplace", label: "Marketplace" }, { key: "groups", label: "Rental Groups" }].map(({ key, label }) => (
                <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={postOptions[key as keyof typeof postOptions]} onChange={(e) => setPostOptions((o) => ({ ...o, [key]: e.target.checked }))} style={{ accentColor: "#7c3aed", width: 15, height: 15 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#6d28d9" }}>{label}</span>
                </label>
              ))}
            </div>
            <button onClick={postToFacebook} disabled={posting || (!postOptions.marketplace && !postOptions.groups)} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: posting ? "#a78bfa" : "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: posting || (!postOptions.marketplace && !postOptions.groups) ? "not-allowed" : "pointer", boxShadow: posting ? "none" : "0 4px 20px rgba(124,58,237,0.25)" }}>
              {posting ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} />Posting to Facebook... (~60s)
                </span>
              ) : "Post to Facebook Now"}
            </button>
          </div>
        )}

        {/* Schedule */}
        {unit.listings.length > 0 && (
          <Card style={{ overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f8fafc" }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Posting Schedule</p>
            </div>
            {[marketplaceListing, ...groupListings].filter(Boolean).map((l) => l && (
              <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #f8fafc" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: "#374151" }}>{l.platform === "marketplace" ? "FB Marketplace" : `Group ${l.groupId}`}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 100, textTransform: "uppercase", letterSpacing: "0.04em", background: l.status === "active" ? "#dcfce7" : "#f1f5f9", color: l.status === "active" ? "#059669" : "#94a3b8" }}>
                    {l.status}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Next repost {fmt(l.nextPostAt)}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
