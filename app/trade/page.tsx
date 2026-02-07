'use client';

import React, { useEffect, useMemo, useState } from 'react';

type MarketKey = 'BTC' | 'ETH' | 'GOLD' | 'SILVER' | 'COFFEE';
type Side = 'BUY' | 'SELL';
type OrderType = 'MARKET' | 'LIMIT';

type PaperOrder = {
  id: string;
  time: string; // ISO
  market: string;
  symbol: string;
  side: Side;
  orderType: OrderType;
  qty: number;
  price: number; // filled price (estimated for MVP)
  total: number; // qty * price
};

const LS_BALANCE = 'paper_balance_usd_v1';
const LS_ORDERS = 'paper_orders_v1';

function money(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function genId() {
  // safe fallback (no error even if randomUUID missing)
  // @ts-ignore
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function calcStats(orders: { side: 'BUY' | 'SELL'; total: number; market: string; price: number }[]) {
  const buy = orders.filter((o) => o.side === 'BUY').reduce((s, o) => s + o.total, 0);
  const sell = orders.filter((o) => o.side === 'SELL').reduce((s, o) => s + o.total, 0);
  const pnl = sell - buy;

  const lastBuyPrice: Record<string, number> = {};
  let wins = 0,
    losses = 0;

  for (const o of [...orders].reverse()) {
    if (o.side === 'BUY') lastBuyPrice[o.market] = o.price;
    if (o.side === 'SELL') {
      const bp = lastBuyPrice[o.market];
      if (bp) o.price > bp ? wins++ : losses++;
    }
  }

  const decided = wins + losses;
  const winRate = decided === 0 ? null : Math.round((wins / decided) * 100);

  return { buy, sell, pnl, wins, losses, winRate };
}

export default function TradePage() {
  const markets = useMemo(
    () => [
      { key: 'BTC' as const, title: 'BTC', chartSymbol: 'BITSTAMP:BTCUSD', tapeSymbol: 'BITSTAMP:BTCUSD' },
      { key: 'ETH' as const, title: 'ETH', chartSymbol: 'BITSTAMP:ETHUSD', tapeSymbol: 'BITSTAMP:ETHUSD' },
      { key: 'GOLD' as const, title: 'Gold', chartSymbol: 'TVC:GOLD', tapeSymbol: 'TVC:GOLD' },
      { key: 'SILVER' as const, title: 'Silver', chartSymbol: 'TVC:SILVER', tapeSymbol: 'TVC:SILVER' },
      { key: 'COFFEE' as const, title: 'Coffee', chartSymbol: 'ICEUS:KC1!', tapeSymbol: 'ICEUS:KC1!' },
    ],
    []
  );

  const [active, setActive] = useState<MarketKey>('BTC');
  const activeMarket = markets.find((m) => m.key === active)!;

  // Trade panel state
  const [side, setSide] = useState<Side>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [qty, setQty] = useState<string>('1');
  const [limitPrice, setLimitPrice] = useState<string>('');
  const [fillPrice, setFillPrice] = useState<string>('100'); // MVP: estimated fill price

  // Local state synced with localStorage
  const [balance, setBalance] = useState<number>(10000);
  const [orders, setOrders] = useState<PaperOrder[]>([]);

  // Load from localStorage once
  useEffect(() => {
    try {
      const b = localStorage.getItem(LS_BALANCE);
      const o = localStorage.getItem(LS_ORDERS);
      if (b) setBalance(Number(b));
      else localStorage.setItem(LS_BALANCE, String(10000));

      if (o) setOrders(JSON.parse(o));
      else localStorage.setItem(LS_ORDERS, JSON.stringify([]));
    } catch {}
  }, []);

  function saveBalance(next: number) {
    setBalance(next);
    try {
      localStorage.setItem(LS_BALANCE, String(next));
    } catch {}
  }
  function saveOrders(next: PaperOrder[]) {
    setOrders(next);
    try {
      localStorage.setItem(LS_ORDERS, JSON.stringify(next));
    } catch {}
  }

  // Widgets
  const tickerTapeSrc =
    'https://s.tradingview.com/embed-widget/ticker-tape/?locale=en#' +
    encodeURIComponent(
      JSON.stringify({
        symbols: markets.map((m) => ({ proName: m.tapeSymbol, title: m.title })),
        colorTheme: 'dark',
        isTransparent: false,
        displayMode: 'adaptive',
        showSymbolLogo: true,
      })
    );

  const chartSrc =
    'https://s.tradingview.com/embed-widget/advanced-chart/?locale=en#' +
    encodeURIComponent(
      JSON.stringify({
        symbol: activeMarket.chartSymbol,
        interval: '15',
        timezone: 'UTC',
        theme: 'dark',
        style: '1',
        enable_publishing: false,
        allow_symbol_change: true,
        height: 520,
      })
    );

  const cryptoTopSrc =
    'https://s.tradingview.com/embed-widget/crypto-mkt-screener/?locale=en#' +
    encodeURIComponent(
      JSON.stringify({
        width: '100%',
        height: 260,
        defaultColumn: 'overview',
        screener_type: 'crypto_mkt',
        displayCurrency: 'USD',
        colorTheme: 'dark',
      })
    );

  const usGainersSrc =
    'https://s.tradingview.com/embed-widget/market-movers/?locale=en#' +
    encodeURIComponent(
      JSON.stringify({
        width: '100%',
        height: 360,
        market: 'us',
        showChart: true,
        defaultTab: 'gainers',
        colorTheme: 'dark',
      })
    );

  function submitOrder() {
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) return alert('Quantity must be a positive number.');

    if (orderType === 'LIMIT') {
      const lp = Number(limitPrice);
      if (!Number.isFinite(lp) || lp <= 0) return alert('Limit price must be a positive number.');
      return alert('Limit orders will be implemented later.\nFor now, use Market orders.');
    }

    const p = Number(fillPrice);
    if (!Number.isFinite(p) || p <= 0) return alert('Fill price must be a positive number.');

    const total = q * p;
    const nextBalance = side === 'BUY' ? balance - total : balance + total;

    if (side === 'BUY' && nextBalance < 0) return alert('Insufficient balance for this BUY (paper).');

    const order: PaperOrder = {
      id: genId(),
      time: new Date().toISOString(),
      market: activeMarket.title,
      symbol: activeMarket.chartSymbol,
      side,
      orderType,
      qty: q,
      price: p,
      total,
    };

    saveBalance(nextBalance);
    saveOrders([order, ...orders]);
  }

  function resetPaper() {
    if (!confirm('Reset paper balance to $10,000 and clear orders?')) return;
    saveBalance(10000);
    saveOrders([]);
  }

  // ✅ Mobile responsive CSS (desktop 2-col, phone 1-col)
  const responsiveCss = `
    .tv-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
    .tv-right { display: grid; gap: 16px; }
    .tv-chart { height: 520px; }
    .tv-screener { height: 260px; }
    .tv-gainers { height: 360px; }
    .tv-tape { height: 46px; }

    @media (max-width: 900px) {
      .tv-grid { grid-template-columns: 1fr; }
      .tv-chart { height: 420px; }
      .tv-screener { height: 360px; }
      .tv-gainers { height: 420px; }
      .tv-tape { height: 56px; }
    }

    @media (max-width: 480px) {
      .tv-chart { height: 360px; }
      .tv-screener { height: 320px; }
      .tv-gainers { height: 380px; }
    }
  `;

  return (
    <div style={{ background: '#0b0e11', minHeight: '100vh', padding: '16px', color: 'white' }}>
      <style>{responsiveCss}</style>

      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Trade</h1>

      {/* Quotes */}
      <div style={{ marginBottom: 16 }}>
        <iframe src={tickerTapeSrc} className="tv-tape" style={{ width: '100%', border: 'none' }} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        {markets.map((m) => (
          <button
            key={m.key}
            onClick={() => setActive(m.key)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #222',
              background: active === m.key ? '#1f2937' : '#111',
              color: active === m.key ? 'white' : '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            {m.title}
          </button>
        ))}
      </div>

      {/* Main Grid */}
      <div className="tv-grid">
        {/* Chart */}
        <div style={{ background: '#111', padding: 8, borderRadius: 10, border: '1px solid #222' }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>
            Chart: {activeMarket.title} ({activeMarket.chartSymbol})
          </div>
          <iframe
            key={activeMarket.chartSymbol}
            src={chartSrc}
            className="tv-chart"
            style={{ width: '100%', border: 'none' }}
          />
        </div>

        {/* Right column */}
        <div className="tv-right">
          {/* Paper Trade Panel */}
          <div style={{ background: '#111', padding: 14, borderRadius: 10, border: '1px solid #222' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Paper Trade</div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>{activeMarket.title}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>Balance</div>
                <div style={{ fontWeight: 800 }}>${money(balance)}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <button
                onClick={() => setSide('BUY')}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #222',
                  background: side === 'BUY' ? '#14532d' : '#0f0f0f',
                  color: side === 'BUY' ? 'white' : '#cbd5e1',
                  cursor: 'pointer',
                }}
              >
                Buy
              </button>
              <button
                onClick={() => setSide('SELL')}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid #222',
                  background: side === 'SELL' ? '#7f1d1d' : '#0f0f0f',
                  color: side === 'SELL' ? 'white' : '#cbd5e1',
                  cursor: 'pointer',
                }}
              >
                Sell
              </button>
            </div>

            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Order Type</label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as OrderType)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 10,
                background: '#0f0f0f',
                color: 'white',
                border: '1px solid #222',
                marginBottom: 10,
              }}
            >
              <option value="MARKET">Market</option>
              <option value="LIMIT">Limit (later)</option>
            </select>

            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Quantity</label>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 1"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 10,
                background: '#0f0f0f',
                color: 'white',
                border: '1px solid #222',
                marginBottom: 10,
              }}
            />

            <label style={{ display: 'block', color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>
              Fill Price (MVP manual)
            </label>
            <input
              value={fillPrice}
              onChange={(e) => setFillPrice(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 65200"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: 10,
                background: '#0f0f0f',
                color: 'white',
                border: '1px solid #222',
                marginBottom: 12,
              }}
            />

            <button
              onClick={submitOrder}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 12,
                border: '1px solid #222',
                background: side === 'BUY' ? '#16a34a' : '#ef4444',
                color: 'white',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Place {side} (Paper)
            </button>

            <button
              onClick={resetPaper}
              style={{
                width: '100%',
                marginTop: 10,
                padding: '10px',
                borderRadius: 12,
                border: '1px solid #333',
                background: '#0f0f0f',
                color: '#cbd5e1',
                cursor: 'pointer',
              }}
            >
              Reset Paper Account
            </button>

            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 10 }}>
              Note: For MVP, fill price is manual (we’ll auto-fetch later).
            </div>
          </div>

          {/* Crypto list */}
          <div style={{ background: '#111', padding: 8, borderRadius: 10, border: '1px solid #222' }}>
            <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Crypto Market (Top coins)</div>
            <iframe src={cryptoTopSrc} className="tv-screener" style={{ width: '100%', border: 'none' }} />
          </div>

          {/* Summary */}
          {(() => {
            const s = calcStats(orders);
            return (
              <div style={{ background: '#111', padding: 12, borderRadius: 10, border: '1px solid #222' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>Summary (MVP)</div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>based on orders</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <StatBox label="Total BUY" value={`$${money(s.buy)}`} />
                  <StatBox label="Total SELL" value={`$${money(s.sell)}`} />
                  <StatBox
                    label="PnL"
                    value={`${s.pnl >= 0 ? '+' : ''}$${money(s.pnl)}`}
                    tone={s.pnl >= 0 ? 'good' : 'bad'}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 10 }}>
                  <StatBox label="Wins" value={`${s.wins}`} tone="good" />
                  <StatBox label="Losses" value={`${s.losses}`} tone="bad" />
                  <StatBox label="Win Rate" value={s.winRate === null ? '—' : `${s.winRate}%`} />
                </div>
              </div>
            );
          })()}

          {/* Orders history */}
          <div style={{ background: '#111', padding: 12, borderRadius: 10, border: '1px solid #222' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Orders</div>
              <div style={{ color: '#94a3b8', fontSize: 12 }}>{orders.length} total</div>
            </div>

            {orders.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: 12 }}>No orders yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {orders.slice(0, 6).map((o) => (
                  <div
                    key={o.id}
                    style={{
                      background: '#0f0f0f',
                      border: '1px solid #222',
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 800 }}>
                        {o.market} • {o.side}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>{new Date(o.time).toLocaleString()}</div>
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: 12, marginTop: 6 }}>
                      Qty: {o.qty} @ ${money(o.price)} = <b>${money(o.total)}</b>
                    </div>
                  </div>
                ))}
                {orders.length > 6 && <div style={{ color: '#94a3b8', fontSize: 12 }}>Showing latest 6 orders.</div>}
              </div>
            )}
          </div>

          {/* Leaderboard (demo) */}
          {(() => {
            const s = calcStats(orders);
            const yourPnl = s.pnl;

            const demo = [
              { name: 'Aung', pnl: 820 },
              { name: 'May', pnl: 410 },
              { name: 'Htet', pnl: -120 },
              { name: 'Nandar', pnl: 260 },
              { name: 'Ko Ko', pnl: 50 },
            ];

            const list = [...demo, { name: 'You', pnl: yourPnl }].sort((a, b) => b.pnl - a.pnl).slice(0, 6);
            const yourRank =
              [...demo, { name: 'You', pnl: yourPnl }]
                .sort((a, b) => b.pnl - a.pnl)
                .findIndex((x) => x.name === 'You') + 1;

            return (
              <div style={{ background: '#111', padding: 12, borderRadius: 10, border: '1px solid #222' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>Leaderboard (Demo)</div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>Your rank: #{yourRank}</div>
                </div>

                <div style={{ display: 'grid', gap: 8 }}>
                  {list.map((p, idx) => (
                    <div
                      key={p.name}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        background: '#0f0f0f',
                        border: '1px solid #222',
                        borderRadius: 10,
                        padding: 10,
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>
                        {idx + 1}. {p.name}
                      </div>
                      <div style={{ fontWeight: 900, color: p.pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                        {p.pnl >= 0 ? '+' : ''}${money(p.pnl)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* US Top Gainers */}
      <div style={{ marginTop: 16, background: '#111', padding: 8, borderRadius: 10, border: '1px solid #222' }}>
        <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>US Stocks — Top Gainers</div>
        <iframe src={usGainersSrc} className="tv-gainers" style={{ width: '100%', border: 'none' }} />
      </div>
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? '#22c55e' : tone === 'bad' ? '#ef4444' : '#e2e8f0';
  return (
    <div style={{ background: '#0f0f0f', border: '1px solid #222', borderRadius: 10, padding: 10 }}>
      <div style={{ color: '#94a3b8', fontSize: 12 }}>{label}</div>
      <div style={{ marginTop: 6, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}