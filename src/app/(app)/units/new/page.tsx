"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { AddressAutocomplete } from "@/components/address-autocomplete";

const AMENITY_OPTIONS = [
  { label: "Parking", icon: "🚗" }, { label: "In-suite Laundry", icon: "🧺" },
  { label: "Dishwasher", icon: "🍽️" }, { label: "Air Conditioning", icon: "❄️" },
  { label: "Balcony", icon: "🏙️" }, { label: "Gym", icon: "💪" },
  { label: "Elevator", icon: "🛗" }, { label: "Pet Friendly", icon: "🐾" },
  { label: "Utilities Included", icon: "💡" }, { label: "Furnished", icon: "🛋️" },
  { label: "Storage", icon: "📦" }, { label: "Rooftop", icon: "🌇" },
  { label: "Internet Included", icon: "📶" }, { label: "Heat Included", icon: "🔥" },
];

const STEPS = [
  { number: 1, title: "Property", desc: "Address & details" },
  { number: 2, title: "Photos", desc: "Upload images" },
  { number: 3, title: "Listing", desc: "AI description" },
];

function Stepper({
  label, value, onChange, min, max, step = 1, display,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  display?: (v: number) => string;
}) {
  const canDec = value > min;
  const canInc = value < max;
  const btnBase: React.CSSProperties = {
    width: 36, height: 36, border: "none", background: "transparent",
    fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", borderRadius: 8, flexShrink: 0,
    transition: "background 0.1s",
  };
  return (
    <div>
      <label style={{ fontSize: 12, color: "#64748b", display: "block", marginBottom: 6, fontWeight: 500 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", border: "1px solid #e2e8f0", borderRadius: 10, background: "#ffffff", height: 42, padding: "0 4px" }}>
        <button type="button" onClick={() => canDec && onChange(Math.round((value - step) * 10) / 10)} disabled={!canDec}
          style={{ ...btnBase, color: canDec ? "#374151" : "#d1d5db" }}>−</button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 13.5, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.2px" }}>
          {display ? display(value) : value}
        </div>
        <button type="button" onClick={() => canInc && onChange(Math.round((value + step) * 10) / 10)} disabled={!canInc}
          style={{ ...btnBase, color: canInc ? "#374151" : "#d1d5db" }}>+</button>
      </div>
    </div>
  );
}

export default function NewUnit() {
  const router = useRouter();
  const { user } = useUser();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // drag state for photo reorder
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const [form, setForm] = useState({
    address: "", city: "", province: "ON", postalCode: "",
    rent: "", bedrooms: 1, bathrooms: 1, sqft: "", availableFrom: "",
    title: "", description: "", amenities: [] as string[], photos: [] as string[],
  });

  function set(key: string, value: unknown) { setForm((f) => ({ ...f, [key]: value })); }

  function toggleAmenity(a: string) {
    set("amenities", form.amenities.includes(a) ? form.amenities.filter((x) => x !== a) : [...form.amenities, a]);
  }

  function movePhoto(from: number, to: number) {
    if (from === to) return;
    const arr = [...form.photos];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    set("photos", arr);
  }

  async function uploadPhotos(files: FileList) {
    setUploadLoading(true); setError("");
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      set("photos", [...form.photos, ...data.urls]);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
    finally { setUploadLoading(false); }
  }

  async function generateAI() {
    if (!form.address || !form.city || !form.rent) { setError("Fill in address, city, and rent first."); return; }
    setAiLoading(true); setError("");
    try {
      const res = await fetch("/api/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: form.address, city: form.city, province: form.province, rent: form.rent, bedrooms: form.bedrooms, bathrooms: form.bathrooms, sqft: form.sqft, amenities: form.amenities, availableFrom: form.availableFrom || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI generation failed");
      if (data.title) set("title", data.title);
      if (data.description) set("description", data.description);
    } catch (e) { setError(e instanceof Error ? e.message : "AI generation failed"); }
    finally { setAiLoading(false); }
  }

  async function handleSubmit() {
    if (!form.title || !form.description) { setError("Title and description required."); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, email: user?.primaryEmailAddress?.emailAddress }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save unit");
      router.push(`/units/${data.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to save"); setSaving(false); }
  }

  function goNext(nextStep: number, validate: () => boolean) {
    if (!validate()) return;
    setError(""); setStep(nextStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const s = {
    card: { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16 } as React.CSSProperties,
    input: { width: "100%", padding: "10px 13px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#ffffff", color: "#0f172a", fontSize: 13.5, outline: "none", fontFamily: "inherit" } as React.CSSProperties,
    select: { width: "100%", padding: "10px 13px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#ffffff", color: "#0f172a", fontSize: 13.5, outline: "none", fontFamily: "inherit", appearance: "none" as const },
    label: { fontSize: 12, color: "#64748b", display: "block", marginBottom: 6, fontWeight: 500 } as React.CSSProperties,
  };

  return (
    <div style={{ padding: "36px 40px", maxWidth: 680, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.8px", color: "#0f172a", marginBottom: 4 }}>Add New Unit</h1>
        <p style={{ fontSize: 14, color: "#64748b" }}>Three steps to your first auto-posted listing</p>
      </div>

      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 36, position: "relative" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: "40%", height: 1, background: "#e2e8f0", zIndex: 0 }} />
        {STEPS.map((st, i) => {
          const done = step > st.number;
          const active = step === st.number;
          return (
            <div key={st.number} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: i === 0 ? "flex-start" : i === 2 ? "flex-end" : "center", position: "relative", zIndex: 1 }}>
              <button type="button" onClick={() => st.number < step && setStep(st.number)} style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${active ? "#7c3aed" : done ? "#7c3aed" : "#e2e8f0"}`, background: active ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : done ? "#f5f3ff" : "#ffffff", color: active ? "#fff" : done ? "#7c3aed" : "#94a3b8", fontSize: 13, fontWeight: 700, cursor: done ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8, boxShadow: active ? "0 4px 16px rgba(124,58,237,0.3)" : "none" }}>
                {done ? (
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : st.number}
              </button>
              <p style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? "#7c3aed" : "#94a3b8" }}>{st.title}</p>
            </div>
          );
        })}
      </div>

      {error && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, marginBottom: 20 }}>{error}</div>}

      {/* STEP 1 */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ ...s.card, padding: "24px", display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={s.label}>Street Address</label>
              <AddressAutocomplete value={form.address} placeholder="e.g. 123 King St W, Unit 4" onChange={(result) => { set("address", result.address); if (result.city) set("city", result.city); if (result.province) set("province", result.province); if (result.postalCode) set("postalCode", result.postalCode); }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div><label style={s.label}>City</label><input style={s.input} placeholder="Toronto" value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
              <div>
                <label style={s.label}>Province</label>
                <select style={s.select} value={form.province} onChange={(e) => set("province", e.target.value)}>
                  {["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"].map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div><label style={s.label}>Postal Code</label><input style={s.input} placeholder="M5V 2T6" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} /></div>
              <div>
                <label style={s.label}>Monthly Rent</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 13 }}>$</span>
                  <input style={{ ...s.input, paddingLeft: 24 }} type="number" placeholder="2,200" value={form.rent} onChange={(e) => set("rent", e.target.value)} />
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={s.label}>Available From</label>
                <input
                  type="date"
                  style={{ ...s.input, colorScheme: "light" }}
                  value={form.availableFrom}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => set("availableFrom", e.target.value)}
                />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                {form.availableFrom ? (
                  <div style={{ padding: "10px 13px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 13, color: "#059669", fontWeight: 600, width: "100%" }}>
                    {new Date(form.availableFrom + "T00:00:00").toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}
                  </div>
                ) : (
                  <div style={{ padding: "10px 13px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0", fontSize: 13, color: "#94a3b8", width: "100%" }}>
                    Immediate / flexible
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <Stepper
                label="Bedrooms"
                value={form.bedrooms}
                onChange={(v) => set("bedrooms", v)}
                min={0} max={10}
                display={(v) => v === 0 ? "Studio" : String(v)}
              />
              <Stepper
                label="Bathrooms"
                value={form.bathrooms}
                onChange={(v) => set("bathrooms", v)}
                min={1} max={10} step={0.5}
                display={(v) => String(v)}
              />
              <div><label style={s.label}>Sqft (opt.)</label><input style={s.input} type="number" placeholder="850" value={form.sqft} onChange={(e) => set("sqft", e.target.value)} /></div>
            </div>
          </div>

          <div style={{ ...s.card, padding: "24px" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 14 }}>Amenities</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {AMENITY_OPTIONS.map(({ label, icon }) => {
                const active = form.amenities.includes(label);
                return (
                  <button key={label} type="button" onClick={() => toggleAmenity(label)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 100, border: `1px solid ${active ? "rgba(124,58,237,0.4)" : "#e2e8f0"}`, background: active ? "rgba(124,58,237,0.08)" : "#ffffff", color: active ? "#7c3aed" : "#64748b", fontSize: 12.5, fontWeight: active ? 600 : 400, cursor: "pointer" }}>
                    <span>{icon}</span>{label}
                  </button>
                );
              })}
            </div>
          </div>

          <button onClick={() => goNext(2, () => { if (!form.address || !form.city || !form.rent) { setError("Address, city, and rent are required."); return false; } return true; })} style={{ padding: "14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(124,58,237,0.25)" }}>
            Continue to Photos →
          </button>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ ...s.card, padding: "24px" }}>
            <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files && uploadPhotos(e.target.files)} />
            <button type="button" onClick={() => fileRef.current?.click()} style={{ width: "100%", border: `2px dashed ${uploadLoading ? "#a78bfa" : "#e2e8f0"}`, borderRadius: 14, padding: "48px 24px", textAlign: "center", background: uploadLoading ? "#f5f3ff" : "#fafafa", cursor: "pointer" }}>
              {uploadLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 28, height: 28, border: "3px solid #ddd6fe", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  <p style={{ fontSize: 13, color: "#7c3aed", fontWeight: 600 }}>Uploading photos...</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📷</div>
                  <div><p style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Click to upload photos</p><p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>JPG, PNG, WEBP · Up to 20 photos</p></div>
                </div>
              )}
            </button>

            {form.photos.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>
                  {form.photos.length} photo{form.photos.length !== 1 ? "s" : ""} · Drag to reorder · First photo is your cover
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                  {form.photos.map((url, i) => {
                    const isDragging = dragIdx === i;
                    const isOver = dragOverIdx === i;
                    return (
                      <div
                        key={url}
                        draggable
                        onDragStart={() => setDragIdx(i)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i); }}
                        onDrop={(e) => { e.preventDefault(); if (dragIdx !== null) movePhoto(dragIdx, i); setDragIdx(null); setDragOverIdx(null); }}
                        onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                        style={{
                          position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden",
                          cursor: "grab", opacity: isDragging ? 0.4 : 1,
                          outline: isOver ? "2px solid #7c3aed" : "none",
                          outlineOffset: 2,
                          transition: "opacity 0.15s, outline 0.1s",
                        }}
                      >
                        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", userSelect: "none" }} />
                        {i === 0 && (
                          <div style={{ position: "absolute", bottom: 5, left: 5, background: "#7c3aed", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5 }}>COVER</div>
                        )}
                        {/* drag handle hint */}
                        <div style={{ position: "absolute", top: 5, left: 5, width: 18, height: 18, borderRadius: 4, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="9" height="9" viewBox="0 0 9 9" fill="white">
                            <circle cx="2" cy="2" r="1"/><circle cx="7" cy="2" r="1"/>
                            <circle cx="2" cy="4.5" r="1"/><circle cx="7" cy="4.5" r="1"/>
                            <circle cx="2" cy="7" r="1"/><circle cx="7" cy="7" r="1"/>
                          </svg>
                        </div>
                        <button type="button" onClick={() => set("photos", form.photos.filter((_, j) => j !== i))} style={{ position: "absolute", top: 5, right: 5, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "white", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => fileRef.current?.click()} style={{ aspectRatio: "1", borderRadius: 10, border: "2px dashed #e2e8f0", background: "#fafafa", color: "#94a3b8", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setStep(1)} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#ffffff", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>← Back</button>
            <button onClick={() => goNext(3, () => { if (form.photos.length === 0) { setError("Upload at least one photo."); return false; } return true; })} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Continue to Listing →</button>
          </div>
        </div>
      )}

      {/* STEP 3 */}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ ...s.card, padding: "24px", display: "flex", flexDirection: "column", gap: 18 }}>
            <button type="button" onClick={generateAI} disabled={aiLoading} style={{ padding: "14px", borderRadius: 12, border: "2px solid rgba(124,58,237,0.25)", background: aiLoading ? "#f5f3ff" : "rgba(124,58,237,0.04)", color: aiLoading ? "#a78bfa" : "#7c3aed", fontSize: 14, fontWeight: 700, cursor: aiLoading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              {aiLoading ? (
                <><div style={{ width: 16, height: 16, border: "2px solid #ddd6fe", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />Writing your listing with AI...</>
              ) : "✨ Auto-generate with AI"}
            </button>

            {!aiLoading && !form.title && <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: -10 }}>AI writes a professional listing from your property details</p>}

            <div>
              <label style={s.label}>Listing Title</label>
              <input style={s.input} placeholder="e.g. Spacious 2BR in Downtown Toronto — Available July 1st" value={form.title} onChange={(e) => set("title", e.target.value)} />
              <p style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4 }}>{form.title.length}/80 characters</p>
            </div>

            <div>
              <label style={s.label}>Description</label>
              <textarea style={{ ...s.input, minHeight: 180, resize: "vertical", lineHeight: 1.6 }} placeholder="Describe the unit, neighbourhood, transit access..." value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
          </div>

          {form.title && (
            <div style={{ padding: "18px 20px", borderRadius: 14, background: "#f5f3ff", border: "1px solid #ddd6fe" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Preview</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 6, letterSpacing: "-0.2px" }}>{form.title}</p>
              <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{form.description}</p>
              <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                {[`$${form.rent}/mo`, form.bedrooms === 0 ? "Studio" : `${form.bedrooms} bed`, `${form.bathrooms} bath`, form.city, form.availableFrom ? `Avail. ${new Date(form.availableFrom + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" })}` : "Immediate"].filter(Boolean).map((tag) => (
                  <span key={tag} style={{ fontSize: 11, color: "#94a3b8" }}>{tag}</span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setStep(2)} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#ffffff", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>← Back</button>
            <button onClick={handleSubmit} disabled={saving} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: saving ? "#a78bfa" : "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", boxShadow: saving ? "none" : "0 4px 20px rgba(124,58,237,0.25)" }}>
              {saving ? <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} />Saving...</span> : "Save Unit →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
