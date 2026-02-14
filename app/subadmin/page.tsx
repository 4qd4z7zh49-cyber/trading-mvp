// app/subadmin/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import MiningPendingTable from "@/app/admin/components/MiningPendingTable";
import WithdrawRequestsPanel from "@/app/admin/components/WithdrawRequestsPanel";
import NotifyPanel from "@/app/admin/components/NotifyPanel";
import SupportChatPanel from "@/app/admin/components/SupportChatPanel";

type Asset = "USDT" | "BTC" | "ETH" | "SOL" | "XRP";
type TopupMode = "ADD" | "SUBTRACT";
const ASSETS: Asset[] = ["USDT", "BTC", "ETH", "SOL", "XRP"];

type UserRow = {
  id: string;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  managed_by?: string | null;
  managed_by_username?: string | null;
  balance?: number | null;
  usdt?: number | null;
  btc?: number | null;
  eth?: number | null;
  sol?: number | null;
  xrp?: number | null;
  created_at?: string | null;
};

type UsersResp = {
  users?: UserRow[];
  error?: string;
};

type TopupResp = {
  ok?: boolean;
  error?: string;
  mode?: TopupMode;
  newUsdtBalance?: number | null;
};

type AddressMap = Record<Asset, string>;

type DepositAddressResponse = {
  ok?: boolean;
  error?: string;
  addresses?: Partial<Record<Asset, string>>;
};

type TradePermissionUser = {
  id: string;
  username?: string | null;
  email?: string | null;
  buyEnabled?: boolean;
  sellEnabled?: boolean;
  source?: "db" | "memory" | "default";
};

type TradePermissionListResp = {
  users?: TradePermissionUser[];
  error?: string;
};

type TradePermissionUpdateResp = {
  ok?: boolean;
  error?: string;
  buyEnabled?: boolean;
  sellEnabled?: boolean;
};

type DepositRequestRow = {
  id: string;
  userId: string;
  adminId?: string | null;
  username?: string | null;
  email?: string | null;
  asset: Asset;
  amount: number;
  walletAddress: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  createdAt: string;
};

type DepositRequestListResp = {
  ok?: boolean;
  error?: string;
  pendingCount?: number;
  requests?: DepositRequestRow[];
};

type DepositRequestActionResp = {
  ok?: boolean;
  error?: string;
  pendingCount?: number;
  request?: DepositRequestRow;
};

async function readJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

function fmtAsset(v: number | null | undefined, asset: Asset) {
  const n = Number(v ?? 0);
  const maxFractionDigits = asset === "USDT" ? 2 : 8;
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}

function fmtDateTime(v?: string | null) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function fmtManagedBy(user: UserRow) {
  const id = String(user.managed_by || "");
  const name = String(user.managed_by_username || "").trim();
  if (!id) return "-";
  if (name) return `${name} (${id.slice(0, 8)}...)`;
  return `${id.slice(0, 10)}...`;
}

function emptyAddressMap(): AddressMap {
  return {
    USDT: "",
    BTC: "",
    ETH: "",
    SOL: "",
    XRP: "",
  };
}

