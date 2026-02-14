// app/(app)/layout.tsx
import type { ReactNode } from "react";
import BottomNav from "@/app/components/BottomNav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-black text-white">
      <main className="flex-1 overflow-x-hidden pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
