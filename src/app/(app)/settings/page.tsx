"use client";

import { useEffect, useState } from "react";

interface Group { id: string; name: string; }
interface FbAccount { id: string; email: string; groups: Group[]; connected: boolean; }

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, ...style }}>{children}</div>;
}

type ConnectStatus = "idle" | "importing" | "saving" | "connected" | "error";

export default function Settings() {
  const [account, setAccount] = useState<FbAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ConnectStatus>("idle");
  const [cUser, setCUser] = useState("");
  const [xs, setXs] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [savingGroups, setSavingGroups] = useState(false);
  const [flashMsg, setFlashMsg] = useState("");
  const [flashErr, setFlashErr] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupId, setNewGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");

  useEffect(() => {
    fetch("/api/fb-account")
      .then((r) => r.json())
      .then((data) => {
        if (data) { setAccount(data); setGroups(data.groups || []); setStatus("connected"); }
        setLoading(false);
      });
  }, []);

  async function saveCookies() {
    if (!cUser.trim() && !xs.trim()) { setErrorMsg("Both c_user and xs cookie values are required."); return; }
    if (!cUser.trim()) { setErrorMsg("c_user value is required."); return; }
    if (!xs.trim()) { setErrorMsg("xs value is required."); return; }
    setStatus("saving");
    setErrorMsg("");
    try {
      const res = await fetch("/api/fb-cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ c_user: cUser.trim(), xs: xs.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      const refreshed = await fetch("/api/fb-account").then((r) => r.json());
      if (refreshed) { setAccount(refreshed); setGroups(refreshed.groups || []); }
      setStatus("connected");
      setCUser(""); setXs("");
    } catch (e) {
      setStatus("importing");
      setErrorMsg(e instanceof Error ? e.message : "Failed to save cookies");
    }
  }

  async function disconnect() {
    if (!confirm("Remove your Facebook connection?")) return;
    await fetch("/api/fb-account", { method: "DELETE" });
    setAccount(null); setGroups([]); setStatus("idle");
  }

  function flash(msg: string, isErr = false) {
    if (isErr) setFlashErr(msg); else setFlashMsg(msg);
    setTimeout(() => { setFlashMsg(""); setFlashErr(""); }, 5000);
  }

  async function saveGroups() {
    setSavingGroups(true);
    try {
      const res = await fetch("/api/fb-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setAccount(data);
      flash("Groups saved.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Save failed", true);
    } finally {
      setSavingGroups(false);
    }
  }

  function addGroup() {
    if (!newGroupId.trim()) return;
    const gid = newGroupId.trim().replace(/.*facebook\.com\/groups\//i, "").replace(/\/.*/, "");
    setGroups((g) => [...g, { id: gid, name: newGroupName.trim() || gid }]);
    setNewGroupId(""); setNewGroupName("");
  }

  if (loading) return <div style={{ padding: "60px 40px", textAlign: "center", color: "#94a3b8" }}>Loading…</div>;

  return (
    <div style={{ padding: "36px 40px", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.8px", color: "#0f172a", marginBottom: 4 }}>Settings</h1>
        <p style={{ fontSize: 14, color: "#64748b" }}>Connect your Facebook account and manage rental groups</p>
      </div>

      {flashErr && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, marginBottom: 20 }}>{flashErr}</div>}
      {flashMsg && <div style={{ padding: "12px 16px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#059669", fontSize: 13, marginBottom: 20 }}>{flashMsg}</div>}

      {/* Facebook Account */}
      <Card style={{ padding: "24px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.2px" }}>Facebook Account</p>
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Connect using your existing Facebook session</p>
          </div>
          {status === "connected" && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 100, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#059669", letterSpacing: "0.05em" }}>CONNECTED</span>
          )}
        </div>

        {status === "connected" ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "#dcfce7", border: "1px solid #86efac", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>✓</div>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: "#15803d" }}>Facebook connected</p>
                <p style={{ fontSize: 12, color: "#16a34a", marginTop: 2 }}>Your session is saved. Rently posts automatically using Browserbase — no browser needs to be open.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setStatus("importing"); setErrorMsg(""); }} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid #ddd6fe", background: "#faf5ff", color: "#7c3aed", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Reconnect
              </button>
              <button onClick={disconnect} style={{ padding: "11px 20px", borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Disconnect
              </button>
            </div>
          </div>
        ) : status === "importing" || status === "idle" ? (
          <div>
            {/* How-to steps */}
            <div style={{ padding: "20px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>Copy 2 values from your Facebook session:</p>
              <ol style={{ fontSize: 13, color: "#475569", lineHeight: 2.2, paddingLeft: 20, margin: 0 }}>
                <li>Open <strong>facebook.com</strong> in Chrome (make sure you&apos;re logged in)</li>
                <li>Press <kbd style={{ background: "#e2e8f0", padding: "1px 6px", borderRadius: 4, fontFamily: "monospace", fontSize: 12 }}>F12</kbd> to open DevTools</li>
                <li>Click the <strong>Application</strong> tab → <strong>Cookies</strong> → <strong>https://www.facebook.com</strong></li>
                <li>Find the row named <code style={{ background: "#eff6ff", padding: "1px 6px", borderRadius: 4, color: "#2563eb", fontSize: 12 }}>c_user</code> — copy its <strong>Value</strong> column</li>
                <li>Find the row named <code style={{ background: "#eff6ff", padding: "1px 6px", borderRadius: 4, color: "#2563eb", fontSize: 12 }}>xs</code> — copy its <strong>Value</strong> column</li>
                <li>Paste both below</li>
              </ol>
            </div>

            {errorMsg && (
              <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 12.5, marginBottom: 14 }}>{errorMsg}</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>c_user value</label>
                <input
                  value={cUser}
                  onChange={(e) => setCUser(e.target.value)}
                  placeholder="e.g. 100012345678901"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>xs value</label>
                <input
                  value={xs}
                  onChange={(e) => setXs(e.target.value)}
                  placeholder="e.g. AbCdEf12:34..."
                  style={inputStyle}
                />
              </div>
            </div>

            <button
              onClick={saveCookies}
              disabled={!cUser.trim() || !xs.trim()}
              style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: (cUser.trim() && xs.trim()) ? "linear-gradient(135deg,#7c3aed,#6d28d9)" : "#e2e8f0", color: (cUser.trim() && xs.trim()) ? "#fff" : "#94a3b8", fontSize: 14, fontWeight: 700, cursor: (cUser.trim() && xs.trim()) ? "pointer" : "not-allowed", boxShadow: (cUser.trim() && xs.trim()) ? "0 4px 20px rgba(124,58,237,0.25)" : "none" }}
            >
              Connect Facebook →
            </button>

            {status === "idle" && (
              <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 12, textAlign: "center", lineHeight: 1.6 }}>
                These session cookies let Rently post on your behalf via a cloud browser. They are stored securely and never shared.
              </p>
            )}
          </div>
        ) : status === "saving" ? (
          <div style={{ padding: "28px 24px", borderRadius: 12, background: "#f5f3ff", border: "1px solid #ddd6fe", textAlign: "center" }}>
            <div style={{ width: 44, height: 44, border: "3px solid #ddd6fe", borderTopColor: "#7c3aed", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: "#7c3aed" }}>Saving your session…</p>
          </div>
        ) : null}
      </Card>

      {/* Rental Groups */}
      <Card style={{ padding: "24px", marginBottom: 16 }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.2px", marginBottom: 4 }}>Rental Groups</p>
          <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>Add Facebook Groups to post to. Paste the full group URL or just the group ID. You must be a member.</p>
        </div>

        {groups.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {groups.map((g) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>👥</div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{g.name}</p>
                    <p style={{ fontSize: 11, color: "#94a3b8" }}>{g.id}</p>
                  </div>
                </div>
                <button onClick={() => setGroups((gs) => gs.filter((x) => x.id !== g.id))} style={{ fontSize: 12, color: "#94a3b8", background: "transparent", border: "none", cursor: "pointer" }}>Remove</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: "16px", borderRadius: 12, background: "#f8fafc", border: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: 12 }}>
          <div><label style={labelStyle}>Group URL or ID</label><input value={newGroupId} onChange={(e) => setNewGroupId(e.target.value)} placeholder="facebook.com/groups/torontorentals or 123456789" style={inputStyle} /></div>
          <div><label style={labelStyle}>Group Nickname <span style={{ color: "#cbd5e1", fontWeight: 400 }}>(optional)</span></label><input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="e.g. Toronto Rentals" style={inputStyle} /></div>
          <button onClick={addGroup} disabled={!newGroupId.trim()} style={{ alignSelf: "flex-start", padding: "8px 16px", borderRadius: 9, border: "1px solid #e2e8f0", background: newGroupId.trim() ? "#fff" : "#f8fafc", color: newGroupId.trim() ? "#374151" : "#cbd5e1", fontSize: 12.5, fontWeight: 600, cursor: newGroupId.trim() ? "pointer" : "not-allowed" }}>
            + Add Group
          </button>
        </div>

        {groups.length > 0 && (
          <button onClick={saveGroups} disabled={savingGroups || status !== "connected"} style={{ width: "100%", marginTop: 16, padding: "11px 0", borderRadius: 10, border: "none", background: (savingGroups || status !== "connected") ? "#a78bfa" : "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: (savingGroups || status !== "connected") ? "not-allowed" : "pointer" }}>
            {savingGroups ? "Saving…" : status !== "connected" ? "Connect Facebook first" : "Save Groups"}
          </button>
        )}
      </Card>

      {/* How it works */}
      <Card style={{ padding: "24px" }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.2px", marginBottom: 16 }}>How daily reposting works</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {["Your existing Marketplace listing is deleted", "A fresh listing is created — back at the top of search results", "New posts are made to all your rental groups"].map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
              <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{step}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 16 }}>Runs automatically at midnight UTC. Trigger manual reposts from any unit page.</p>
      </Card>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, color: "#64748b", display: "block", marginBottom: 6, fontWeight: 500 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#ffffff", color: "#0f172a", fontSize: 13.5, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
