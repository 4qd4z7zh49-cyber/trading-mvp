import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Asset = "USDT" | "BTC" | "ETH" | "SOL" | "XRP";
type PriceUSDT = Record<Asset, number | null>;

const COINGECKO = "https://api.coingecko.com/api/v3/simple/price";
const BINANCE = "https://api.binance.com/api/v3/ticker/price";

const COIN_ID: Record<Exclude<Asset, "USDT">, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
};

const EMPTY_PRICE: PriceUSDT = {
  USDT: 1,
  BTC: null,
  ETH: null,
  SOL: null,
  XRP: null,
};

function toNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
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

  if (btc == null && eth == null && sol == null && xrp == null) return null;

  return {
    USDT: 1,
    BTC: btc,
    ETH: eth,
    SOL: sol,
    XRP: xrp,
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
  rows.forEach((r) => map.set(r.symbol, toNumber(r.price)));

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

export async function GET() {
  try {
    const priceUSDT =
      (await fromCoingecko("usdt")) ??
      (await fromCoingecko("usd")) ??
      (await fromBinance());

    if (!priceUSDT) {
      return NextResponse.json(
        { ok: false, error: "price fetch failed", priceUSDT: EMPTY_PRICE, ts: Date.now() },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, priceUSDT, ts: Date.now() });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(
      { ok: false, error: message, priceUSDT: EMPTY_PRICE, ts: Date.now() },
      { status: 200 }
    );
  }
}
