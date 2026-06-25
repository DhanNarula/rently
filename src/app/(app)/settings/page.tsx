"use client";

import { useEffect, useRef, useState } from "react";

interface Group { id: string; name: string; }
interface FbAccount { id: string; email: string; groups: Group[]; connected: boolean; }

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 16, ...style }}>{children}</div>;
}

type ConnectStatus = "idle" | "creating" | "waiting" | "connected" | "error";

export default function Settings() {
  const [account, setAccount] = useState<FbAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ConnectStatus>("idle");
  const [liveViewUrl, setLiveViewUrl] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [savingGroups, setSavingGroups] = useState(false);
  const [flashMsg, setFlashMsg] = useState("");
  const [flashErr, setFlashErr] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [newGroupId, setNewGroupId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/fb-account")
      .then((r) => r.json())
      .then((data) => {
        if (data) { setAccount(data); setGroups(data.groups || []); setStatus("connected"); }
        setLoading(false);
      });
    return () => stopPolling();
  }, []);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function poll(sid: string) {
    try {
      const res = await fetch(`/api/bb-status?sessionId=${sid}`);
      const data = await res.json();

      if (data.loggedIn) {
        stopPolling();
        const refreshed = await fetch("/api/fb-account").then((r) => r.json());
        if (refreshed) { setAccount(refreshed); setGroups(refreshed.groups || []); }
        setStatus("connected");
        return;
      }

      if (data.sessionEnded) {
        stopPolling();
        setStatus("error");
        setErrorMsg("The browser session expired. Click below to try again.");
      }
    } catch {
      // network blip — keep polling
    }
  }

  async function connectFacebook() {
    setStatus("creating");
    setErrorMsg("");
    stopPolling();

    try {
      const res = await fetch("/api/bb-login", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start session");

      setSessionId(data.sessionId);
      setLiveViewUrl(data.liveViewUrl);
      setStatus("waiting");

      // Open the live view automatically
      window.open(data.liveViewUrl, "_blank");

      // Poll every 3 seconds
      pollRef.current = setInterval(() => poll(data.sessionId), 3000);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Connection failed");
    }
  }

  async function disconnect() {
    if (!confirm("Remove your Facebook connection?")) return;
    await fetch("/api/fb-account", { method: "DELETE" });
    setAccount(null); setGroups([]); setStatus("idle"); stopPolling();
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
            <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Powered by Browserbase cloud browser — no local setup needed</p>
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
                <p style={{ fontSize: 13.5, fontWeight: 600, color: "#15803d" }}>Facebook connected via Browserbase</p>
                <p style={{ fontSize: 12, color: "#16a34a", marginTop: 2 }}>Your session is saved. Rently will post automatically — no browser needs to be open.</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={connectFacebook} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid #ddd6fe", background: "#faf5ff", color: "#7c3aed", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Reconnect
              </button>
              <button onClick={disconnect} style={{ padding: "11px 20px", borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                Disconnect
              </button>
            </div>
          </div>
        ) : status === "creating" ? (
          <div style={{ padding: "28px 24px", borderRadius: 12, background: "#f5f3ff", border: "1px solid #ddd6fe", textAlign: "center" }}>
            <div style={{ width: 44, height: 44, border: "3px solid #ddd6fe", borderTopColor: "#7c3aed", borderRadius: "50%", margin: "0 auto 16px", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 14, fontWeight: 700, color: "#7c3aed", marginBottom: 6 }}>Starting cloud browser…</p>
            <p style={{ fontSize: 13, color: "#a78bfa" }}>Spinning up a Browserbase session — takes a few seconds.</p>
          </div>
        ) : status === "waiting" ? (
          <div>
            <div style={{ padding: "20px", borderRadius: 12, background: "#fffbeb", border: "1px solid #fde68a", marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>Log into Facebook in the window that opened</p>
              <p style={{ fontSize: 13, color: "#b45309", lineHeight: 1.6, marginBottom: 12 }}>
                A browser window opened in a new tab — it's running on Browserbase's servers. Log into Facebook normally including any 2FA. This page updates automatically.
              </p>
              {liveViewUrl && (
                <a
                  href={liveViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-block", padding: "8px 16px", borderRadius: 9, background: "#ffffff", border: "1px solid #fbbf24", color: "#92400e", fontSize: 12.5, fontWeight: 600, textDecoration: "none" }}
                >
                  Open Facebook window again ↗
                </a>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", animation: "pulse 1.5s ease-in-out infinite" }} />
              <p style={{ fontSize: 12.5, color: "#64748b" }}>Watching for login — checking every 3 seconds…</p>
            </div>
          </div>
        ) : status === "error" ? (
          <div>
            <div style={{ padding: "16px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", marginBottom: 16, display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>✕</span>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: "#dc2626", marginBottom: 4 }}>Connection failed</p>
                <p style={{ fontSize: 12.5, color: "#b91c1c", lineHeight: 1.5 }}>{errorMsg}</p>
              </div>
            </div>
            <button onClick={connectFacebook} style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(124,58,237,0.25)" }}>
              Try Again →
            </button>
          </div>
        ) : (
          <div>
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
                <strong style={{ color: "#0f172a" }}>How it works:</strong> Clicking below spins up a secure cloud browser. A Facebook window opens in your browser — log in once, done. Rently saves your session and posts automatically from the cloud. No local browser needs to be running.
              </p>
            </div>
            <button onClick={connectFacebook} style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(124,58,237,0.25)" }}>
              Connect Facebook →
            </button>
          </div>
        )}
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
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 12, color: "#64748b", display: "block", marginBottom: 6, fontWeight: 500 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e2e8f0", background: "#ffffff", color: "#0f172a", fontSize: 13.5, outline: "none", fontFamily: "inherit" };
