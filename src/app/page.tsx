import Link from "next/link";

export default function Home() {
  return (
    <div style={{ background: "#ffffff", minHeight: "100vh", color: "#0f172a" }}>

      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: "1px solid #e2e8f0",
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "0 24px",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" fill="white" fillOpacity="0.95"/>
                <polyline points="9 22 9 12 15 12 15 22" fill="white" fillOpacity="0.5"/>
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.4px", color: "#0f172a" }}>Rently</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/sign-in">
              <button
                style={{
                  padding: "8px 16px",
                  borderRadius: 9,
                  border: "1px solid #e2e8f0",
                  background: "transparent",
                  color: "#374151",
                  fontSize: 13.5,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Sign in
              </button>
            </Link>
            <Link href="/sign-up">
              <button
                style={{
                  padding: "8px 18px",
                  borderRadius: 9,
                  border: "none",
                  background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                  color: "#fff",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "-0.1px",
                }}
              >
                Get started free
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          paddingTop: 100,
          paddingBottom: 120,
          paddingLeft: 24,
          paddingRight: 24,
          background: "linear-gradient(180deg, #faf5ff 0%, #ffffff 100%)",
        }}
      >
        {/* Subtle grid background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(circle, #e2e8f0 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            opacity: 0.4,
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            maxWidth: 760,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: 100,
              border: "1px solid rgba(124,58,237,0.2)",
              background: "rgba(124,58,237,0.06)",
              color: "#7c3aed",
              fontSize: 12.5,
              fontWeight: 500,
              marginBottom: 32,
              letterSpacing: "0.01em",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#7c3aed",
                display: "inline-block",
              }}
            />
            Built for independent landlords · 1 to 20 units
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: "clamp(44px, 7vw, 68px)",
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-2.5px",
              marginBottom: 24,
              color: "#0f172a",
            }}
          >
            The rental platform{" "}
            <br />
            <span
              style={{
                background: "linear-gradient(90deg, #7c3aed 0%, #a855f7 60%, #ec4899 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              you actually deserve.
            </span>
          </h1>

          <p
            style={{
              fontSize: 17,
              lineHeight: 1.65,
              color: "#64748b",
              maxWidth: 520,
              marginBottom: 40,
            }}
          >
            AI-written listings that auto-post to Facebook Marketplace every day.
            Maintenance tracking. Tax-ready expenses. Everything the $200/month
            tools offer — at a price that makes sense for 4 units.
          </p>

          {/* CTA */}
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 72 }}>
            <Link href="/sign-up">
              <button
                style={{
                  padding: "13px 28px",
                  borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  letterSpacing: "-0.2px",
                  boxShadow: "0 4px 24px rgba(124,58,237,0.35)",
                }}
              >
                Get started free →
              </button>
            </Link>
            <Link href="/sign-in">
              <button
                style={{
                  padding: "13px 24px",
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  color: "#374151",
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Sign in
              </button>
            </Link>
          </div>

          {/* Dashboard Mockup */}
          <div
            style={{
              width: "100%",
              maxWidth: 760,
              borderRadius: 20,
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              overflow: "hidden",
              boxShadow: "0 24px 80px rgba(0,0,0,0.08), 0 4px 20px rgba(0,0,0,0.04)",
            }}
          >
            {/* Mock top bar */}
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#fafafa",
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fca5a5" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fcd34d" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#86efac" }} />
              <div style={{ flex: 1, height: 22, borderRadius: 6, background: "#f1f5f9", margin: "0 12px" }} />
            </div>

            {/* Mock dashboard body */}
            <div style={{ display: "flex" }}>
              {/* Mock sidebar */}
              <div
                style={{
                  width: 160,
                  borderRight: "1px solid #f1f5f9",
                  padding: "16px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  background: "#ffffff",
                }}
              >
                {["Dashboard", "My Units", "Maintenance", "Expenses"].map((label, i) => (
                  <div
                    key={label}
                    style={{
                      padding: "7px 10px",
                      borderRadius: 7,
                      background: i === 0 ? "rgba(124,58,237,0.08)" : "transparent",
                      color: i === 0 ? "#7c3aed" : "#94a3b8",
                      fontSize: 11,
                      fontWeight: i === 0 ? 600 : 400,
                    }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Mock content */}
              <div style={{ flex: 1, padding: "16px 20px", background: "#f8fafc" }}>
                {/* Mock stat row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
                  {[
                    { label: "Total Units", value: "4", color: "#7c3aed" },
                    { label: "Active Posts", value: "4", color: "#059669" },
                    { label: "Open Issues", value: "2", color: "#d97706" },
                    { label: "Monthly Rent", value: "$8.2k", color: "#dc2626" },
                  ].map((s) => (
                    <div
                      key={s.label}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ fontSize: 9, color: "#94a3b8", marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: s.color, letterSpacing: "-1px" }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Mock unit cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { title: "123 King St, Unit 4", rent: "$2,400", status: "Live" },
                    { title: "88 Bloor St W, #12", rent: "$1,950", status: "Live" },
                  ].map((u) => (
                    <div
                      key={u.title}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#374151" }}>{u.title}</div>
                        <div
                          style={{
                            fontSize: 8,
                            padding: "2px 6px",
                            borderRadius: 100,
                            background: "#dcfce7",
                            color: "#059669",
                            fontWeight: 600,
                          }}
                        >
                          {u.status}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#7c3aed", letterSpacing: "-0.5px" }}>
                        {u.rent}<span style={{ fontSize: 9, fontWeight: 400, color: "#94a3b8" }}>/mo</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain point section */}
      <section style={{ padding: "100px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 60 }}>
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7c3aed", marginBottom: 16 }}>
            The problem
          </p>
          <h2 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, letterSpacing: "-1.5px", color: "#0f172a", marginBottom: 16 }}>
            The awkward middle
          </h2>
          <p style={{ color: "#64748b", fontSize: 16, maxWidth: 480, margin: "0 auto" }}>
            Not big enough for enterprise software. Too serious for hobbyist tools. Independent landlords always end up here.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
          {[
            {
              icon: "💬",
              title: "WhatsApp thread chaos",
              desc: "Maintenance requests buried in 3 separate threads. You forget who asked, and when. The tenant gets frustrated. You get frustrated.",
              bg: "#fef2f2",
              border: "#fecaca",
            },
            {
              icon: "📸",
              title: "Photos buried in your camera roll",
              desc: "A photo of the broken pipe from 6 months ago. For insurance. If only you could find it between 4,000 vacation photos.",
              bg: "#fffbeb",
              border: "#fde68a",
            },
            {
              icon: "🧾",
              title: "Lost receipts at tax time",
              desc: "Three contractor bills in your email, one in a text, two you paid in cash and can't remember. Your accountant is not impressed.",
              bg: "#f5f3ff",
              border: "#ddd6fe",
            },
          ].map((p) => (
            <div
              key={p.title}
              style={{
                padding: "28px",
                borderRadius: 20,
                background: p.bg,
                border: `1px solid ${p.border}`,
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 16 }}>{p.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.3px", color: "#0f172a", marginBottom: 10 }}>{p.title}</h3>
              <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.65 }}>{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features section */}
      <section style={{ padding: "100px 24px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7c3aed", marginBottom: 16 }}>
              Features
            </p>
            <h2 style={{ fontSize: "clamp(32px, 5vw, 48px)", fontWeight: 800, letterSpacing: "-1.5px", color: "#0f172a" }}>
              Everything you need. Nothing you don't.
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {[
              {
                icon: "🤖",
                tag: "Listing Automation",
                title: "AI writes. Facebook posts. Repeat.",
                features: ["AI-generated titles & descriptions", "Auto-post to Marketplace", "Repost every 24h — stays at the top", "Slideshow video for rental groups"],
              },
              {
                icon: "🔧",
                tag: "Maintenance",
                title: "Every request. Every update. One place.",
                features: ["Track status from open to resolved", "Priority levels & categories", "Vendor & cost per request", "Full history per unit"],
              },
              {
                icon: "📊",
                tag: "Expenses & Tax",
                title: "Tax time with zero panic.",
                features: ["Log expenses by category", "Attach receipts directly", "Filter by tax year", "Per-unit or portfolio view"],
              },
            ].map((f) => (
              <div
                key={f.tag}
                style={{
                  padding: "28px",
                  borderRadius: 20,
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <div>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                    {f.tag}
                  </p>
                  <h3 style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.4px", color: "#0f172a", lineHeight: 1.35 }}>
                    {f.title}
                  </h3>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {f.features.map((feat) => (
                    <li key={feat} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "#64748b" }}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section style={{ padding: "120px 24px", textAlign: "center", background: "#ffffff" }}>
        <h2
          style={{
            fontSize: "clamp(36px, 6vw, 56px)",
            fontWeight: 800,
            letterSpacing: "-2px",
            color: "#0f172a",
            marginBottom: 20,
            lineHeight: 1.1,
          }}
        >
          Finally, tools worth{" "}
          <span
            style={{
              background: "linear-gradient(90deg, #7c3aed, #a855f7)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            paying for.
          </span>
        </h2>
        <p style={{ fontSize: 16, color: "#64748b", marginBottom: 40, maxWidth: 380, margin: "0 auto 40px" }}>
          Professional-grade tools for independent landlords. Not $200/month. Not a spreadsheet.
        </p>
        <Link href="/sign-up">
          <button
            style={{
              padding: "15px 36px",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "-0.2px",
              boxShadow: "0 8px 32px rgba(124,58,237,0.3)",
            }}
          >
            Get started free →
          </button>
        </Link>
        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 16 }}>No credit card required.</p>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #e2e8f0", padding: "32px 24px", textAlign: "center", background: "#f8fafc" }}>
        <p style={{ fontSize: 13, color: "#94a3b8" }}>© 2026 Rently · Built for independent landlords</p>
      </footer>
    </div>
  );
}
