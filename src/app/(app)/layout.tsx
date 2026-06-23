import { Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          minWidth: 0,
          background: "#f8fafc",
        }}
      >
        {children}
      </main>
    </div>
  );
}
