import { Metadata } from 'next';
export const metadata: Metadata = { title: 'Dashboard — CRM OS' };

const kpis = [
  { label: "Today's Revenue", value: '€0.00', sub: 'vs €0 yesterday', color: '#4f46e5', bg: '#eef2ff', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { label: 'Active Customers', value: '1', sub: '+1 added today', color: '#059669', bg: '#d1fae5', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
  { label: 'Transactions', value: '0', sub: 'No sales yet today', color: '#2563eb', bg: '#dbeafe', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> },
  { label: 'Stock Items', value: '3', sub: '0 low stock alerts', color: '#d97706', bg: '#fef3c7', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
];

const modules = [
  { name: 'CRM', href: '/dashboard/customers', desc: 'Contacts & deals', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { name: 'POS', href: '/pos', desc: 'Point of sale', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> },
  { name: 'Inventory', href: '/dashboard/inventory', desc: 'Stock & warehouses', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg> },
  { name: 'Finance', href: '/dashboard/finance', desc: 'GL & invoices', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
  { name: 'Products', href: '/dashboard/products', desc: 'Catalog & variants', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
  { name: 'Pricing', href: '/dashboard/pricing', desc: 'Dynamic rules', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg> },
  { name: 'Analytics', href: '/dashboard/analytics', desc: 'AI insights', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { name: 'Operations', href: '/dashboard/operations', desc: 'Transfers & returns', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg> },
  { name: 'Branding', href: '/dashboard/branding', desc: 'Custom themes', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/></svg> },
];

const activity = [
  { dot: 'green', action: 'Customer created', detail: 'Demo Customer added to CRM', time: '2m ago' },
  { dot: 'indigo', action: 'System initialized', detail: '9 modules loaded successfully', time: '5m ago' },
  { dot: 'blue', action: 'Database connected', detail: 'Supabase · bgphwjrr...', time: '6m ago' },
];

export default function DashboardPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Good morning, Admin 👋</h1>
          <p className="page-subtitle">Here's what's happening at Demo Company BV today.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/pos" className="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            Open POS
          </a>
          <button className="btn btn-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {kpis.map((k) => (
          <div key={k.label} className="kpi-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: '#6b7280' }}>{k.label}</span>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.icon}</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', letterSpacing: '-0.5px', lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6, fontWeight: 500 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>Modules</h2>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>9 of 9 active</p>
            </div>
            <span className="badge badge-green">All ON</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {modules.map((m) => (
              <a key={m.name} href={m.href} className="module-tile">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ color: '#6b7280' }}>{m.icon}</div>
                  <span className="badge badge-green" style={{ fontSize: 10, padding: '2px 7px' }}>ON</span>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{m.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="ai-insight-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5' }}>AI Assistant</span>
            </div>
            <p style={{ fontSize: 13, color: '#3730a3', lineHeight: 1.6, margin: '0 0 12px' }}>
              System ready. Add your first product and complete a POS sale to generate business insights.
            </p>
            <a href="/pos" style={{ fontSize: 13, fontWeight: 600, color: '#4f46e5', textDecoration: 'none' }}>Start first sale →</a>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Recent Activity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {activity.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span className="dot dot-green" style={{ marginTop: 5, background: a.dot === 'indigo' ? '#6366f1' : a.dot === 'blue' ? '#2563eb' : '#059669', boxShadow: `0 0 0 2px ${a.dot === 'indigo' ? '#e0e7ff' : a.dot === 'blue' ? '#dbeafe' : '#d1fae5'}`, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#111827' }}>{a.action}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{a.detail}</div>
                  </div>
                  <span style={{ fontSize: 11, color: '#d1d5db', flexShrink: 0 }}>{a.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { label: 'Add Product', href: '/dashboard/products' },
                { label: 'New Customer', href: '/dashboard/customers' },
                { label: 'Create Invoice', href: '/dashboard/finance' },
                { label: 'Check Inventory', href: '/dashboard/inventory' },
                { label: 'Open POS Terminal', href: '/pos' },
              ].map((a) => (
                <a key={a.label} href={a.href} className="qa-link">
                  {a.label}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
