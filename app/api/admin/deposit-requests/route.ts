import { NextResponse } from "next/server";
import { assertCanManageUser, requireAdminSession, supabaseAdmin } from "../_helpers";

export const dynamic = "force-dynamic";

type Status = "PENDING" | "CONFIRMED" | "REJECTED";
type Action = "APPROVE" | "DECLINE";
type Asset = "USDT" | "BTC" | "ETH" | "SOL" | "XRP";

type DepositRow = {
  id: string;
  user_id: string;
  admin_id: string | null;
  asset: Asset;
  amount: number;
  wallet_address: string;
  status: Status;
  created_at: string;
};

type Body = {
  requestId?: string;
  action?: string;
  note?: string;
};

function parseBody(value: unknown): Body {
  if (!value || typeof value !== "object") return {};
  return value as Body;
}

function isRootAdmin(role: string) {
  return role === "admin" || role === "superadmin";
}

function normalizeStatus(value: string | null): Status {
  const s = String(value || "")
    .trim()
    .toUpperCase();
  if (s === "CONFIRMED") return "CONFIRMED";
  if (s === "REJECTED") return "REJECTED";
  return "PENDING";
}

function normalizeAction(value: unknown): Action | "" {
  const s = String(value || "")
    .trim()
    .toUpperCase();
  if (s === "APPROVE" || s === "CONFIRM") return "APPROVE";
  if (s === "DECLINE" || s === "REJECT") return "DECLINE";
  return "";
}

function normalizeAsset(value: unknown): Asset {
  const s = String(value || "")
    .trim()
    .toUpperCase();
  if (s === "BTC" || s === "ETH" || s === "SOL" || s === "XRP") return s as Asset;
  return "USDT";
}

function toNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function pendingCount(role: string, adminId: string) {
  let q = supabaseAdmin
    .from("deposit_history")
    .select("id", { count: "exact", head: true })
    .eq("status", "PENDING");

  if (!isRootAdmin(role)) {
    q = q.eq("admin_id", adminId);
  }

  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return Number(count ?? 0);
}

async function applyApprovedDeposit(
  userId: string,
  asset: Asset,
  amount: number,
  adminId: string,
  note: string
) {
  const safeAmount = Math.max(0, toNumber(amount));
  if (safeAmount <= 0) return;

  if (asset === "USDT") {
    const { data: balRow, error: balErr } = await supabaseAdmin
      .from("balances")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();
    if (balErr) throw new Error(balErr.message);

    const currentUsdt = Number(balRow?.balance ?? 0);
    const nextUsdt = currentUsdt + safeAmount;

    const { error: balUpErr } = await supabaseAdmin
      .from("balances")
      .upsert({ user_id: userId, balance: nextUsdt }, { onConflict: "user_id" });
    if (balUpErr) throw new Error(balUpErr.message);

    const { error: holdUpErr } = await supabaseAdmin
      .from("holdings")
      .upsert({ user_id: userId, asset: "USDT", balance: nextUsdt }, { onConflict: "user_id,asset" });
    if (holdUpErr) throw new Error(holdUpErr.message);
  } else {
    const { data: holdRow, error: holdErr } = await supabaseAdmin
      .from("holdings")
      .select("balance")
      .eq("user_id", userId)
      .eq("asset", asset)
      .maybeSingle();
    if (holdErr) throw new Error(holdErr.message);

    const currentHolding = Number(holdRow?.balance ?? 0);
    const nextHolding = currentHolding + safeAmount;

    const { error: holdUpErr } = await supabaseAdmin
      .from("holdings")
      .upsert({ user_id: userId, asset, balance: nextHolding }, { onConflict: "user_id,asset" });
    if (holdUpErr) throw new Error(holdUpErr.message);
  }

  const { error: logErr } = await supabaseAdmin.from("topups").insert({
    user_id: userId,
    admin_id: adminId,
    amount: safeAmount,
    asset,
    note: note || null,
  });
  if (logErr) throw new Error(logErr.message);
}

