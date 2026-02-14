import { NextResponse } from "next/server";
import { requireAdminSession, supabaseAdmin, assertCanManageUser } from "../_helpers";
import { getPermissionsForUsers, setPermissionForUser } from "@/lib/tradePermissionStore";

type UpdateBody = {
  userId?: string;
  buyEnabled?: boolean;
  sellEnabled?: boolean;
};

function parseBody(v: unknown): UpdateBody {
  if (!v || typeof v !== "object") return {};
  return v as UpdateBody;
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = requireAdminSession(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { adminId, role } = auth;

  try {
    let q = supabaseAdmin
      .from("profiles")
      .select("id, username, email, managed_by")
      .order("created_at", { ascending: false });

    if (role === "sub-admin" || role === "subadmin") {
      q = q.eq("managed_by", adminId);
    }

    const { data: profiles, error: pErr } = await q;
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    const ids = (profiles ?? []).map((p) => String(p.id));
    const permissionMap = await getPermissionsForUsers(supabaseAdmin, ids);

    const users = (profiles ?? []).map((p) => {
      const uid = String(p.id);
      const perm = permissionMap[uid] ?? {
        buyEnabled: true,
        sellEnabled: true,
        source: "default" as const,
      };

      return {
        id: uid,
        username: p.username ?? null,
        email: p.email ?? null,
        buyEnabled: perm.buyEnabled,
        sellEnabled: perm.sellEnabled,
        source: perm.source,
      };
    });

    return NextResponse.json({ users });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = requireAdminSession(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { adminId, role } = auth;

  try {
    const body = parseBody(await req.json().catch(() => null));
    const userId = String(body.userId || "").trim();
    const buyEnabled = Boolean(body.buyEnabled);
    const sellEnabled = Boolean(body.sellEnabled);

    if (!userId) {
      return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
    }

    const ok = await assertCanManageUser(adminId, role, userId);
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const permission = await setPermissionForUser(supabaseAdmin, userId, {
      buyEnabled,
      sellEnabled,
    });

    return NextResponse.json({
      ok: true,
      userId,
      buyEnabled: permission.buyEnabled,
      sellEnabled: permission.sellEnabled,
      source: permission.source,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
