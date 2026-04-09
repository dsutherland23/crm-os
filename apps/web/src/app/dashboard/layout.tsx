import { Suspense } from 'react';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
      )},
    ],
  },
  {
    label: 'Business',
    items: [
      { label: 'Customers', href: '/dashboard/customers', icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      )},
      { label: 'Products', href: '/dashboard/products', icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
      )},
      { label: 'Inventory', href: '/dashboard/inventory', icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
      )},
      { label: 'Finance', href: '/dashboard/finance', icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      )},
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'POS', href: '/pos', icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
      )},
      { label: 'Pricing', href: '/dashboard/pricing', icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
      )},
      { label: 'Operations', href: '/dashboard/operations', icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
      )},
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Analytics', href: '/dashboard/analytics', icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      )},
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Branding', href: '/dashboard/branding', icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/></svg>
      )},
      { label: 'Settings', href: '/dashboard/settings', icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
      )},
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">C</div>
          <div>
            <div className="logo-text">CRM OS</div>
            <div className="logo-sub">Modular Platform</div>
          </div>
        </div>

        <div className="workspace-pill">
          <div className="avatar" style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', width: 28, height: 28, fontSize: 11 }}>D</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Demo Company BV</div>
            <div style={{ fontSize: 11, color: '#4b5563' }}>Free Plan</div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>

        <nav style={{ flex: 1, padding: '4px 12px', overflowY: 'auto' }}>
          {navGroups.map((group) => (
            <div key={group.label} className="sidebar-section">
              <div className="sidebar-label">{group.label}</div>
              {group.items.map((item) => (
                <a key={item.href} href={item.href} className="nav-item">
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </a>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status-pill">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span className="dot dot-green"></span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#a5b4fc' }}>All systems live</span>
            </div>
            <div style={{ fontSize: 11, color: '#4b5563' }}>9 modules active</div>
          </div>
          <div className="workspace-pill" style={{ margin: 0 }}>
            <div className="avatar" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', width: 32, height: 32, fontSize: 12 }}>A</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>Admin User</div>
              <div style={{ fontSize: 11, color: '#4b5563' }}>Super Admin</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="search-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span style={{ fontSize: 14, color: '#9ca3af', flex: 1 }}>Search anything...</span>
            <kbd style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', border: '1px solid #e5e7eb', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>⌘K</kbd>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: '#d1fae5', border: '1px solid #a7f3d0' }}>
              <span className="dot dot-green" style={{ width: 7, height: 7 }}></span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#059669' }}>Live</span>
            </div>
            <button style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </button>
            <div className="avatar" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', cursor: 'pointer' }}>A</div>
          </div>
        </header>

        <main className="page-content">
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#9ca3af', gap: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Loading...
            </div>
          }>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
