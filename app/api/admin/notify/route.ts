import { NextResponse } from "next/server";
import { assertCanManageUser, readCookie, requireAdminSession, supabaseAdmin } from "../_helpers";

export const dynamic = "force-dynamic";

type NotifyStatus = "PENDING" | "CONFIRMED";

type Body = {
  userId?: string;
  subject?: string;
  message?: string;
};

function parseBody(value: unknown): Body {
  if (!value || typeof value !== "object") return {};
  return value as Body;
}

function isRootAdmin(role: string) {
  return role === "admin" || role === "superadmin";
}

function resolveNotifyAuth(req: Request) {
  const strict = requireAdminSession(req);
  if (strict) return strict;

  const session = readCookie(req, "admin_session");
  const role = String(readCookie(req, "admin_role") || "");
  const adminId = String(readCookie(req, "admin_id") || "");
  if (!session || !role) return null;

  // Fallback: allow root admin access even when admin_id cookie is missing.
  if (isRootAdmin(role)) {
    return { role, adminId };
  }
  return null;
}

function normalizeStatus(value: unknown): NotifyStatus {
  const s = String(value || "")
    .trim()
    .toUpperCase();
  if (s === "CONFIRMED" || s === "READ") return "CONFIRMED";
  return "PENDING";
}

async function pendingCount(role: string, adminId: string) {
  let q = supabaseAdmin
    .from("user_notifications")
    .select("id", { count: "exact", head: true })
    .eq("status", "PENDING");

  if (!isRootAdmin(role)) {
    q = q.eq("admin_id", adminId);
  }

  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return Number(count ?? 0);
}

export async function GET(req: Request) {
  const auth = resolveNotifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { role, adminId } = auth;

  try {
    const url = new URL(req.url);
    const userId = String(url.searchParams.get("userId") || "").trim();
    const statusRaw = String(url.searchParams.get("status") || "").trim().toUpperCase();
    const limitRaw = Number(url.searchParams.get("limit") || 300);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.floor(limitRaw))) : 300;

    if (userId) {
      const canManage = await assertCanManageUser(adminId, role, userId);
      if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let q = supabaseAdmin
      .from("user_notifications")
      .select("id,user_id,admin_id,subject,message,status,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!isRootAdmin(role)) {
      q = q.eq("admin_id", adminId);
    }
    if (userId) {
      q = q.eq("user_id", userId);
    }
    if (statusRaw && statusRaw !== "ALL") {
      q = q.eq("status", normalizeStatus(statusRaw));
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data || [];
    const userIds = Array.from(new Set(rows.map((r) => String(r.user_id)).filter(Boolean)));
    const profileMap = new Map<string, { username: string | null; email: string | null }>();

    if (userIds.length > 0) {
      const { data: profiles, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("id,username,email")
        .in("id", userIds);
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

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
      notifications: rows.map((r) => ({
        id: String(r.id),
        userId: String(r.user_id),
        adminId: r.admin_id ? String(r.admin_id) : null,
        subject: String(r.subject || ""),
        message: String(r.message || ""),
        status: normalizeStatus(r.status),
        createdAt: String(r.created_at || ""),
        updatedAt: String(r.updated_at || r.created_at || ""),
        username: profileMap.get(String(r.user_id))?.username ?? null,
        email: profileMap.get(String(r.user_id))?.email ?? null,
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to load notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = resolveNotifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { role, adminId } = auth;

  try {
    const body = parseBody(await req.json().catch(() => null));
    const userId = String(body.userId || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });
    if (!subject) return NextResponse.json({ error: "Subject is required" }, { status: 400 });
    if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });
    if (subject.length > 180) {
      return NextResponse.json({ error: "Subject is too long (max 180)" }, { status: 400 });
    }
    if (message.length > 10_000) {
      return NextResponse.json({ error: "Message is too long (max 10000)" }, { status: 400 });
    }

    const canManage = await assertCanManageUser(adminId, role, userId);
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("user_notifications")
      .insert({
        user_id: userId,
        admin_id: adminId || null,
        subject,
        message,
        status: "PENDING",
      })
      .select("id,user_id,admin_id,subject,message,status,created_at,updated_at")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Failed to send notification" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      notification: {
        id: String(data.id),
        userId: String(data.user_id),
        adminId: data.admin_id ? String(data.admin_id) : null,
        subject: String(data.subject || ""),
        message: String(data.message || ""),
        status: normalizeStatus(data.status),
        createdAt: String(data.created_at || ""),
        updatedAt: String(data.updated_at || data.created_at || ""),
      },
      pendingCount: await pendingCount(role, adminId),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to send notification";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
