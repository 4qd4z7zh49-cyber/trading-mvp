"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Asset } from "@/lib/walletStore";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

const ASSETS: Asset[] = ["USDT", "BTC", "ETH", "SOL", "XRP"];

type PriceMap = Record<Asset, number | null>;
type BalanceMap = Record<Asset, number>;

type WalletStateResponse = {
  ok?: boolean;
  error?: string;
  holdings?: Partial<Record<Asset | string, number>>;
};

type PriceResponse = {
  ok?: boolean;
  error?: string;
  priceUSDT?: Partial<Record<Asset, number | null>>;
};

type ExchangeResponse = {
  ok?: boolean;
  error?: string;
  holdings?: Partial<Record<Asset | string, number>>;
  spentAmount?: number;
  receivedAmount?: number;
  fromAsset?: Asset;
  toAsset?: Asset;
};

const DEFAULT_BALANCES: BalanceMap = {
  USDT: 0,
  BTC: 0,
  ETH: 0,
  SOL: 0,
  XRP: 0,
};

const DEFAULT_PRICES: PriceMap = {
  USDT: 1,
  BTC: null,
  ETH: null,
  SOL: null,
  XRP: null,
};

function fmtAmount(value: number, asset: Asset) {
  const digits = asset === "USDT" ? 2 : 8;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function fmtMoney(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function WalletPage() {
  const router = useRouter();
  const redirectedRef = useRef(false);

  const [balances, setBalances] = useState<BalanceMap>(DEFAULT_BALANCES);
  const [prices, setPrices] = useState<PriceMap>(DEFAULT_PRICES);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [walletErr, setWalletErr] = useState("");
  const [priceErr, setPriceErr] = useState("");
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [fromAsset, setFromAsset] = useState<Asset>("USDT");
  const [toAsset, setToAsset] = useState<Asset>("BTC");
  const [exchangeAmount, setExchangeAmount] = useState("");
  const [exchangeLoading, setExchangeLoading] = useState(false);
  const [exchangeErr, setExchangeErr] = useState("");
  const [exchangeInfo, setExchangeInfo] = useState("");

  const applyHoldings = useCallback(
    (holdings?: Partial<Record<Asset | string, number>>) => {
      const h = holdings || {};
      setBalances({
        USDT: Number(h.USDT ?? 0),
        BTC: Number(h.BTC ?? 0),
        ETH: Number(h.ETH ?? 0),
        SOL: Number(h.SOL ?? 0),
        XRP: Number(h.XRP ?? 0),
      });
      setWalletErr("");
      setLastSync(Date.now());
    },
    []
  );

  const refreshWalletFromClient = useCallback(async () => {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData?.user?.id) {
      throw new Error("Unauthorized");
    }

    const userId = authData.user.id;

    const [{ data: balanceRow, error: balErr }, { data: holdingsRows, error: holdErr }] =
      await Promise.all([
        supabase.from("balances").select("balance").eq("user_id", userId).maybeSingle(),
        supabase.from("holdings").select("asset, balance").eq("user_id", userId),
      ]);

    if (balErr) throw new Error(balErr.message);

    const holdings: Partial<Record<Asset | string, number>> = {
      USDT: Number(balanceRow?.balance ?? 0),
    };

    if (!holdErr) {
      (holdingsRows || []).forEach((row) => {
        holdings[String(row.asset)] = Number(row.balance ?? 0);
      });
    }

    applyHoldings(holdings);
  }, [applyHoldings]);

  const refreshWallet = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch("/api/wallet/state", {
        cache: "no-store",
        headers,
      });
      const json = (await res.json().catch(() => ({}))) as WalletStateResponse;

      if (res.ok && json?.ok) {
        applyHoldings(json.holdings);
        return;
      }

      // If server-side route cannot read auth cookie, fallback to client session.
      if (res.status === 401 || json?.error === "Unauthorized") {
        await refreshWalletFromClient();
        return;
      }

      throw new Error(json?.error || "Failed to load wallet");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load wallet";
      if (message === "Unauthorized") {
        setWalletErr("Unauthorized (please login with your user account)");
        if (!redirectedRef.current) {
          redirectedRef.current = true;
          router.replace("/login?next=/wallet");
        }
      } else {
        setWalletErr(message);
      }
    } finally {
      setLoadingWallet(false);
    }
  }, [applyHoldings, refreshWalletFromClient, router]);

  const refreshPrices = useCallback(async () => {
    try {
      const res = await fetch("/api/prices", { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as PriceResponse;
      if (!json?.ok || !json?.priceUSDT) {
        throw new Error(json?.error || "Failed to load prices");
      }

      setPrices({
        USDT: Number(json.priceUSDT.USDT ?? 1),
        BTC:
          typeof json.priceUSDT.BTC === "number" ? Number(json.priceUSDT.BTC) : null,
        ETH:
          typeof json.priceUSDT.ETH === "number" ? Number(json.priceUSDT.ETH) : null,
        SOL:
          typeof json.priceUSDT.SOL === "number" ? Number(json.priceUSDT.SOL) : null,
        XRP:
          typeof json.priceUSDT.XRP === "number" ? Number(json.priceUSDT.XRP) : null,
      });
      setPriceErr("");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load prices";
      setPriceErr(message);
    }
  }, []);

  useEffect(() => {
    void refreshWallet();
    const t = window.setInterval(() => {
      void refreshWallet();
    }, 5_000);
    return () => window.clearInterval(t);
  }, [refreshWallet]);

  useEffect(() => {
    void refreshPrices();
    const t = window.setInterval(() => {
      void refreshPrices();
    }, 15_000);
    return () => window.clearInterval(t);
  }, [refreshPrices]);

  const rows = useMemo(
    () =>
      ASSETS.map((asset) => {
        const balance = Number(balances[asset] ?? 0);
        const price = prices[asset];
        const value = typeof price === "number" ? balance * price : null;
        return { asset, balance, price, value };
      }),
    [balances, prices]
  );

  const estimatedReceive = useMemo(() => {
    const amount = Number(exchangeAmount);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const fromPrice = fromAsset === "USDT" ? 1 : prices[fromAsset];
    const toPrice = toAsset === "USDT" ? 1 : prices[toAsset];
    if (fromPrice == null || toPrice == null || fromPrice <= 0 || toPrice <= 0) return null;

    const valueUsdt = fromAsset === "USDT" ? amount : amount * fromPrice;
    return toAsset === "USDT" ? valueUsdt : valueUsdt / toPrice;
  }, [exchangeAmount, fromAsset, prices, toAsset]);

  const totalUsdt = useMemo(
    () =>
      rows.reduce((sum, row) => {
        if (row.value == null) return sum;
        return sum + row.value;
      }, 0),
    [rows]
  );

  const lastSyncText = useMemo(() => {
    if (!lastSync) return "-";
    return new Date(lastSync).toLocaleTimeString();
  }, [lastSync]);

  const onFromAssetChange = (next: Asset) => {
    setFromAsset(next);
    if (next === toAsset) {
      setToAsset(ASSETS.find((a) => a !== next) ?? "USDT");
    }
  };

  const onToAssetChange = (next: Asset) => {
    setToAsset(next);
    if (next === fromAsset) {
      setFromAsset(ASSETS.find((a) => a !== next) ?? "USDT");
    }
  };

  const submitExchange = async () => {
    setExchangeErr("");
    setExchangeInfo("");

    const amount = Number(exchangeAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setExchangeErr("Enter a valid amount");
      return;
    }
    if (fromAsset === toAsset) {
      setExchangeErr("From/To assets must be different");
      return;
    }
    if (amount > Number(balances[fromAsset] ?? 0)) {
      setExchangeErr(`Insufficient ${fromAsset} balance`);
      return;
    }

    setExchangeLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch("/api/wallet/exchange", {
        method: "POST",
        headers,
        body: JSON.stringify({
          fromAsset,
          toAsset,
          amount,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as ExchangeResponse;
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Exchange failed");
      }

      applyHoldings(json.holdings);
      const received = Number(json.receivedAmount ?? 0);
      setExchangeInfo(
        `Converted ${fmtAmount(amount, fromAsset)} ${fromAsset} -> ${fmtAmount(
          received,
          toAsset
        )} ${toAsset}`
      );
      setExchangeAmount("");
      void refreshPrices();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Exchange failed";
      setExchangeErr(message);
    } finally {
      setExchangeLoading(false);
    }
  };

  return (
    <div className="px-4 pt-5 pb-24">
      <div className="mx-auto w-full max-w-[680px] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-white">Wallet</h1>
          <button
            type="button"
            onClick={() => {
              void refreshWallet();
              void refreshPrices();
            }}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/90 hover:bg-white/10"
          >
            Refresh
          </button>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/60">Estimated Total (USDT)</div>
          <div className="mt-1 text-3xl font-semibold text-white">{fmtMoney(totalUsdt)}</div>
          <div className="mt-2 text-xs text-white/50">Last sync: {lastSyncText}</div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold text-white">Coin Exchange</div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs text-white/60">From</div>
              <select
                value={fromAsset}
                onChange={(e) => onFromAssetChange(e.target.value as Asset)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
              >
                {ASSETS.map((a) => (
                  <option key={a} value={a} className="bg-black">
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-1 text-xs text-white/60">To</div>
              <select
                value={toAsset}
                onChange={(e) => onToAssetChange(e.target.value as Asset)}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
              >
                {ASSETS.map((a) => (
                  <option key={a} value={a} className="bg-black">
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3">
            <div className="mb-1 text-xs text-white/60">Amount ({fromAsset})</div>
            <div className="flex flex-wrap gap-2">
              <input
                value={exchangeAmount}
                onChange={(e) => setExchangeAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
              />
              <button
                type="button"
                onClick={() => setExchangeAmount(String(Number(balances[fromAsset] ?? 0)))}
                className="shrink-0 rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/90"
              >
                Max
              </button>
            </div>
            <div className="mt-1 text-xs text-white/50">
              Available: {fmtAmount(Number(balances[fromAsset] ?? 0), fromAsset)} {fromAsset}
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/80">
            You receive (est.):{" "}
            <span className="font-semibold text-white">
              {estimatedReceive == null ? "-" : fmtAmount(estimatedReceive, toAsset)} {toAsset}
            </span>
          </div>

          <button
            type="button"
            onClick={submitExchange}
            disabled={exchangeLoading}
            className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
          >
            {exchangeLoading ? "Converting..." : "Convert"}
          </button>

          {exchangeErr ? (
            <div className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
              {exchangeErr}
            </div>
          ) : null}

          {exchangeInfo ? (
            <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">
              {exchangeInfo}
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-blue-400/20 bg-gradient-to-br from-blue-500/10 to-cyan-400/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-white">Withdraw Funds</div>
              <div className="mt-1 text-xs text-white/60">
                Submit your withdraw amount and destination wallet address.
              </div>
            </div>
            <Link
              href="/withdraw"
              className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 sm:w-auto"
            >
              Go to Withdraw
            </Link>
          </div>
        </section>

        {walletErr ? (
          <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
            {walletErr}
          </div>
        ) : null}

        {priceErr ? (
          <div className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-100">
            Price feed warning: {priceErr}
          </div>
        ) : null}

        <section className="rounded-2xl border border-white/10 bg-white/5 p-3">
          {loadingWallet ? (
            <div className="py-8 text-center text-white/60">Loading wallet...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-white/60">
                    <th className="px-2 py-3">Asset</th>
                    <th className="px-2 py-3 text-right">Balance</th>
                    <th className="px-2 py-3 text-right">Price (USDT)</th>
                    <th className="px-2 py-3 text-right">Value (USDT)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.asset} className="border-t border-white/10 text-white/90">
                      <td className="px-2 py-3 font-semibold">{row.asset}</td>
                      <td className="px-2 py-3 text-right">
                        {fmtAmount(row.balance, row.asset)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        {row.price == null ? "-" : fmtMoney(row.price)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        {row.value == null ? "-" : fmtMoney(row.value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