export async function GET(req: Request) {
  const auth = requireAdminSession(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { role, adminId } = auth;

  try {
    const url = new URL(req.url);
    const statusFilter = normalizeStatus(url.searchParams.get("status"));
    const userId = String(url.searchParams.get("userId") || "").trim();
    const limitRaw = Number(url.searchParams.get("limit") || 200);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 200;

    let q = supabaseAdmin
      .from("deposit_history")
      .select("id,user_id,admin_id,asset,amount,wallet_address,status,created_at")
      .eq("status", statusFilter)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!isRootAdmin(role)) {
      q = q.eq("admin_id", adminId);
    }
    if (userId) {
      q = q.eq("user_id", userId);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data || []) as DepositRow[];
    const userIds = Array.from(new Set(rows.map((r) => String(r.user_id)).filter(Boolean)));
    const profileMap = new Map<string, { username: string | null; email: string | null }>();

    if (userIds.length > 0) {
      const { data: profiles, error: profileErr } = await supabaseAdmin
        .from("profiles")
        .select("id,username,email")
        .in("id", userIds);
      if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });
      (profiles || []).forEach((p) => {
        profileMap.set(String(p.id), {
          username: p.username ? String(p.username) : null,
          email: p.email ? String(p.email) : null,
        });
      });
    }

    return NextResponse.json({
      ok: true,
      pendingCount: await pendingCount(role, adminId),
      requests: rows.map((r) => ({
        id: String(r.id),
        userId: String(r.user_id),
        adminId: r.admin_id ? String(r.admin_id) : null,
        asset: normalizeAsset(r.asset),
        amount: toNumber(r.amount),
        walletAddress: String(r.wallet_address || ""),
        status: normalizeStatus(r.status),
        createdAt: String(r.created_at || ""),
        username: profileMap.get(String(r.user_id))?.username ?? null,
        email: profileMap.get(String(r.user_id))?.email ?? null,
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to load deposit requests";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = requireAdminSession(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { role, adminId } = auth;

  try {
    const body = parseBody(await req.json().catch(() => null));
    const requestId = String(body.requestId || "").trim();
    const action = normalizeAction(body.action);
    const note = String(body.note || "").trim();

    if (!requestId) {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }
    if (!action) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { data: row, error: rowErr } = await supabaseAdmin
      .from("deposit_history")
      .select("id,user_id,admin_id,asset,amount,status")
      .eq("id", requestId)
      .maybeSingle();

    if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    const userId = String(row.user_id || "");
    if (!userId) return NextResponse.json({ error: "Invalid request user" }, { status: 400 });

    const canManage = await assertCanManageUser(adminId, role, userId);
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!isRootAdmin(role) && String(row.admin_id || "") !== adminId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (String(row.status || "").toUpperCase() !== "PENDING") {
      return NextResponse.json({ error: "Request already processed" }, { status: 409 });
    }

    const targetStatus: Status = action === "APPROVE" ? "CONFIRMED" : "REJECTED";
    let updateQuery = supabaseAdmin
      .from("deposit_history")
      .update({ status: targetStatus })
      .eq("id", requestId)
      .eq("status", "PENDING");

    if (!isRootAdmin(role)) {
      updateQuery = updateQuery.eq("admin_id", adminId);
    }

    const { data: updated, error: upErr } = await updateQuery
      .select("id,user_id,admin_id,asset,amount,status,created_at,wallet_address")
      .maybeSingle();

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: "Request already processed" }, { status: 409 });

    if (targetStatus === "CONFIRMED") {
      try {
        await applyApprovedDeposit(
          String(updated.user_id),
          normalizeAsset(updated.asset),
          toNumber(updated.amount),
          adminId,
          note || `Approved deposit request ${requestId}`
        );
      } catch (applyErr: unknown) {
        await supabaseAdmin
          .from("deposit_history")
          .update({ status: "PENDING" })
          .eq("id", requestId)
          .eq("status", "CONFIRMED");
        const message = applyErr instanceof Error ? applyErr.message : "Failed to apply deposit";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      request: {
        id: String(updated.id),
        userId: String(updated.user_id),
        adminId: updated.admin_id ? String(updated.admin_id) : null,
        asset: normalizeAsset(updated.asset),
        amount: toNumber(updated.amount),
        status: normalizeStatus(updated.status),
        walletAddress: String(updated.wallet_address || ""),
        createdAt: String(updated.created_at || ""),
      },
      pendingCount: await pendingCount(role, adminId),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to process deposit request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
