import Link from "next/link";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0b0e11", color: "white" }}>
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "rgba(11,14,17,0.85)",
            backdropFilter: "blur(10px)",
            borderBottom: "1px solid #1f2937",
          }}
        >
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Link href="/home" style={{ color: "white", textDecoration: "none", fontWeight: 800 }}>
              Trading MVP
            </Link>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Link
                href="/trade"
                style={{
                  background: "#1d4ed8",
                  color: "white",
                  textDecoration: "none",
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontWeight: 700,
                }}
              >
                Trade now
              </Link>
              <Link
                href="/login"
                style={{
                  color: "#cbd5e1",
                  textDecoration: "none",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #1f2937",
                }}
              >
                Login
              </Link>
            </div>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}