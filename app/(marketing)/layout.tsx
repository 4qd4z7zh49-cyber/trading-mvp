// app/(marketing)/layout.tsx
import type { ReactNode } from "react";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        margin: 0,
        minHeight: "100vh",
        background: "#0b0e11",
        color: "white",
      }}
    >
      {children}
    </div>
  );
}