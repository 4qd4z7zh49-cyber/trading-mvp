'use client';

import React, { useEffect, useState } from 'react';

const LS_MINING_RATE = 'paper_mining_rate_v1'; // same key as Mining page
// --- Paper reset keys (same as other pages)
const LS_BALANCE = 'paper_balance_usd_v1';
const LS_ORDERS = 'paper_orders_v1';
const LS_MINING_ON = 'paper_mining_on_v1';

export default function SettingsPage() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [miningRate, setMiningRate] = useState<string>('1');

  // load saved mining rate
  useEffect(() => {
    try {
      const r = localStorage.getItem(LS_MINING_RATE);
      if (r) setMiningRate(String(Number(r)));
    } catch {}
  }, []);

  function saveMiningRate() {
    const v = Number(miningRate);
    if (!Number.isFinite(v) || v < 0) return alert('Mining rate must be 0 or a positive number.');
    try {
      localStorage.setItem(LS_MINING_RATE, String(v));
    } catch {}
    alert('Saved! Go to Mining page to see updated rate.');
  }

  function resetPaperAccount() {
    if (!confirm('Reset paper balance, orders, and stop mining?')) return;

    try {
      localStorage.setItem(LS_BALANCE, String(10000));
      localStorage.setItem(LS_ORDERS, JSON.stringify([]));
      localStorage.setItem(LS_MINING_ON, '0');
    } catch {}

    alert('Paper account reset. Go to Trade or Mining page.');
  }

  return (
    <div style={{ background: '#0b0e11', minHeight: '100vh', padding: '16px', color: 'white' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '12px' }}>Settings</h1>

      <div style={{ background: '#111', padding: '16px', borderRadius: '10px', border: '1px solid #222' }}>
        {/* Theme (UI-only for now) */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ color: '#94a3b8', fontSize: '12px' }}>Theme (UI only for now)</div>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}
            style={{
              marginTop: '6px',
              width: '100%',
              padding: '10px',
              borderRadius: '10px',
              background: '#0f0f0f',
              color: 'white',
              border: '1px solid #222',
            }}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </div>

        {/* Mining rate (real) */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ color: '#94a3b8', fontSize: '12px' }}>Mining Rate (USD per minute)</div>
          <input
            value={miningRate}
            onChange={(e) => setMiningRate(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 1"
            style={{
              marginTop: '6px',
              width: '100%',
              padding: '10px',
              borderRadius: '10px',
              background: '#0f0f0f',
              color: 'white',
              border: '1px solid #222',
            }}
          />
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 8 }}>
            This will affect the Mining page earning speed.
          </div>
        </div>

        <button
          onClick={saveMiningRate}
          style={{
            marginTop: 10,
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid #333',
            background: '#0f0f0f',
            color: '#cbd5e1',
            cursor: 'pointer',
          }}
        >
          Save Mining Rate
        </button>

        <button
          onClick={resetPaperAccount}
          style={{
            marginTop: 14,
            width: '100%',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid #7f1d1d',
            background: '#3f1d1d',
            color: 'white',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Reset Paper Account
        </button>
      </div>
    </div>

  );
}