import { NextResponse } from "next/server";
import { requireAdminSession, supabaseAdmin } from "../_helpers";

export const dynamic = "force-dynamic";

const ASSETS = ["USDT", "BTC", "ETH", "SOL", "XRP"] as const;
type Asset = (typeof ASSETS)[number];
type AddressMap = Record<Asset, string>;

type AddressBody = {
  addresses?: Partial<Record<Asset | string, string>>;
};

function emptyMap(): AddressMap {
  return {
    USDT: "",
    BTC: "",
    ETH: "",
    SOL: "",
    XRP: "",
  };
}

function isRootAdmin(role: string) {
  return role === "admin" || role === "superadmin";
}

function normalizeBody(value: unknown): AddressBody {
  if (!value || typeof value !== "object") return {};
  return value as AddressBody;
}

function sanitizeAddress(value: unknown) {
  return String(value || "").trim();
}

async function loadAddressMap(adminId: string) {
  const map = emptyMap();
  if (!adminId) return map;

  const { data, error } = await supabaseAdmin
    .from("admin_deposit_addresses")
    .select("asset,address")
    .eq("admin_id", adminId);

  if (error) throw new Error(error.message);

  (data || []).forEach((row: { asset: string | null; address: string | null }) => {
    const asset = String(row.asset || "").toUpperCase();
    if ((ASSETS as readonly string[]).includes(asset)) {
      map[asset as Asset] = String(row.address || "");
    }
  });

  return map;
}

export async function GET(req: Request) {
  const auth = requireAdminSession(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const requestedAdminId = String(url.searchParams.get("adminId") || "").trim();

    let targetAdminId = auth.adminId;
    if (requestedAdminId && requestedAdminId !== auth.adminId) {
      if (!isRootAdmin(auth.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      targetAdminId = requestedAdminId;
    }

    const addresses = await loadAddressMap(targetAdminId);
    return NextResponse.json({
      ok: true,
      adminId: targetAdminId,
      addresses,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to load addresses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = requireAdminSession(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = normalizeBody(await req.json().catch(() => null));
    const rawAddresses = body.addresses ?? {};

    const payload = ASSETS.map((asset) => ({
      admin_id: auth.adminId,
      asset,
      address: sanitizeAddress(rawAddresses[asset]),
    }));

    const { error } = await supabaseAdmin
      .from("admin_deposit_addresses")
      .upsert(payload, { onConflict: "admin_id,asset" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const addresses = await loadAddressMap(auth.adminId);
    return NextResponse.json({
      ok: true,
      adminId: auth.adminId,
      addresses,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to save addresses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
