import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSETS = ["USDT", "BTC", "ETH", "SOL", "XRP"] as const;
type Asset = (typeof ASSETS)[number];

type PriceUSDT = Record<Asset, number | null>;

type ExchangeBody = {
  fromAsset?: string;
  toAsset?: string;
  amount?: number | string;
};

const COINGECKO = "https://api.coingecko.com/api/v3/simple/price";
const BINANCE = "https://api.binance.com/api/v3/ticker/price";

const COIN_ID: Record<Exclude<Asset, "USDT">, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
};

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function roundTo(v: number, digits = 12) {
  const p = 10 ** digits;
  return Math.round((v + Number.EPSILON) * p) / p;
}

function parseBody(v: unknown): ExchangeBody {
  if (!v || typeof v !== "object") return {};
  return v as ExchangeBody;
}

function normalizeAsset(v: unknown): Asset | "" {
  const s = String(v ?? "").trim().toUpperCase();
  return (ASSETS as readonly string[]).includes(s) ? (s as Asset) : "";
}

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function createUserClient(cookieHeader: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: cookieHeader ? { Cookie: cookieHeader } : {},
      },
    }
  );
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "";
  return authHeader.slice(7).trim();
}

async function resolveUserId(req: Request, svc: SupabaseClient) {
  const bearer = getBearerToken(req);
  if (bearer) {
    const { data, error } = await svc.auth.getUser(bearer);
    if (!error && data?.user?.id) return data.user.id;
  }

  const cookieHeader = req.headers.get("cookie") || "";
  const userClient = createUserClient(cookieHeader);
  const { data, error } = await userClient.auth.getUser();
  if (!error && data?.user?.id) return data.user.id;

  return "";
}

async function fromCoingecko(vs: "usdt" | "usd"): Promise<PriceUSDT | null> {
  const ids = Object.values(COIN_ID).join(",");
  const url = `${COINGECKO}?ids=${encodeURIComponent(ids)}&vs_currencies=${vs}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as Record<string, Record<string, unknown>>;
  const btc = toNumber(data[COIN_ID.BTC]?.[vs]);
  const eth = toNumber(data[COIN_ID.ETH]?.[vs]);
  const sol = toNumber(data[COIN_ID.SOL]?.[vs]);
  const xrp = toNumber(data[COIN_ID.XRP]?.[vs]);

  const val = (n: number) => (Number.isFinite(n) ? n : null);
  if (![btc, eth, sol, xrp].some(Number.isFinite)) return null;

  return {
    USDT: 1,
    BTC: val(btc),
    ETH: val(eth),
    SOL: val(sol),
    XRP: val(xrp),
  };
}

type BinanceTicker = { symbol: string; price: string };
const BINANCE_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"] as const;

async function fromBinance(): Promise<PriceUSDT | null> {
  const symbols = encodeURIComponent(JSON.stringify(BINANCE_SYMBOLS));
  const url = `${BINANCE}?symbols=${symbols}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) return null;

  const rows = (await res.json()) as BinanceTicker[];
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const map = new Map<string, number | null>();
  rows.forEach((r) => {
    const n = toNumber(r.price);
    map.set(r.symbol, Number.isFinite(n) ? n : null);
  });

  const btc = map.get("BTCUSDT") ?? null;
  const eth = map.get("ETHUSDT") ?? null;
  const sol = map.get("SOLUSDT") ?? null;
  const xrp = map.get("XRPUSDT") ?? null;

  if (btc == null && eth == null && sol == null && xrp == null) return null;

  return {
    USDT: 1,
    BTC: btc,
    ETH: eth,
    SOL: sol,
    XRP: xrp,
  };
}

async function fetchPricesUSDT() {
  return (
    (await fromCoingecko("usdt")) ??
    (await fromCoingecko("usd")) ??
    (await fromBinance())
  );
}

async function readHoldings(svc: SupabaseClient, userId: string) {
  const { data: balRow, error: balErr } = await svc
    .from("balances")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (balErr) throw new Error(balErr.message);

  const { data: holds, error: holdErr } = await svc
    .from("holdings")
    .select("asset, balance")
    .eq("user_id", userId);
  if (holdErr) throw new Error(holdErr.message);

  const current: Record<Asset, number> = {
    USDT: Number(balRow?.balance ?? 0),
    BTC: 0,
    ETH: 0,
    SOL: 0,
    XRP: 0,
  };

  (holds ?? []).forEach((r) => {
    const asset = normalizeAsset(r.asset);
    if (!asset) return;
    current[asset] = Number(r.balance ?? 0);
  });

  return current;
}

export async function POST(req: Request) {
  try {
    const svc = createServiceClient();
    const userId = await resolveUserId(req, svc);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = parseBody(await req.json().catch(() => null));
    const fromAsset = normalizeAsset(body.fromAsset);
    const toAsset = normalizeAsset(body.toAsset);
    const amount = toNumber(body.amount);

    if (!fromAsset || !toAsset) {
      return NextResponse.json({ error: "Invalid asset" }, { status: 400 });
    }
    if (fromAsset === toAsset) {
      return NextResponse.json({ error: "From/To assets must be different" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const prices = await fetchPricesUSDT();
    if (!prices) {
      return NextResponse.json({ error: "Price unavailable" }, { status: 503 });
    }

    const fromPrice = fromAsset === "USDT" ? 1 : Number(prices[fromAsset] ?? NaN);
    const toPrice = toAsset === "USDT" ? 1 : Number(prices[toAsset] ?? NaN);
    if (!Number.isFinite(fromPrice) || fromPrice <= 0 || !Number.isFinite(toPrice) || toPrice <= 0) {
      return NextResponse.json({ error: "Price unavailable for selected asset" }, { status: 503 });
    }

    const current = await readHoldings(svc, userId);
    const spend = roundTo(amount);
    if (current[fromAsset] + 1e-12 < spend) {
      return NextResponse.json(
        { error: `Insufficient ${fromAsset} balance` },
        { status: 400 }
      );
    }

    const valueUSDT = fromAsset === "USDT" ? spend : roundTo(spend * fromPrice);
    const receive = toAsset === "USDT" ? valueUSDT : roundTo(valueUSDT / toPrice);

    const next: Record<Asset, number> = { ...current };
    next[fromAsset] = roundTo(next[fromAsset] - spend);
    if (next[fromAsset] < 0 && next[fromAsset] > -1e-9) next[fromAsset] = 0;
    if (next[fromAsset] < 0) {
      return NextResponse.json({ error: `Insufficient ${fromAsset} balance` }, { status: 400 });
    }
    next[toAsset] = roundTo(next[toAsset] + receive);

    const { error: upBalErr } = await svc
      .from("balances")
      .upsert({ user_id: userId, balance: next.USDT }, { onConflict: "user_id" });
    if (upBalErr) return NextResponse.json({ error: upBalErr.message }, { status: 500 });

    const changedAssets = new Set<Asset>(["USDT", fromAsset, toAsset]);
    const holdRows = Array.from(changedAssets).map((asset) => ({
      user_id: userId,
      asset,
      balance: next[asset],
    }));
    const { error: upHoldErr } = await svc
      .from("holdings")
      .upsert(holdRows, { onConflict: "user_id,asset" });
    if (upHoldErr) return NextResponse.json({ error: upHoldErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      fromAsset,
      toAsset,
      spentAmount: spend,
      receivedAmount: receive,
      holdings: next,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