export default function SubAdminPage() {
  const sp = useSearchParams();
  const tab = (sp.get("tab") || "overview").toLowerCase();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);

  const [topupOpen, setTopupOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<Asset>("USDT");
  const [topupMode, setTopupMode] = useState<TopupMode>("ADD");
  const [note, setNote] = useState("");
  const [topupLoading, setTopupLoading] = useState(false);
  const [topupErr, setTopupErr] = useState("");
  const [topupInfo, setTopupInfo] = useState("");
  const [depositAddresses, setDepositAddresses] = useState<AddressMap>(emptyAddressMap());
  const [depositAddressLoading, setDepositAddressLoading] = useState(false);
  const [depositAddressSaving, setDepositAddressSaving] = useState(false);
  const [depositAddressErr, setDepositAddressErr] = useState("");
  const [depositAddressInfo, setDepositAddressInfo] = useState("");
  const [permissionUsers, setPermissionUsers] = useState<TradePermissionUser[]>([]);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [permissionErr, setPermissionErr] = useState("");
  const [permissionSavingUserId, setPermissionSavingUserId] = useState("");
  const [depositRequests, setDepositRequests] = useState<DepositRequestRow[]>([]);
  const [depositRequestsLoading, setDepositRequestsLoading] = useState(false);
  const [depositRequestsErr, setDepositRequestsErr] = useState("");
  const [depositRequestsInfo, setDepositRequestsInfo] = useState("");
  const [depositRequestActionId, setDepositRequestActionId] = useState("");
  const [pendingDepositCount, setPendingDepositCount] = useState(0);

  async function reloadUsers() {
    setLoading(true);
    setErr("");

    try {
      const r = await fetch("/api/admin/users", { cache: "no-store" });
      const j = await readJson<UsersResp>(r);
      if (!r.ok) throw new Error(j?.error || "Failed to load users");
      setUsers(Array.isArray(j?.users) ? j.users : []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Network error";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  const fetchDepositAddresses = useCallback(async () => {
    const r = await fetch("/api/admin/deposit-addresses", {
      method: "GET",
      cache: "no-store",
    });
    const j = await readJson<DepositAddressResponse>(r);
    if (!r.ok || !j?.ok) {
      throw new Error(j?.error || "Failed to load deposit addresses");
    }

    return {
      USDT: String(j.addresses?.USDT || ""),
      BTC: String(j.addresses?.BTC || ""),
      ETH: String(j.addresses?.ETH || ""),
      SOL: String(j.addresses?.SOL || ""),
      XRP: String(j.addresses?.XRP || ""),
    } as AddressMap;
  }, []);

  const reloadDepositAddresses = useCallback(async () => {
    setDepositAddressLoading(true);
    setDepositAddressErr("");
    try {
      const rows = await fetchDepositAddresses();
      setDepositAddresses(rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load deposit addresses";
      setDepositAddressErr(message);
    } finally {
      setDepositAddressLoading(false);
    }
  }, [fetchDepositAddresses]);

  async function saveDepositAddresses() {
    setDepositAddressSaving(true);
    setDepositAddressErr("");
    setDepositAddressInfo("");
    try {
      const r = await fetch("/api/admin/deposit-addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: depositAddresses }),
      });
      const j = await readJson<DepositAddressResponse>(r);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Failed to save deposit addresses");
      }

      setDepositAddresses({
        USDT: String(j.addresses?.USDT || ""),
        BTC: String(j.addresses?.BTC || ""),
        ETH: String(j.addresses?.ETH || ""),
        SOL: String(j.addresses?.SOL || ""),
        XRP: String(j.addresses?.XRP || ""),
      });
      setDepositAddressInfo("Deposit wallet addresses saved");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save deposit addresses";
      setDepositAddressErr(message);
    } finally {
      setDepositAddressSaving(false);
    }
  }

  const fetchDepositRequests = useCallback(async (userId?: string) => {
    const params = new URLSearchParams();
    params.set("status", "PENDING");
    params.set("limit", "300");
    if (userId) params.set("userId", userId);

    const r = await fetch(`/api/admin/deposit-requests?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    const j = await readJson<DepositRequestListResp>(r);
    if (!r.ok || !j?.ok) {
      throw new Error(j?.error || "Failed to load deposit requests");
    }

    return {
      requests: Array.isArray(j?.requests) ? j.requests : [],
      pendingCount: Number(j?.pendingCount ?? 0),
    };
  }, []);

  const reloadDepositRequests = useCallback(async () => {
    setDepositRequestsLoading(true);
    setDepositRequestsErr("");
    try {
      const result = await fetchDepositRequests();
      setDepositRequests(result.requests);
      setPendingDepositCount(result.pendingCount);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load deposit requests";
      setDepositRequestsErr(message);
    } finally {
      setDepositRequestsLoading(false);
    }
  }, [fetchDepositRequests]);

  async function processDepositRequest(requestId: string, action: "APPROVE" | "DECLINE") {
    setDepositRequestActionId(requestId);
    setDepositRequestsErr("");
    setDepositRequestsInfo("");
    try {
      const r = await fetch("/api/admin/deposit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });

      const j = await readJson<DepositRequestActionResp>(r);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || `Failed to ${action.toLowerCase()} request`);
      }

      setDepositRequests((prev) => prev.filter((x) => x.id !== requestId));
      setPendingDepositCount(Number(j?.pendingCount ?? 0));
      setDepositRequestsInfo(
        action === "APPROVE" ? "Deposit request approved and credited." : "Deposit request declined."
      );

      await reloadUsers();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : `Failed to ${action.toLowerCase()} request`;
      setDepositRequestsErr(message);
    } finally {
      setDepositRequestActionId("");
    }
  }

  const fetchPermissionUsers = useCallback(async () => {
    const r = await fetch("/api/admin/trade-permission", {
      method: "GET",
      cache: "no-store",
    });
    const j = await readJson<TradePermissionListResp>(r);
    if (!r.ok) throw new Error(j?.error || "Failed to load trade permissions");
    return Array.isArray(j?.users) ? j.users : [];
  }, []);

  const reloadPermissionUsers = useCallback(async () => {
    setPermissionLoading(true);
    setPermissionErr("");

    try {
      const rows = await fetchPermissionUsers();
      setPermissionUsers(rows);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load trade permissions";
      setPermissionErr(message);
    } finally {
      setPermissionLoading(false);
    }
  }, [fetchPermissionUsers]);

  async function savePermission(userId: string, buyEnabled: boolean, sellEnabled: boolean) {
    setPermissionSavingUserId(userId);
    setPermissionErr("");
    try {
      const r = await fetch("/api/admin/trade-permission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, buyEnabled, sellEnabled }),
      });
      const j = await readJson<TradePermissionUpdateResp>(r);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Failed to save permission");
      }
      setPermissionUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                buyEnabled,
                sellEnabled,
              }
            : u
        )
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save permission";
      setPermissionErr(message);
    } finally {
      setPermissionSavingUserId("");
    }
  }

  useEffect(() => {
    if (tab !== "topups" && tab !== "overview") return;
    void reloadUsers();
    if (tab === "topups") {
      void reloadDepositAddresses();
      void reloadDepositRequests();
    }
  }, [tab, reloadDepositAddresses, reloadDepositRequests]);

  useEffect(() => {
    if (tab !== "orders") return;
    void reloadPermissionUsers();
  }, [tab, reloadPermissionUsers]);

  const openTopup = (u: UserRow) => {
    setSelectedUser(u);
    setAmount("");
    setAsset("USDT");
    setTopupMode("ADD");
    setNote("");
    setTopupErr("");
    setTopupInfo("");
    setDepositRequestsErr("");
    setDepositRequestsInfo("");
    setTopupOpen(true);
  };

  const closeTopup = () => {
    setTopupOpen(false);
    setSelectedUser(null);
    setAmount("");
    setTopupMode("ADD");
    setNote("");
    setTopupErr("");
  };

  const selectedUserRequests = useMemo(() => {
    if (!selectedUser) return [];
    return depositRequests.filter((r) => r.userId === selectedUser.id);
  }, [depositRequests, selectedUser]);
  const pendingByUserId = useMemo(() => {
    const map = new Map<string, number>();
    depositRequests.forEach((r) => {
      const key = String(r.userId || "");
      if (!key) return;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [depositRequests]);

  const confirmTopup = async () => {
    if (!selectedUser) return;

    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setTopupErr("Amount must be greater than 0");
      return;
    }

    setTopupLoading(true);
    setTopupErr("");
    setTopupInfo("");

    try {
      const r = await fetch("/api/admin/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          amount: n,
          asset,
          mode: topupMode,
          note: note || null,
        }),
      });

      const j = await readJson<TopupResp>(r);
      if (!r.ok || !j?.ok) {
        throw new Error(j?.error || "Topup failed");
      }

      if (asset === "USDT" && typeof j.newUsdtBalance === "number") {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === selectedUser.id
              ? {
                  ...u,
                  balance: Number(j.newUsdtBalance),
                  usdt: Number(j.newUsdtBalance),
                }
              : u
          )
        );
      }

      setTopupInfo(
        topupMode === "SUBTRACT"
          ? asset === "USDT"
            ? "Deduct success (USDT updated)"
            : `Deduct success (${asset})`
          : asset === "USDT"
            ? "Topup success (USDT updated)"
            : `Topup success (${asset})`
      );
      closeTopup();
      await reloadUsers();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Topup failed";
      setTopupErr(message);
    } finally {
      setTopupLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">
            {tab === "overview"
              ? "Overview"
              : tab === "topups"
                ? "Topups"
                : tab === "mining"
                  ? "Mining Pending"
                  : tab === "orders"
                    ? "Orders"
                    : tab === "withdraw"
                      ? "Withdraw"
                      : tab === "notify"
                        ? "Notify"
                        : "Support"}
          </div>
          <div className="mt-1 text-sm text-white/60">Sub-admin dashboard (managed users only)</div>
        </div>

        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm">
          Role: <b>Sub-admin</b>
        </div>
      </div>

      {tab === "overview" && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <div className="text-xl font-semibold">Overview</div>
              <div className="mt-1 text-sm text-white/60">
                Managed users with balance, email, managed-by and created time.
              </div>
            </div>
            <button
              type="button"
              onClick={() => void reloadUsers()}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              Refresh
            </button>
          </div>

          {loading ? <div className="text-white/60">Loading...</div> : null}
          {err ? <div className="text-red-400">{err}</div> : null}

          {!loading && !err ? (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[980px]">
                <thead className="bg-white/5 text-left text-white/60">
                  <tr>
                    <th className="px-3 py-3">USER</th>
                    <th className="px-3 py-3">EMAIL</th>
                    <th className="px-3 py-3 text-right">BALANCE (USDT)</th>
                    <th className="px-3 py-3">MANAGED BY</th>
                    <th className="px-3 py-3">CREATED AT</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-white/10">
                      <td className="px-3 py-3">{u.username || "-"}</td>
                      <td className="px-3 py-3">{u.email || "-"}</td>
                      <td className="px-3 py-3 text-right">{fmtAsset(u.usdt ?? u.balance, "USDT")}</td>
                      <td className="px-3 py-3">{fmtManagedBy(u)}</td>
                      <td className="px-3 py-3">{fmtDateTime(u.created_at)}</td>
                    </tr>
                  ))}
                  {users.length === 0 ? (
                    <tr>
                      <td className="px-3 py-6 text-white/60" colSpan={5}>
                        No users found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      )}

      {tab === "topups" && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-base font-semibold">
                Topups
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">
                  {pendingDepositCount}
                </span>
              </div>
              <div className="mt-1 text-sm text-white/60">Users under your management</div>
            </div>
            <button
              type="button"
              onClick={() => void reloadDepositRequests()}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              {depositRequestsLoading ? "Refreshing..." : "Refresh Requests"}
            </button>
          </div>

          <div className="mb-6 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-base font-semibold">Deposit Wallet Addresses (ON-CHAIN)</div>
            <div className="mt-1 text-sm text-white/60">
              Your managed users will see these addresses on Deposit page.
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {ASSETS.map((a) => (
                <label key={a} className="block">
                  <div className="mb-1 text-xs text-white/60">{a === "SOL" ? "Solana (SOL)" : a}</div>
                  <input
                    value={depositAddresses[a] || ""}
                    onChange={(e) =>
                      setDepositAddresses((prev) => ({
                        ...prev,
                        [a]: e.target.value,
                      }))
                    }
                    placeholder={`${a} wallet address`}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none"
                  />
                </label>
              ))}
            </div>

            {depositAddressErr ? <div className="mt-3 text-sm text-red-300">{depositAddressErr}</div> : null}
            {depositAddressInfo ? <div className="mt-3 text-sm text-emerald-300">{depositAddressInfo}</div> : null}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={depositAddressSaving}
                onClick={() => void saveDepositAddresses()}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {depositAddressSaving ? "Saving..." : "Save Addresses"}
              </button>
              <button
                type="button"
                onClick={() => void reloadDepositAddresses()}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                {depositAddressLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          {loading ? <div className="text-white/60">Loading...</div> : null}
          {err ? <div className="text-red-400">{err}</div> : null}
          {topupInfo ? <div className="mb-3 text-emerald-300">{topupInfo}</div> : null}
          {depositRequestsErr ? <div className="mb-3 text-red-300">{depositRequestsErr}</div> : null}
          {depositRequestsInfo ? <div className="mb-3 text-emerald-300">{depositRequestsInfo}</div> : null}

          {!loading && !err && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead>
                    <tr className="text-left text-white/60">
                      <th className="py-3">USERNAME</th>
                      <th className="py-3">EMAIL</th>
                      <th className="py-3 text-right">USDT</th>
                      <th className="py-3 text-right">BTC</th>
                      <th className="py-3 text-right">ETH</th>
                      <th className="py-3 text-right">SOL</th>
                      <th className="py-3 text-right">XRP</th>
                      <th className="py-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const pendingCount = pendingByUserId.get(u.id) ?? 0;
                      return (
                        <tr key={u.id} className="border-t border-white/10">
                          <td className="py-3">{u.username || "-"}</td>
                          <td className="py-3">{u.email || "-"}</td>
                          <td className="py-3 text-right">{fmtAsset(u.usdt ?? u.balance, "USDT")}</td>
                          <td className="py-3 text-right">{fmtAsset(u.btc, "BTC")}</td>
                          <td className="py-3 text-right">{fmtAsset(u.eth, "ETH")}</td>
                          <td className="py-3 text-right">{fmtAsset(u.sol, "SOL")}</td>
                          <td className="py-3 text-right">{fmtAsset(u.xrp, "XRP")}</td>
                          <td className="py-3 text-right">
                            <div className="relative inline-block">
                              {pendingCount > 0 ? (
                                <span className="absolute -top-2 -right-2 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                  {pendingCount}
                                </span>
                              ) : null}
                              <button
                                onClick={() => openTopup(u)}
                                className="rounded-full bg-yellow-500 px-4 py-2 font-semibold text-black"
                              >
                                More
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {users.length === 0 ? (
                      <tr>
                        <td className="py-6 text-white/60" colSpan={8}>
                          No users found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {topupOpen && selectedUser && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
                  <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b0b0b] p-5">
                    <div className="text-lg font-semibold">User Information</div>
                    <div className="mt-1 text-sm text-white/60">
                      Review user info, process topup/deduct and handle deposit requests.
                    </div>

                    <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-3 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-white/60">Username</span>
                        <span className="text-white">{selectedUser.username || "-"}</span>
                      </div>
                      <div className="mt-1 flex justify-between gap-3">
                        <span className="text-white/60">Email</span>
                        <span className="text-white">{selectedUser.email || "-"}</span>
                      </div>
                      <div className="mt-1 flex justify-between gap-3">
                        <span className="text-white/60">USDT</span>
                        <span className="text-white">{fmtAsset(selectedUser.usdt ?? selectedUser.balance, "USDT")}</span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between rounded-lg border border-white/10 px-2 py-1">
                          <span className="text-white/50">BTC</span>
                          <span>{fmtAsset(selectedUser.btc, "BTC")}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-white/10 px-2 py-1">
                          <span className="text-white/50">ETH</span>
                          <span>{fmtAsset(selectedUser.eth, "ETH")}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-white/10 px-2 py-1">
                          <span className="text-white/50">SOL</span>
                          <span>{fmtAsset(selectedUser.sol, "SOL")}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-lg border border-white/10 px-2 py-1">
                          <span className="text-white/50">XRP</span>
                          <span>{fmtAsset(selectedUser.xrp, "XRP")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 text-sm font-semibold">
                        {topupMode === "SUBTRACT" ? "Deduct Balance" : "Top up Balance"}
                      </div>
                      <div className="mb-2 text-xs text-white/60">Action</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setTopupMode("ADD")}
                          className={
                            "rounded-xl px-4 py-2 text-sm font-semibold border " +
                            (topupMode === "ADD"
                              ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                              : "border-white/10 bg-black/30 text-white/70")
                          }
                        >
                          Top up
                        </button>
                        <button
                          type="button"
                          onClick={() => setTopupMode("SUBTRACT")}
                          className={
                            "rounded-xl px-4 py-2 text-sm font-semibold border " +
                            (topupMode === "SUBTRACT"
                              ? "border-rose-400/50 bg-rose-500/20 text-rose-200"
                              : "border-white/10 bg-black/30 text-white/70")
                          }
                        >
                          Deduct
                        </button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 text-xs text-white/60">Asset</div>
                      <select
                        value={asset}
                        onChange={(e) => setAsset(e.target.value as Asset)}
                        className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
                      >
                        {ASSETS.map((a) => (
                          <option key={a} value={a} className="bg-black">
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>

                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={topupMode === "SUBTRACT" ? "Amount to deduct" : "Amount to top up"}
                      className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
                    />

                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Note (optional)"
                      className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
                    />

                    {topupErr ? <div className="mt-3 text-sm text-red-300">{topupErr}</div> : null}

                    <div className="mt-4">
                      <div className="mb-2 text-sm font-semibold">Deposit Requests</div>
                      <div className="mb-2 text-xs text-white/60">
                        Pending requests for this user: {selectedUserRequests.length}
                      </div>

                      {selectedUserRequests.length === 0 ? (
                        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/60">
                          No pending deposit request.
                        </div>
                      ) : (
                        <div className="max-h-44 space-y-2 overflow-auto">
                          {selectedUserRequests.map((req) => (
                            <div
                              key={req.id}
                              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold text-white">
                                  {req.asset} · {fmtAsset(req.amount, req.asset)}
                                </div>
                                <div className="text-white/50">{fmtDateTime(req.createdAt)}</div>
                              </div>
                              <div className="mt-1 text-white/50 break-all">{req.walletAddress}</div>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  disabled={depositRequestActionId === req.id}
                                  onClick={() => void processDepositRequest(req.id, "APPROVE")}
                                  className="rounded-lg bg-emerald-600 px-2 py-1 font-semibold text-white disabled:opacity-60"
                                >
                                  {depositRequestActionId === req.id ? "Processing..." : "Approve"}
                                </button>
                                <button
                                  type="button"
                                  disabled={depositRequestActionId === req.id}
                                  onClick={() => void processDepositRequest(req.id, "DECLINE")}
                                  className="rounded-lg bg-rose-600 px-2 py-1 font-semibold text-white disabled:opacity-60"
                                >
                                  {depositRequestActionId === req.id ? "Processing..." : "Decline"}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        onClick={closeTopup}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={topupLoading}
                        onClick={confirmTopup}
                        className={
                          "rounded-xl px-4 py-2 font-semibold disabled:opacity-60 " +
                          (topupMode === "SUBTRACT" ? "bg-rose-600" : "bg-blue-600")
                        }
                      >
                        {topupLoading
                          ? "Processing..."
                          : topupMode === "SUBTRACT"
                            ? "Confirm Deduct"
                            : "Confirm Top up"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "mining" && (
        <MiningPendingTable />
      )}

      {tab === "orders" && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4 text-xl font-semibold">Trade Permissions</div>
          <div className="mb-4 text-sm text-white/60">
            Control BUY/SELL access for your managed users.
          </div>

          {permissionLoading ? <div className="text-white/60">Loading...</div> : null}
          {permissionErr ? <div className="mb-3 text-red-400">{permissionErr}</div> : null}

          {!permissionLoading && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="text-left text-white/60">
                    <th className="py-3">USER</th>
                    <th className="py-3">EMAIL</th>
                    <th className="py-3 text-center">BUY</th>
                    <th className="py-3 text-center">SELL</th>
                    <th className="py-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionUsers.map((u) => (
                    <tr key={u.id} className="border-t border-white/10">
                      <td className="py-3">{u.username ?? "-"}</td>
                      <td className="py-3">{u.email ?? "-"}</td>
                      <td className="py-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setPermissionUsers((prev) =>
                              prev.map((x) =>
                                x.id === u.id ? { ...x, buyEnabled: !Boolean(x.buyEnabled) } : x
                              )
                            )
                          }
                          className={[
                            "rounded-xl px-3 py-2 text-xs font-semibold border",
                            u.buyEnabled
                              ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                              : "border-white/10 bg-black/30 text-white/70",
                          ].join(" ")}
                        >
                          {u.buyEnabled ? "Enabled" : "Disabled"}
                        </button>
                      </td>
                      <td className="py-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setPermissionUsers((prev) =>
                              prev.map((x) =>
                                x.id === u.id ? { ...x, sellEnabled: !Boolean(x.sellEnabled) } : x
                              )
                            )
                          }
                          className={[
                            "rounded-xl px-3 py-2 text-xs font-semibold border",
                            u.sellEnabled
                              ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                              : "border-white/10 bg-black/30 text-white/70",
                          ].join(" ")}
                        >
                          {u.sellEnabled ? "Enabled" : "Disabled"}
                        </button>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          disabled={permissionSavingUserId === u.id}
                          onClick={() =>
                            void savePermission(
                              u.id,
                              Boolean(u.buyEnabled),
                              Boolean(u.sellEnabled)
                            )
                          }
                          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {permissionSavingUserId === u.id ? "Saving..." : "Save"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {permissionUsers.length === 0 ? (
                    <tr>
                      <td className="py-6 text-white/60" colSpan={5}>
                        No users found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}

          <button
            type="button"
            onClick={() => void reloadPermissionUsers()}
            className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
          >
            Refresh Permissions
          </button>
        </div>
      )}

      {tab === "withdraw" && <WithdrawRequestsPanel />}

      {tab === "notify" && <NotifyPanel />}

      {tab === "support" && <SupportChatPanel />}
    </div>
  );
}
