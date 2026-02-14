import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ASSETS = ["USDT", "BTC", "ETH", "SOL", "XRP"] as const;
type Asset = (typeof ASSETS)[number];
type AddressMap = Record<Asset, string>;

function emptyAddressMap(): AddressMap {
  return {
    USDT: "",
    BTC: "",
    ETH: "",
    SOL: "",
    XRP: "",
  };
}

function getCookie(req: Request, name: string) {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function isAdminRole(role: string | null) {
  return role === "admin" || role === "superadmin";
}

export async function GET(req: Request) {
  const session = getCookie(req, "admin_session");
  const role = getCookie(req, "admin_role");

  if (!session || !isAdminRole(role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("admins")
    .select("id, username, role, invitation_code, managed_by, created_at")
    .eq("role", "sub-admin")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const ids = rows.map((r) => String(r.id));
  const addressMapByAdmin = new Map<string, AddressMap>();

  if (ids.length > 0) {
    const { data: addrRows, error: addrErr } = await supabase
      .from("admin_deposit_addresses")
      .select("admin_id,asset,address")
      .in("admin_id", ids);

    if (addrErr) return NextResponse.json({ error: addrErr.message }, { status: 500 });

    (addrRows || []).forEach((row: { admin_id: string; asset: string; address: string | null }) => {
      const adminId = String(row.admin_id || "");
      if (!adminId) return;
      const next = addressMapByAdmin.get(adminId) ?? emptyAddressMap();
      const asset = String(row.asset || "").toUpperCase();
      if ((ASSETS as readonly string[]).includes(asset)) {
        next[asset as Asset] = String(row.address || "");
      }
      addressMapByAdmin.set(adminId, next);
    });
  }

  const subadmins = rows.map((row) => ({
    ...row,
    deposit_addresses: addressMapByAdmin.get(String(row.id)) ?? emptyAddressMap(),
  }));

  return NextResponse.json({ subadmins });
}

export async function POST(req: Request) {
  const session = getCookie(req, "admin_session");
  const role = getCookie(req, "admin_role");
  const adminId = getCookie(req, "admin_id"); // admins.id

  if (!session || !isAdminRole(role) || !adminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const username = String(body?.username || "").trim();
  const password = String(body?.password || "");

  if (!username || !password) {
    return NextResponse.json({ error: "username/password required" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("admin_create_subadmin", {
    p_username: username,
    p_password: password,
    p_managed_by: adminId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = Array.isArray(data) ? data[0] : null;
  return NextResponse.json({ ok: true, subadmin: row });
}
