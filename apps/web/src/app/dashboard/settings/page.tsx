import { Metadata } from 'next';
export const metadata: Metadata = { title: 'Settings — CRM OS' };

const modules = [
  { name: 'CRM', desc: 'Customer management', enabled: true },
  { name: 'POS', desc: 'Point of sale terminal', enabled: true },
  { name: 'Inventory', desc: 'Stock & warehouse tracking', enabled: true },
  { name: 'Finance', desc: 'Accounting & invoices', enabled: true },
  { name: 'Products', desc: 'Product catalog', enabled: true },
  { name: 'Pricing', desc: 'Dynamic pricing engine', enabled: true },
  { name: 'Analytics', desc: 'AI business intelligence', enabled: true },
  { name: 'Operations', desc: 'Transfers & returns', enabled: true },
  { name: 'Branding', desc: 'Custom themes & receipts', enabled: true },
];

export default function SettingsPage() {
  return (
    <>
      <div className='page-header'>
        <div>
          <h1 className='page-title'>Settings</h1>
          <p className='page-subtitle'>Workspace configuration & preferences</p>
        </div>
        <button className='btn btn-primary'>Save Changes</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24, alignItems: 'start' }}>
        <div className='card' style={{ padding: 8, position: 'sticky', top: 80 }}>
          {['Company', 'Modules', 'Users & Roles', 'Billing', 'Security', 'Integrations', 'Audit Log'].map((item, i) => (
            <a key={item} href='#' style={{ display: 'block', padding: '10px 12px', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 500, marginBottom: 2, color: i === 0 ? '#4f46e5' : '#6b7280', background: i === 0 ? '#eef2ff' : 'transparent' }}>{item}</a>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className='card' style={{ padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Company Profile</h2>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px' }}>Business name, logo, address and tax settings</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {['Company Name', 'Email', 'Phone', 'Tax ID / KVK', 'GCT Rate (%)'].map((f) => (
                <div key={f}>
                  <label className='form-label'>{f}</label>
                  <input type='text' className='form-input' />
                </div>
              ))}
            </div>
          </div>
          <div className='card' style={{ padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Modules</h2>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}>Toggle features on or off per workspace</p>
            <div>
              {modules.map((m, i) => (
                <div key={m.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: i < modules.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 1 }}>{m.desc}</div>
                  </div>
                  <div className={'toggle-switch ' + (m.enabled ? 'on' : '')}></div>
                </div>
              ))}
            </div>
          </div>
          <div className='danger-zone'\u003e
            \u003ch2 style={{ fontSize: 16, fontWeight: 700, color: '#dc2626', margin: '0 0 4px' }}\u003eDanger Zone\u003c/h2\u003e
            \u003cp style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 16px' }}\u003eIrreversible actions for this workspace\u003c/p\u003e
            \u003cdiv style={{ display: 'flex', gap: 10 }}\u003e
              \u003cbutton className='btn btn-secondary' style={{ color: '#dc2626', borderColor: '#fecaca' }}\u003eExport All Data\u003c/button\u003e
              \u003cbutton style={{ padding: '8px 16px', border: '1px solid #fecaca', borderRadius: 8, background: '#fee2e2', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}\u003eDelete Workspace\u003c/button\u003e
            \u003c/div\u003e
          \u003c/div\u003e
        \u003c/div\u003e
      \u003c/div\u003e
    \u003c/\u003e
  );
}
