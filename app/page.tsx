import Link from 'next/link';

export default function HomePage() {
  const responsiveCss = `
    .lp-wrap { max-width: 980px; margin: 0 auto; }
    .lp-hero { background: #111; border: 1px solid #222; border-radius: 16px; padding: 24px; }
    .lp-actions { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
    .lp-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 14px; }

    @media (max-width: 900px) {
      .lp-features { grid-template-columns: 1fr; }
    }

    @media (max-width: 520px) {
      .lp-actions { flex-direction: column; }
      .lp-actions a { width: 100%; text-align: center; }
    }
  `;

  return (
    <div style={{ background: '#0b0e11', minHeight: '100vh', padding: '28px', color: 'white' }}>
      <style>{responsiveCss}</style>

      <div className="lp-wrap">
        <div className="lp-hero">
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10 }}>Trading MVP · Demo Platform</div>

          <h1 style={{ fontSize: 34, margin: 0, lineHeight: 1.15 }}>Practice Trading with Live Market Charts</h1>

          <p style={{ color: '#cbd5e1', fontSize: 16, marginTop: 12, maxWidth: 760 }}>
            A <b>paper trading</b> platform to explore Crypto, Gold, Silver, Coffee, and top US stocks —{' '}
            <b>no real money required</b>.
          </p>

          <div className="lp-actions">
            <Link href="/trade" style={primaryBtn}>
              Go to Trade
            </Link>
            <Link href="/mining" style={secondaryBtn}>
              Mining (Demo)
            </Link>
            <Link href="/settings" style={secondaryBtn}>
              Settings
            </Link>
          </div>

          <div
            style={{
              marginTop: 18,
              padding: 12,
              borderRadius: 12,
              border: '1px solid #333',
              background: '#0f0f0f',
              color: '#94a3b8',
              fontSize: 12,
            }}
          >
            <b style={{ color: 'white' }}>Disclaimer:</b> This is a demo application. All trades are simulated. No real
            funds involved.
          </div>
        </div>

        <div className="lp-features">
          <Feature title="Live Markets" desc="Real-time charts via TradingView widgets." />
          <Feature title="Paper Trading" desc="Buy & sell simulation with balance, orders, and PnL summary." />
          <Feature title="Mining Demo" desc="Simulated earnings added to paper balance." />
        </div>

        <div style={{ marginTop: 18, color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>
          © {new Date().getFullYear()} Trading MVP · Demo Build
        </div>
      </div>
    </div>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 16, padding: 16 }}>
      <div style={{ fontWeight: 900, marginBottom: 6 }}>{title}</div>
      <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid #14532d',
  background: '#16a34a',
  color: 'white',
  fontWeight: 900,
  textDecoration: 'none',
};

const secondaryBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '12px 14px',
  borderRadius: 14,
  border: '1px solid #333',
  background: '#0f0f0f',
  color: '#cbd5e1',
  fontWeight: 800,
  textDecoration: 'none',
};