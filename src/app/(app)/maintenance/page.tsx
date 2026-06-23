"use client";

import { useEffect, useState } from "react";

interface MaintenanceRequest {
  id: string;
  unitId: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  cost: number | null;
  vendor: string | null;
  createdAt: string;
  unit: { address: string; city: string };
}

interface Unit { id: string; address: string; city: string; }

const CATEGORIES = ["general", "plumbing", "electrical", "hvac", "appliance", "structural", "pest", "other"];
const PRIORITIES = ["low", "medium", "high", "urgent"];
const STATUSES = ["open", "in_progress", "resolved"];

const PRIORITY_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  low:    { bg: "#f0fdf4", border: "#bbf7d0", color: "#059669" },
  medium: { bg: "#fffbeb", border: "#fde68a", color: "#d97706" },
  high:   { bg: "#fff7ed", border: "#fed7aa", color: "#ea580c" },
  urgent: { bg: "#fef2f2", border: "#fecaca", color: "#dc2626" },
};

const STATUS_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  open:        { bg: "#fff7ed", border: "#fed7aa", color: "#ea580c" },
  in_progress: { bg: "#eff6ff", border: "#bfdbfe", color: "#2563eb" },
  resolved:    { bg: "#f0fdf4", border: "#bbf7d0", color: "#059669" },
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, ...style }}>
      {children}
    </div>
  );
}

function Badge({ text, scheme }: { text: string; scheme: { bg: string; border: string; color: string } }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 100, background: scheme.bg, border: `1px solid ${scheme.border}`, color: scheme.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {text}
    </span>
  );
}

