import { Metadata } from 'next';
export const metadata: Metadata = { title: 'Analytics — CRM OS' };

const metrics = [
  { label: 'Total Revenue', value: '€0.00', change: '—', period: 'This month', color: '#4f46e5' },
  { label: 'Orders', value: '0', change: '—', period: 'This month', color: '#059669' },
  { label: 'Avg. Order Value', value: '€0.00', change: '—', period: 'This month', color: '#2563eb' },
  { label: 'New Customers', value: '1', change: '+1', period: 'This month', color: '#d97706' },
];

const topProducts = [
  { rank: 1, name: 'Sample Product B', revenue: '€0.00', units: 0 },
  { rank: 2, name: 'Sample Product A', revenue: '€0.00', units: 0 },
  { rank: 3, name: 'Sample Product C', revenue: '€0.00', units: 0 },
];

export default function AnalyticsPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">AI-powered business intelligence & trends</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="form-input" style={{ width: 140 }}>
            <option>Last 30 days</option>
            <option>Last 7 days</option>
            <option>This month</option>
            <option>This year</option>
          </select>
          <button className="btn btn-secondary">Export</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {metrics.map((m) => (
          <div key={m.label} className="kpi-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: '#6b7280' }}>{m.label}</span>
              <span className="badge" style={{ fontSize: 10, padding: '2px 7px', background: m.change.startsWith('+') ? '#d1fae5' : '#f3f4f6', color: m.change.startsWith('+') ? '#059669' : '#9ca3af' }}>{m.change}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>{m.value}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 5 }}>{m.period}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Revenue Over Time</h2>
            <div style={{ display: 'flex', gap: 4 }}>
              {['Day', 'Week', 'Month'].map((t, i) => (
                <button key={t} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: i === 2 ? '#eef2ff' : 'white', borderColor: i === 2 ? '#c7d2fe' : '#e5e7eb', color: i === 2 ? '#4f46e5' : '#6b7280' }}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ height: 220, background: '#f9fafb', borderRadius: 10, border: '1px dashed #e5e7eb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <p style={{ fontSize: 14, color: '#6b7280', fontWeight: 600, margin: 0 }}>No sales data yet</p>
            <p style={{ fontSize: 12.5, color: '#9ca3af', margin: 0 }}>Complete a POS transaction to see trends</p>
            <a href="/pos" className="btn btn-primary" style={{ marginTop: 8, fontSize: 12.5, padding: '8px 16px' }}>Open POS →</a>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="ai-insight-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#4f46e5' }}>AI Insights</span>
            </div>
            {['Start with POS to generate your first revenue datapoint.', 'Add more products to increase average basket size.', 'Enable loyalty tracking to boost customer retention.'].map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < 2 ? 10 : 0, alignItems: 'flex-start' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#c7d2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#4f46e5', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                <p style={{ fontSize: 13, color: '#3730a3', margin: 0, lineHeight: 1.5 }}>{tip}</p>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 14px' }}>Top Products</h3>
            {topProducts.map((p) => (
              <div key={p.rank} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 26, height: 26, borderRadius: 6, background: p.rank === 1 ? '#fef3c7' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: p.rank === 1 ? '#d97706' : '#9ca3af', flexShrink: 0 }}>#{p.rank}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#111827' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{p.units} units sold</div>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>{p.revenue}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
