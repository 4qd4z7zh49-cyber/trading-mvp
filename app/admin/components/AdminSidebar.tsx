"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type DepositRequestBadgeResponse = {
  ok?: boolean;
  pendingCount?: number;
};

export default function AdminSidebar() {
  const router = useRouter();
  const sp = useSearchParams();
  const tab = (sp.get("tab") || "overview").toLowerCase();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutErr, setLogoutErr] = useState("");
  const [pendingDepositCount, setPendingDepositCount] = useState(0);
  const [pendingWithdrawCount, setPendingWithdrawCount] = useState(0);
  const [pendingNotifyCount, setPendingNotifyCount] = useState(0);
  const [pendingSupportCount, setPendingSupportCount] = useState(0);

  const goTab = (t: string) => router.push(`/admin?tab=${t}`);
  const goManageAdmin = () => router.push("/admin/manage-admin");

  const onLogout = async () => {
    setLogoutLoading(true);
    setLogoutErr("");
    try {
      const r = await fetch("/api/admin/logout", {
        method: "POST",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(j?.error || "Logout failed");
      }
      router.replace("/admin/login");
      router.refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Logout failed";
      setLogoutErr(message);
    } finally {
      setLogoutLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const [depRes, wdRes, notifyRes, supportRes] = await Promise.all([
          fetch("/api/admin/deposit-requests?status=PENDING&limit=1", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/admin/withdraw-requests?status=PENDING&limit=1", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/admin/notify?status=PENDING&limit=1", {
            cache: "no-store",
            credentials: "include",
          }),
          fetch("/api/admin/support?mode=badge", {
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        const depJson = (await depRes.json().catch(() => ({}))) as DepositRequestBadgeResponse;
        const wdJson = (await wdRes.json().catch(() => ({}))) as DepositRequestBadgeResponse;
        const notifyJson = (await notifyRes.json().catch(() => ({}))) as DepositRequestBadgeResponse;
        const supportJson = (await supportRes.json().catch(() => ({}))) as DepositRequestBadgeResponse;

        if (!cancelled) {
          if (depRes.ok && depJson?.ok) setPendingDepositCount(Number(depJson.pendingCount ?? 0));
          if (wdRes.ok && wdJson?.ok) setPendingWithdrawCount(Number(wdJson.pendingCount ?? 0));
          if (notifyRes.ok && notifyJson?.ok) setPendingNotifyCount(Number(notifyJson.pendingCount ?? 0));
          if (supportRes.ok && supportJson?.ok) setPendingSupportCount(Number(supportJson.pendingCount ?? 0));
        }
      } catch {
        // ignore badge polling errors
      }
    };

    void run();
    const t = window.setInterval(() => {
      void run();
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const item = (label: string, active: boolean, onClick: () => void, badgeCount?: number) => (
    <button
      onClick={onClick}
      className={`w-full rounded-xl px-4 py-3 text-left ${
        active ? "bg-white/10" : "bg-white/5 hover:bg-white/10"
      }`}
    >
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {typeof badgeCount === "number" && badgeCount > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-xs font-semibold text-white">
            {badgeCount}
          </span>
        ) : null}
      </span>
    </button>
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="text-xl font-semibold">Admin</div>

      {item("Overview", tab === "overview", () => goTab("overview"))}
      {item("Users", tab === "users", () => goTab("users"))}
      {item("Topups", tab === "topups", () => goTab("topups"), pendingDepositCount)}
      {item("Mining Pending", tab === "mining", () => goTab("mining"))}
      {item("Orders", tab === "orders", () => goTab("orders"))}
      {item("Withdraw", tab === "withdraw", () => goTab("withdraw"), pendingWithdrawCount)}
      {item("Notify", tab === "notify", () => goTab("notify"), pendingNotifyCount)}
      {item("Support", tab === "support", () => goTab("support"), pendingSupportCount)}

      <div className="mt-2 border-t border-white/10 pt-3">
        {item("Manage Admin", false, goManageAdmin)}
      </div>

      <div className="mt-auto border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={logoutLoading}
          className="w-full rounded-xl border border-rose-400/30 bg-rose-600/90 px-4 py-3 text-left font-semibold text-white disabled:opacity-60"
        >
          {logoutLoading ? "Logging out..." : "Log out"}
        </button>
        {logoutErr ? <div className="mt-2 text-xs text-red-300">{logoutErr}</div> : null}
      </div>
    </div>
  );
}
