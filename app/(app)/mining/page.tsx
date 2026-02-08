'use client';

import React, { useEffect, useMemo, useState } from 'react';

const LS_BALANCE = 'paper_balance_usd_v1';
const LS_MINING_ON = 'paper_mining_on_v1';
const LS_MINING_RATE = 'paper_mining_rate_v1'; // USD per minute

function money(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function MiningPage() {
  const defaultRate = 1; // $ per minute (demo)
  const [balance, setBalance] = useState<number>(10000);
  const [isOn, setIsOn] = useState<boolean>(false);
  const [rate, setRate] = useState<number>(defaultRate); // USD per minute

  // Load saved state
  useEffect(() => {
    try {
      const b = localStorage.getItem(LS_BALANCE);
      if (b) setBalance(Number(b));

      const on = localStorage.getItem(LS_MINING_ON);
      if (on) setIsOn(on === '1');

      const r = localStorage.getItem(LS_MINING_RATE);
      if (r) setRate(Number(r));
    } catch {}
  }, []);

  function saveBalance(next: number) {
    setBalance(next);
    try {
      localStorage.setItem(LS_BALANCE, String(next));
    } catch {}
  }

  function saveOn(next: boolean) {
    setIsOn(next);
    try {
      localStorage.setItem(LS_MINING_ON, next ? '1' : '0');
    } catch {}
  }

  function saveRate(next: number) {
    setRate(next);
    try {
      localStorage.setItem(LS_MINING_RATE, String(next));
    } catch {}
  }

  // Mining loop (adds to paper balance)
  useEffect(() => {
    if (!isOn) return;

    const intervalMs = 5000; // every 5 seconds
    const addPerTick = (rate / 60) * (intervalMs / 1000); // rate is per minute

    const t = setInterval(() => {
      setBalance((prev) => {
        const next = prev + addPerTick;
        try {
          localStorage.setItem(LS_BALANCE, String(next));
        } catch {}
        return next;
      });
    }, intervalMs);

    return () => clearInterval(t);
  }, [isOn, rate]);

  const statusColor = isOn ? '#22c55e' : '#ef4444';
  const quickRates = useMemo(() => [0.5, 1, 2, 5], []);

  return (
    <div style={{ background: '#0b0e11', minHeight: '100vh', padding: '16px', color: 'white' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '12px' }}>Mining</h1>

      <div style={{ background: '#111', padding: '16px', borderRadius: '10px', border: '1px solid #222' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Status</div>
            <div style={{ fontWeight: 900, color: statusColor }}>{isOn ? 'ON' : 'OFF'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Balance (shared)</div>
            <div style={{ fontWeight: 900 }}>${money(balance)}</div>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <Stat label="Earning Rate" value={`$${money(rate)}/min`} />
          <Stat label="Per Hour (est.)" value={`$${money(rate * 60)}/hr`} />
          <Stat label="Per Day (est.)" value={`$${money(rate * 60 * 24)}/day`} />
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 6 }}>Quick rates (demo)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {quickRates.map((r) => (
              <button
                key={r}
                onClick={() => saveRate(r)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid #333',
                  background: rate === r ? '#1f2937' : '#0f0f0f',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                ${r}/min
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button
            onClick={() => saveOn(!isOn)}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: 12,
              border: '1px solid #222',
              background: isOn ? '#7f1d1d' : '#14532d',
              color: 'white',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            {isOn ? 'Stop Mining' : 'Start Mining'}
          </button>

          <button
            onClick={() => {
              saveOn(false);
              saveRate(defaultRate);
              alert('Mining reset to default rate.');
            }}
            style={{
              padding: '12px',
              borderRadius: 12,
              border: '1px solid #333',
              background: '#0f0f0f',
              color: '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>

        <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 10 }}>
          *Demo mining simulator: it increases your paper balance automatically.
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#0f0f0f', padding: '12px', borderRadius: '10px', border: '1px solid #222' }}>
      <div style={{ color: '#94a3b8', fontSize: '12px' }}>{label}</div>
      <div style={{ fontSize: '18px', marginTop: '6px', fontWeight: 900 }}>{value}</div>
    </div>
  );
}