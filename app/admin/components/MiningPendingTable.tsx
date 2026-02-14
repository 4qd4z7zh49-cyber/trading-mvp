"use client";

import { useCallback, useEffect, useState } from "react";

type MiningRow = {
  id: string;
  user_id: string;
  plan_id: string;
  amount: number;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "ABORTED" | "COMPLETED";
  created_at: string;
  activated_at?: string | null;
  note?: string | null;
  username?: string | null;
  email?: string | null;
};

type MiningResp = {
  rows?: MiningRow[];
  error?: string;
};

type MiningApproveResp = {
  ok?: boolean;
  error?: string;
};

const money = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

function statusClass(status: MiningRow["status"]) {
  if (status === "PENDING") return "text-amber-300";
  if (status === "ACTIVE") return "text-emerald-300";
  if (status === "COMPLETED") return "text-sky-300";
  if (status === "ABORTED" || status === "REJECTED") return "text-rose-300";
  return "text-white/80";
}

function statusLabel(status: MiningRow["status"]) {
  if (status === "COMPLETED") return "SUCCESS";
  return status;
}

export default function MiningPendingTable() {
  const [pendingRows, setPendingRows] = useState<MiningRow[]>([]);
  const [historyRows, setHistoryRows] = useState<MiningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [approvingId, setApprovingId] = useState("");

  const load = useCallback(async () => {
    setErr("");

    try {
      const [pendingRes, historyRes] = await Promise.all([
        fetch("/api/admin/mining-pending", {
          method: "GET",
          cache: "no-store",
        }),
        fetch("/api/admin/mining-history", {
          method: "GET",
          cache: "no-store",
        }),
      ]);

      const pendingJson = (await pendingRes.json().catch(() => ({}))) as MiningResp;
      const historyJson = (await historyRes.json().catch(() => ({}))) as MiningResp;

      if (!pendingRes.ok) {
        throw new Error(pendingJson?.error || "Failed to load pending mining orders");
      }
      if (!historyRes.ok) {
        throw new Error(historyJson?.error || "Failed to load mining history");
      }

      setPendingRows(Array.isArray(pendingJson?.rows) ? pendingJson.rows : []);
      setHistoryRows(Array.isArray(historyJson?.rows) ? historyJson.rows : []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load mining data";
      setPendingRows([]);
      setHistoryRows([]);
      setErr(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const doApprove = async (miningId: string) => {
    if (!miningId) return;
    setApprovingId(miningId);
    setErr("");
    setInfo("");

    try {
      const r = await fetch("/api/admin/mining-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ miningId }),
      });
      const j = (await r.json().catch(() => ({}))) as MiningApproveResp;
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Approve failed");
      }

      setInfo("Mining order approved. Added to history.");
      await load();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Approve failed";
      setErr(message);
    } finally {
      setApprovingId("");
    }
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-xl font-semibold">Mining Pending</div>
          <div className="mt-1 text-sm text-white/60">
            Approve user mining purchase requests and keep history.
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
        >
          Refresh
        </button>
      </div>

      {info ? <div className="mb-3 text-sm text-emerald-300">{info}</div> : null}
      {err ? <div className="mb-3 text-sm text-red-300">{err}</div> : null}

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="mb-3 text-sm font-semibold text-white">Pending Approval</div>

        {loading ? (
          <div className="text-white/60">Loading...</div>
        ) : pendingRows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/60">
            No pending orders.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px]">
              <thead>
                <tr className="text-left text-white/60">
                  <th className="py-3">USER</th>
                  <th className="py-3">EMAIL</th>
                  <th className="py-3">PLAN</th>
                  <th className="py-3 text-right">AMOUNT (USDT)</th>
                  <th className="py-3">REQUESTED</th>
                  <th className="py-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {pendingRows.map((o) => (
                  <tr key={o.id} className="border-t border-white/10">
                    <td className="py-3">{o.username || o.user_id.slice(0, 8)}</td>
                    <td className="py-3">{o.email || "-"}</td>
                    <td className="py-3">{o.plan_id}</td>
                    <td className="py-3 text-right">{money(Number(o.amount || 0))}</td>
                    <td className="py-3">{new Date(o.created_at).toLocaleString()}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void doApprove(o.id)}
                        disabled={approvingId === o.id}
                        className="rounded-xl px-4 py-2 text-xs font-semibold text-black bg-[#F7B500] hover:brightness-110 active:scale-[.99] disabled:opacity-60"
                      >
                        {approvingId === o.id ? "Approving..." : "Approve"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="mb-3 text-sm font-semibold text-white">History</div>

        {loading ? (
          <div className="text-white/60">Loading...</div>
        ) : historyRows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/60">
            No history yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="text-left text-white/60">
                  <th className="py-3">USER</th>
                  <th className="py-3">EMAIL</th>
                  <th className="py-3">PLAN</th>
                  <th className="py-3 text-right">AMOUNT (USDT)</th>
                  <th className="py-3">STATUS</th>
                  <th className="py-3">REQUESTED</th>
                  <th className="py-3">ACTIVATED</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((o) => (
                  <tr key={o.id} className="border-t border-white/10">
                    <td className="py-3">{o.username || o.user_id.slice(0, 8)}</td>
                    <td className="py-3">{o.email || "-"}</td>
                    <td className="py-3">{o.plan_id}</td>
                    <td className="py-3 text-right">{money(Number(o.amount || 0))}</td>
                    <td className={`py-3 ${statusClass(o.status)}`}>{statusLabel(o.status)}</td>
                    <td className="py-3">{new Date(o.created_at).toLocaleString()}</td>
                    <td className="py-3">
                      {o.activated_at ? new Date(o.activated_at).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
