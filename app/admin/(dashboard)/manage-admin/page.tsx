"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  username: string | null;
  role: string | null;
  invitation_code: string | null;
  managed_by: string | null;
  deposit_addresses?: {
    USDT?: string;
    BTC?: string;
    ETH?: string;
    SOL?: string;
    XRP?: string;
  };
  created_at?: string | null;
};

function shortAddress(v?: string) {
  const s = String(v || "").trim();
  if (!s) return "-";
  if (s.length <= 22) return s;
  return `${s.slice(0, 10)}...${s.slice(-8)}`;
}

export default function ManageAdminPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [newInvite, setNewInvite] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/subadmins");
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to load");
      setRows(Array.isArray(j?.subadmins) ? j.subadmins : []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setCreating(true);
    setErr("");
    setNewInvite(null);
    try {
      const r = await fetch("/api/admin/subadmins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Create failed");

      setNewInvite(j?.subadmin?.invitation_code ?? null);
      setUsername("");
      setPassword("");
      await load();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Create failed";
      setErr(message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-2xl font-semibold">Manage Admin</div>
        <p className="mt-2 text-white/60">Create sub-admin accounts + generate invitation codes.</p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="text-lg font-semibold">Create Sub-admin</div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={create}
            disabled={creating || username.trim().length < 3 || password.length < 4}
            className="rounded-xl bg-blue-600 px-4 py-2 font-semibold disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create + Generate code"}
          </button>

          {newInvite ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">
              <span className="text-white/60">Invitation:</span>{" "}
              <span className="font-semibold">{newInvite}</span>
            </div>
          ) : null}

          <button
            onClick={load}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2"
          >
            Refresh
          </button>
        </div>

        {err ? <div className="mt-3 text-red-400">{err}</div> : null}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="mb-3 text-lg font-semibold">Sub-admin list</div>

        {loading ? <div className="text-white/60">Loading...</div> : null}
        {!loading && rows.length === 0 ? <div className="text-white/60">No sub-admins.</div> : null}

        {!loading && rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px]">
              <thead>
                <tr className="text-left text-white/60">
                  <th className="py-3">USERNAME</th>
                  <th className="py-3">INVITE</th>
                  <th className="py-3">USDT ADDRESS</th>
                  <th className="py-3">BTC ADDRESS</th>
                  <th className="py-3">ETH ADDRESS</th>
                  <th className="py-3">SOL ADDRESS</th>
                  <th className="py-3">XRP ADDRESS</th>
                  <th className="py-3">MANAGED BY</th>
                  <th className="py-3 text-right">CREATED</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/10">
                    <td className="py-3">{r.username ?? "-"}</td>
                    <td className="py-3 font-mono">{r.invitation_code ?? "-"}</td>
                    <td className="py-3 font-mono text-xs text-white/70" title={r.deposit_addresses?.USDT || ""}>
                      {shortAddress(r.deposit_addresses?.USDT)}
                    </td>
                    <td className="py-3 font-mono text-xs text-white/70" title={r.deposit_addresses?.BTC || ""}>
                      {shortAddress(r.deposit_addresses?.BTC)}
                    </td>
                    <td className="py-3 font-mono text-xs text-white/70" title={r.deposit_addresses?.ETH || ""}>
                      {shortAddress(r.deposit_addresses?.ETH)}
                    </td>
                    <td className="py-3 font-mono text-xs text-white/70" title={r.deposit_addresses?.SOL || ""}>
                      {shortAddress(r.deposit_addresses?.SOL)}
                    </td>
                    <td className="py-3 font-mono text-xs text-white/70" title={r.deposit_addresses?.XRP || ""}>
                      {shortAddress(r.deposit_addresses?.XRP)}
                    </td>
                    <td className="py-3 font-mono text-white/70">
                      {r.managed_by ? r.managed_by.slice(0, 12) + "…" : "-"}
                    </td>
                    <td className="py-3 text-right text-white/70">
                      {(r.created_at || "").toString().slice(0, 10) || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
