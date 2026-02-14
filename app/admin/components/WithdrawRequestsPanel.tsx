"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Asset = "USDT" | "BTC" | "ETH" | "SOL" | "XRP";
type WithdrawStatus = "PENDING" | "CONFIRMED" | "FROZEN";
type FilterStatus = "ALL" | WithdrawStatus;
type Action = "CONFIRM" | "FROZEN";

type WithdrawRequest = {
  id: string;
  userId: string;
  adminId?: string | null;
  username?: string | null;
  email?: string | null;
  asset: Asset;
  amount: number;
  walletAddress: string;
  status: WithdrawStatus;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ListResp = {
  ok?: boolean;
  error?: string;
  pendingCount?: number;
  requests?: WithdrawRequest[];
};

type ActionResp = {
  ok?: boolean;
  error?: string;
  pendingCount?: number;
  request?: WithdrawRequest;
};

async function readJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

function fmtWhen(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function fmtAmount(value: number, asset: Asset) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: asset === "USDT" ? 2 : 8,
  });
}

function statusBadgeClass(status: WithdrawStatus) {
  if (status === "CONFIRMED") return "border-emerald-300/30 bg-emerald-500/10 text-emerald-200";
  if (status === "FROZEN") return "border-rose-300/30 bg-rose-500/10 text-rose-200";
  return "border-amber-300/30 bg-amber-500/10 text-amber-200";
}

export default function WithdrawRequestsPanel() {
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [rows, setRows] = useState<WithdrawRequest[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const load = useCallback(async (status: FilterStatus = filter) => {
    setLoading(true);
    setErr("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "300");
      if (status !== "ALL") params.set("status", status);
      const r = await fetch(`/api/admin/withdraw-requests?${params.toString()}`, {
        cache: "no-store",
      });
      const j = await readJson<ListResp>(r);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Failed to load withdraw requests");
      }

      setRows(Array.isArray(j.requests) ? j.requests : []);
      setPendingCount(Number(j.pendingCount ?? 0));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load withdraw requests";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const pendingInView = useMemo(
    () => rows.filter((row) => row.status === "PENDING").length,
    [rows]
  );

  const onAction = async (requestId: string, action: Action) => {
    setActionLoadingId(requestId);
    setErr("");
    setInfo("");
    try {
      const apiAction = action === "FROZEN" ? "FREEZE" : "CONFIRM";
      const r = await fetch("/api/admin/withdraw-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          action: apiAction,
        }),
      });
      const j = await readJson<ActionResp>(r);
      if (!r.ok || !j?.ok || !j.request) {
        throw new Error(j?.error || "Failed to update withdraw status");
      }

      setRows((prev) =>
        prev.map((row) => (row.id === requestId ? { ...row, ...j.request } : row))
      );
      setPendingCount(Number(j.pendingCount ?? 0));
      setInfo(action === "CONFIRM" ? "Withdraw confirmed." : "Withdraw frozen.");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to update withdraw status";
      setErr(message);
    } finally {
      setActionLoadingId("");
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="text-xl font-semibold">Withdraw Requests</div>
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">
            {pendingCount}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterStatus)}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
          >
            <option value="ALL" className="bg-black">All</option>
            <option value="PENDING" className="bg-black">Pending</option>
            <option value="CONFIRMED" className="bg-black">Confirmed</option>
            <option value="FROZEN" className="bg-black">Frozen</option>
          </select>
          <button
            type="button"
            onClick={() => void load(filter)}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="mb-3 text-xs text-white/60">
        Pending in current list: {pendingInView}
      </div>

      {err ? <div className="mb-3 text-sm text-red-300">{err}</div> : null}
      {info ? <div className="mb-3 text-sm text-emerald-300">{info}</div> : null}

      {loading ? <div className="text-white/60">Loading...</div> : null}

      {!loading && rows.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/60">
          No withdraw requests.
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[1120px]">
            <thead className="bg-white/5 text-left text-white/60">
              <tr>
                <th className="px-3 py-3">USER</th>
                <th className="px-3 py-3">EMAIL</th>
                <th className="px-3 py-3">ASSET</th>
                <th className="px-3 py-3 text-right">AMOUNT</th>
                <th className="px-3 py-3">ADDRESS</th>
                <th className="px-3 py-3">STATUS</th>
                <th className="px-3 py-3">TIME</th>
                <th className="px-3 py-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const busy = actionLoadingId === row.id;
                return (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="px-3 py-3">{row.username ?? "-"}</td>
                    <td className="px-3 py-3">{row.email ?? "-"}</td>
                    <td className="px-3 py-3">{row.asset}</td>
                    <td className="px-3 py-3 text-right">{fmtAmount(row.amount, row.asset)}</td>
                    <td className="px-3 py-3 text-xs text-white/80">{row.walletAddress}</td>
                    <td className="px-3 py-3">
                      <span
                        className={[
                          "rounded-full border px-2 py-0.5 text-xs font-semibold",
                          statusBadgeClass(row.status),
                        ].join(" ")}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-white/70">{fmtWhen(row.createdAt)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          disabled={busy || row.status === "CONFIRMED"}
                          onClick={() => void onAction(row.id, "CONFIRM")}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {busy ? "..." : "Confirm"}
                        </button>
                        <button
                          type="button"
                          disabled={busy || row.status === "FROZEN"}
                          onClick={() => void onAction(row.id, "FROZEN")}
                          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {busy ? "..." : "Frozen"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
