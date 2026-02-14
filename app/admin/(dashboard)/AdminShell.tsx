import React, { Suspense } from "react";

export default function AdminShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-black text-white">
      <div className="mx-auto flex w-full max-w-[1400px] gap-6 px-6 py-6">
        <aside className="sticky top-6 self-start h-[calc(100dvh-3rem)] w-[260px] shrink-0">
          <Suspense fallback={<div className="h-full rounded-3xl border border-white/10 bg-white/5" />}>
            {sidebar}
          </Suspense>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <Suspense fallback={<div className="h-20 rounded-2xl border border-white/10 bg-black/20" />}>
              {children}
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
