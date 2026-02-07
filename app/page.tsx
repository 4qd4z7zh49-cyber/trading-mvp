import Link from 'next/link';

export default function HomePage() {
  return (
    <div style={{ background: '#0b0e11', minHeight: '100vh', padding: '28px', color: 'white' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div
          style={{
            background: '#111',
            border: '1px solid #222',
            borderRadius: 16,
            padding: 24,
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 10 }}>
            Trading MVP · Demo Platform
          </div>

          <h1 style={{ fontSize: 34, margin: 0, lineHeight: 1.15 }}>
            Practice Trading with Live Market Charts
          </h1>

          <p style={{ color: '#cbd5e1', fontSize: 16, marginTop: 12, maxWidth: 760 }}>
            A <b>paper trading</b> platform to explore Crypto, Gold, Silver, Coffee,
            and top US stocks — <b>no real money required</b>.
          </p>

          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
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
            <b style={{ color: 'white' }}>Disclaimer:</b> This is a demo application.
            All trades are simulated. No real funds involved.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 14 }}>
          <Feature title="Live Markets" desc="Real-time charts via TradingView widgets." />
          <Feature title="Paper Trading" desc="Buy & sell simulation with balance and PnL." />
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
      <div style={{ color: '#94a3b8', fontSize: 12 }}>{desc}</div>
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