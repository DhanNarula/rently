import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#09090b" }}>
      {/* Left brand panel */}
      <div
        style={{
          display: "none",
          flex: "0 0 52%",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(160deg, #0f0a1e 0%, #110d24 40%, #0d0d14 100%)",
        }}
        className="auth-left-panel"
      >
        {/* Purple glow blobs */}
        <div style={{ position: "absolute", top: -120, left: -80, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.25) 0%, transparent 65%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -60, right: -40, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(168,85,247,0.15) 0%, transparent 65%)", pointerEvents: "none" }} />

        {/* Grid overlay */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "32px 32px", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%", padding: "48px 56px" }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #7c3aed, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" fill="white" fillOpacity="0.95" />
                <polyline points="9 22 9 12 15 12 15 22" fill="white" fillOpacity="0.5" />
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 17, color: "#f8fafc", letterSpacing: "-0.4px" }}>Rently</span>
          </div>

          {/* Main copy */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 420 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a855f7", marginBottom: 20 }}>
              Built for independent landlords
            </div>
            <h1 style={{ fontSize: "clamp(32px, 3.5vw, 46px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-1.5px", color: "#f8fafc", marginBottom: 20 }}>
              Your rentals,{" "}
              <span style={{ background: "linear-gradient(90deg, #a855f7, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                on autopilot.
              </span>
            </h1>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: "#94a3b8", marginBottom: 40 }}>
              AI-written listings that post to Facebook Marketplace every day. Maintenance tracking. Tax-ready expenses.
            </p>

            {/* Feature list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                "Auto-post to Facebook Marketplace daily",
                "AI writes your listing title & description",
                "Track maintenance requests & vendors",
                "Log expenses — ready for tax season",
              ].map((feat) => (
                <div key={feat} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span style={{ fontSize: 13.5, color: "#cbd5e1" }}>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom quote */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 28 }}>
            <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
              "Finally a tool that doesn't feel like it was built for a property management company with 500 units."
            </p>
            <p style={{ fontSize: 12, color: "#475569", marginTop: 8, fontWeight: 500 }}>— Independent landlord, Toronto</p>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", position: "relative" }}>
        {/* Mobile logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }} className="auth-mobile-logo">
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #7c3aed, #a855f7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" fill="white" fillOpacity="0.95" />
              <polyline points="9 22 9 12 15 12 15 22" fill="white" fillOpacity="0.5" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#f8fafc" }}>Rently</span>
        </div>

        <SignUp
          forceRedirectUrl="/dashboard"
          appearance={{
            variables: {
              colorPrimary: "#7c3aed",
              colorBackground: "#111113",
              colorText: "#f1f5f9",
              colorTextSecondary: "#94a3b8",
              colorInputBackground: "#1c1c1f",
              colorInputText: "#f1f5f9",
              colorNeutral: "#334155",
              borderRadius: "0.75rem",
              fontFamily: "inherit",
            },
            elements: {
              rootBox: { boxShadow: "none", width: "100%" },
              card: {
                background: "#111113",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 20px 60px rgba(0,0,0,0.5)",
                borderRadius: "16px",
              },
              headerTitle: { color: "#f8fafc", fontSize: "20px", fontWeight: "700" },
              headerSubtitle: { color: "#64748b" },
              socialButtonsBlockButton: {
                background: "#1c1c1f",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#e2e8f0",
              },
              socialButtonsBlockButtonText: { color: "#e2e8f0", fontWeight: "500" },
              dividerLine: { background: "rgba(255,255,255,0.08)" },
              dividerText: { color: "#475569" },
              formFieldLabel: { color: "#94a3b8", fontWeight: "500" },
              formFieldInput: {
                background: "#1c1c1f",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#f1f5f9",
              },
              formButtonPrimary: {
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
              },
              footerActionText: { color: "#64748b" },
              footerActionLink: { color: "#a855f7", fontWeight: "600" },
              identityPreviewText: { color: "#94a3b8" },
              identityPreviewEditButton: { color: "#a855f7" },
            },
          }}
        />
      </div>

      <style>{`
        @media (min-width: 900px) {
          .auth-left-panel { display: flex !important; }
          .auth-mobile-logo { display: none !important; }
        }
      `}</style>
    </div>
  );
}
