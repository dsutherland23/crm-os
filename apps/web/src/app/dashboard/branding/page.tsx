import { Metadata } from 'next';
export const metadata: Metadata = { title: 'Branding — CRM OS' };

export default function BrandingPage() {
  return (
    <>
      <div className='page-header'>
        <div>
          <h1 className='page-title'>Branding & Customization</h1>
          <p className='page-subtitle'>Logo, themes, invoices & receipts</p>
        </div>
        <button className='btn btn-primary'>Save Changes</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className='card' style={{ padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Company Logo</h3>
            <div style={{ width: 100, height: 100, borderRadius: 16, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, fontWeight: 800, color: 'white', marginBottom: 12 }}>D</div>
            <button className='btn btn-secondary'>Upload New Logo</button>
          </div>
          <div className='card' style={{ padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Brand Colors</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              {['#4f46e5', '#059669', '#d97706', '#dc2626'].map((c) => (
                <div key={c} style={{ width: 40, height: 40, borderRadius: 8, background: c, cursor: 'pointer', border: '2px solid white', boxShadow: '0 0 0 1px #e5e7eb' }} />
              ))}
            </div>
          </div>
          <div className='card' style={{ padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Invoice Template</h3>
            <select className='form-input'>
              <option>Modern Professional</option>
              <option>Classic</option>
              <option>Minimal</option>
            </select>
          </div>
        </div>
        <div className='card' style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>Live Preview</h3>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, background: '#fafafa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'white' }}>D</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Demo Company BV</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Amsterdam, Netherlands</div>
              </div>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '16px 0' }} />
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              <p style={{ margin: '0 0 8px' }}><strong>Invoice #INV-0001</strong></p>
              <p style={{ margin: 0 }}>Total: <strong>€0.00</strong></p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
