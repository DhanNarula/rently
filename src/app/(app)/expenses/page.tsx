"use client";

import { useEffect, useState } from "react";

interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  receiptUrl: string | null;
  notes: string | null;
  taxYear: number;
  unit: { address: string; city: string } | null;
}

interface Unit { id: string; address: string; city: string; }

const CATEGORIES = ["repairs", "maintenance", "insurance", "property_tax", "utilities", "management", "advertising", "professional_fees", "supplies", "other"];

const CAT_COLORS: Record<string, string> = {
  repairs: "#dc2626", maintenance: "#ea580c", insurance: "#d97706",
  property_tax: "#7c3aed", utilities: "#2563eb", management: "#059669",
  advertising: "#db2777", professional_fees: "#4f46e5", supplies: "#64748b", other: "#94a3b8",
};

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, ...style }}>{children}</div>;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterCat, setFilterCat] = useState("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  const [form, setForm] = useState({ title: "", amount: "", category: "repairs", date: new Date().toISOString().split("T")[0], unitId: "", notes: "", receiptUrl: "" });

  useEffect(() => {
    Promise.all([fetch("/api/expenses").then((r) => r.json()), fetch("/api/units").then((r) => r.json())])
      .then(([eData, uData]) => { setExpenses(Array.isArray(eData) ? eData : []); setUnits(Array.isArray(uData) ? uData : []); setLoading(false); });
  }, []);

  function setF(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleSubmit() {
    if (!form.title || !form.amount) { setError("Title and amount are required."); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount: parseFloat(form.amount), taxYear: new Date(form.date).getFullYear(), unitId: form.unitId || null, receiptUrl: form.receiptUrl || null }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setExpenses((prev) => [data, ...prev]);
      setShowForm(false);
      setForm({ title: "", amount: "", category: "repairs", date: new Date().toISOString().split("T")[0], unitId: "", notes: "", receiptUrl: "" });
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  async function deleteExpense(id: string) {
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  const filtered = expenses.filter((e) => {
    if (e.taxYear !== filterYear) return false;
    if (filterCat !== "all" && e.category !== filterCat) return false;
    return true;
  });

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);
  const byCategory = filtered.reduce<Record<string, number>>((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {});
  const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ padding: "36px 40px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.8px", color: "#0f172a", marginBottom: 4 }}>Expenses</h1>
          <p style={{ fontSize: 14, color: "#64748b" }}>Track repairs, receipts, and tax-year deductions</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(124,58,237,0.3)", background: showForm ? "rgba(124,58,237,0.1)" : "rgba(124,58,237,0.06)", color: "#7c3aed", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {showForm ? "Cancel" : "+ Add Expense"}
        </button>
      </div>

      {/* Year filter + total */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {years.map((y) => (
            <button key={y} onClick={() => setFilterYear(y)} style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${filterYear === y ? "rgba(124,58,237,0.3)" : "#e2e8f0"}`, background: filterYear === y ? "rgba(124,58,237,0.08)" : "#ffffff", color: filterYear === y ? "#7c3aed" : "#64748b", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {y}
            </button>
          ))}
        </div>
        {totalFiltered > 0 && (
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>Total {filterYear}</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: "#7c3aed", letterSpacing: "-1px" }}>
              ${totalFiltered.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        )}
      </div>

      {/* Category breakdown */}
      {sortedCats.length > 0 && (
        <Card style={{ padding: "20px 24px", marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>By Category</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sortedCats.map(([cat, amt]) => {
              const pct = totalFiltered > 0 ? (amt / totalFiltered) * 100 : 0;
              const color = CAT_COLORS[cat] || "#94a3b8";
              return (
                <div key={cat}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "#64748b", textTransform: "capitalize" }}>{cat.replace("_", " ")}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color }}>${amt.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: "#f1f5f9", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: color, transition: "width 0.4s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Form */}
      {showForm && (
        <Card style={{ padding: "24px", marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 20, letterSpacing: "-0.3px" }}>Add Expense</h3>
          {error && <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div><label style={labelStyle}>Title *</label><input value={form.title} onChange={(e) => setF("title", e.target.value)} placeholder="e.g. Plumber - bathroom leak" style={inputStyle} /></div>
            <div><label style={labelStyle}>Amount ($) *</label><input value={form.amount} onChange={(e) => setF("amount", e.target.value)} type="number" placeholder="0.00" style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={(e) => setF("category", e.target.value)} style={selectStyle}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Date</label><input value={form.date} onChange={(e) => setF("date", e.target.value)} type="date" style={inputStyle} /></div>
            <div>
              <label style={labelStyle}>Unit (optional)</label>
              <select value={form.unitId} onChange={(e) => setF("unitId", e.target.value)} style={selectStyle}>
                <option value="">Portfolio-wide</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.address}, {u.city}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>Receipt URL</label><input value={form.receiptUrl} onChange={(e) => setF("receiptUrl", e.target.value)} placeholder="https://..." style={inputStyle} /></div>
            <div style={{ gridColumn: "1/-1" }}><label style={labelStyle}>Notes</label><textarea value={form.notes} onChange={(e) => setF("notes", e.target.value)} placeholder="Additional notes..." rows={2} style={{ ...inputStyle, resize: "vertical", height: "auto" }} /></div>
          </div>
          <button onClick={handleSubmit} disabled={saving} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 10, border: "none", background: saving ? "#a78bfa" : "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving..." : "Save Expense"}
          </button>
        </Card>
      )}

      {/* Category filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {["all", ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => setFilterCat(c)} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${filterCat === c ? "rgba(124,58,237,0.3)" : "#e2e8f0"}`, background: filterCat === c ? "rgba(124,58,237,0.08)" : "#ffffff", color: filterCat === c ? "#7c3aed" : "#64748b", fontSize: 11.5, fontWeight: 500, cursor: "pointer" }}>
            {c === "all" ? "All" : c.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((i) => <div key={i} style={{ height: 64, borderRadius: 12, background: "#f1f5f9", border: "1px solid #e2e8f0" }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card style={{ padding: "60px 40px", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>{expenses.length === 0 ? "No expenses logged yet" : "No expenses match your filters"}</h3>
          <p style={{ fontSize: 13, color: "#94a3b8" }}>{expenses.length === 0 ? "Add your first expense above." : "Try changing the year or category."}</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((exp) => {
            const color = CAT_COLORS[exp.category] || "#94a3b8";
            return (
              <Card key={exp.id} style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: "#0f172a", letterSpacing: "-0.2px" }}>{exp.title}</p>
                    <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      {exp.category.replace("_", " ")} · {new Date(exp.date).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}
                      {exp.unit && ` · ${exp.unit.address}`}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color, letterSpacing: "-0.3px" }}>
                      ${exp.amount.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    {exp.receiptUrl && <a href={exp.receiptUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#2563eb", textDecoration: "none" }}>receipt ↗</a>}
                  </div>
                  <button onClick={() => deleteExpense(exp.id)} style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: "transparent", color: "#cbd5e1", fontSize: 16, cursor: "pointer" }}>×</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, color: "#64748b", display: "block", marginBottom: 6, fontWeight: 500 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#ffffff", color: "#0f172a", fontSize: 13, outline: "none", fontFamily: "inherit" };
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: "none", cursor: "pointer" };