export default function MaintenancePage() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({ unitId: "", title: "", description: "", category: "general", priority: "medium", vendor: "", cost: "" });

  useEffect(() => {
    Promise.all([fetch("/api/maintenance").then((r) => r.json()), fetch("/api/units").then((r) => r.json())])
      .then(([mData, uData]) => { setRequests(Array.isArray(mData) ? mData : []); setUnits(Array.isArray(uData) ? uData : []); setLoading(false); });
  }, []);

  function setF(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSubmit() {
    if (!form.unitId || !form.title) { setError("Unit and title are required."); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/maintenance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, cost: form.cost ? parseFloat(form.cost) : null }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setRequests((prev) => [data, ...prev]);
      setShowForm(false);
      setForm({ unitId: "", title: "", description: "", category: "general", priority: "medium", vendor: "", cost: "" });
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/maintenance/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const data = await res.json();
    setRequests((prev) => prev.map((r) => (r.id === id ? data : r)));
  }

  const filtered = requests.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterPriority !== "all" && r.priority !== filterPriority) return false;
    return true;
  });

  const openCount = requests.filter((r) => r.status === "open").length;
  const inProgressCount = requests.filter((r) => r.status === "in_progress").length;
  const urgentCount = requests.filter((r) => r.priority === "urgent" && r.status !== "resolved").length;
  const totalCost = requests.filter((r) => r.cost).reduce((s, r) => s + (r.cost || 0), 0);

  return (
    <div style={{ padding: "36px 40px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.8px", color: "#0f172a", marginBottom: 4 }}>Maintenance</h1>
          <p style={{ fontSize: 14, color: "#64748b" }}>Track repair requests across all your units</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(124,58,237,0.3)", background: showForm ? "rgba(124,58,237,0.1)" : "rgba(124,58,237,0.06)", color: "#7c3aed", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          {showForm ? "Cancel" : "+ Log Request"}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Open", value: String(openCount), color: "#ea580c" },
          { label: "In Progress", value: String(inProgressCount), color: "#2563eb" },
          { label: "Urgent", value: String(urgentCount), color: "#dc2626" },
          { label: "Total Spent", value: totalCost ? `$${totalCost.toLocaleString()}` : "—", color: "#7c3aed" },
        ].map((s) => (
          <Card key={s.label} style={{ padding: "16px 18px" }}>
            <p style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: 28, fontWeight: 800, color: s.color, letterSpacing: "-1px" }}>{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <Card style={{ padding: "24px", marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 20, letterSpacing: "-0.3px" }}>Log Maintenance Request</h3>
          {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Unit *</label>
              <select value={form.unitId} onChange={(e) => setF("unitId", e.target.value)} style={selectStyle}>
                <option value="">Select a unit...</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.address}, {u.city}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Title *</label>
              <input value={form.title} onChange={(e) => setF("title", e.target.value)} placeholder="e.g. Leaking kitchen faucet" style={inputStyle} />
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={labelStyle}>Description</label>
              <textarea value={form.description} onChange={(e) => setF("description", e.target.value)} placeholder="Details..." rows={3} style={{ ...inputStyle, resize: "vertical", height: "auto" }} />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={(e) => setF("category", e.target.value)} style={selectStyle}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select value={form.priority} onChange={(e) => setF("priority", e.target.value)} style={selectStyle}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Vendor / Contractor</label>
              <input value={form.vendor} onChange={(e) => setF("vendor", e.target.value)} placeholder="e.g. Joe's Plumbing" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Cost ($)</label>
              <input value={form.cost} onChange={(e) => setF("cost", e.target.value)} type="number" placeholder="0.00" style={inputStyle} />
            </div>
          </div>
          <button onClick={handleSubmit} disabled={saving} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 10, border: "none", background: saving ? "#a78bfa" : "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving..." : "Save Request"}
          </button>
        </Card>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {["all", ...STATUSES].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${filterStatus === s ? "rgba(124,58,237,0.3)" : "#e2e8f0"}`, background: filterStatus === s ? "rgba(124,58,237,0.08)" : "#ffffff", color: filterStatus === s ? "#7c3aed" : "#64748b", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
            {s === "all" ? "All Status" : s.replace("_", " ")}
          </button>
        ))}
        {["all", ...PRIORITIES].map((p) => (
          <button key={p} onClick={() => setFilterPriority(p)} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${filterPriority === p ? "rgba(124,58,237,0.3)" : "#e2e8f0"}`, background: filterPriority === p ? "rgba(124,58,237,0.08)" : "#ffffff", color: filterPriority === p ? "#7c3aed" : "#64748b", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
            {p === "all" ? "All Priority" : p}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((i) => <div key={i} style={{ height: 80, borderRadius: 14, background: "#f1f5f9", border: "1px solid #e2e8f0" }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card style={{ padding: "60px 40px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔧</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
            {requests.length === 0 ? "No maintenance requests yet" : "No requests match your filters"}
          </h3>
          <p style={{ fontSize: 13, color: "#94a3b8" }}>{requests.length === 0 ? "Log your first request above." : "Try adjusting the filters."}</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((req) => (
            <Card key={req.id} style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.2px" }}>{req.title}</span>
                    <Badge text={req.priority} scheme={PRIORITY_COLORS[req.priority] || PRIORITY_COLORS.medium} />
                    <Badge text={req.status.replace("_", " ")} scheme={STATUS_COLORS[req.status] || STATUS_COLORS.open} />
                  </div>
                  <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: req.description ? 6 : 0 }}>
                    {req.unit?.address}, {req.unit?.city} · {req.category} ·{" "}
                    {new Date(req.createdAt).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                    {req.vendor && ` · ${req.vendor}`}
                    {req.cost && ` · $${req.cost.toLocaleString()}`}
                  </p>
                  {req.description && <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>{req.description}</p>}
                </div>
                {req.status !== "resolved" && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {req.status === "open" && (
                      <button onClick={() => updateStatus(req.id, "in_progress")} style={actionBtn("#2563eb", "#eff6ff", "#bfdbfe")}>Start</button>
                    )}
                    <button onClick={() => updateStatus(req.id, "resolved")} style={actionBtn("#059669", "#f0fdf4", "#bbf7d0")}>Resolve</button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, color: "#64748b", display: "block", marginBottom: 6, fontWeight: 500 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#ffffff", color: "#0f172a", fontSize: 13, outline: "none", fontFamily: "inherit" };
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: "none", cursor: "pointer" };
function actionBtn(color: string, bg: string, border: string): React.CSSProperties {
  return { padding: "5px 12px", borderRadius: 8, border: `1px solid ${border}`, background: bg, color, fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
}
