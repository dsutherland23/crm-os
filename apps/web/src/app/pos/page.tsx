import { Metadata } from 'next';
export const metadata: Metadata = { title: 'POS — CRM OS' };

const products = [
  { name: 'Sample Product A', sku: 'SKU-001', price: 10.00 },
  { name: 'Sample Product B', sku: 'SKU-002', price: 25.00 },
  { name: 'Sample Product C', sku: 'SKU-003', price: 5.50 },
];

export default function POSPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f3f4f6', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, WebkitFontSmoothing: 'antialiased' }}>
      {/* Left — product grid */}
      <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>Point of Sale</h1>
            <p style={{ fontSize: 12.5, color: '#9ca3af', margin: '3px 0 0' }}>Demo Company BV · Main Store</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: '#d1fae5', border: '1px solid #a7f3d0' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#059669' }}>Offline-ready</span>
            </div>
            <a href="/dashboard" style={{ padding: '7px 14px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, textDecoration: 'none', color: '#374151', fontSize: 13, fontWeight: 500 }}>← Back</a>
          </div>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1px solid #e5e7eb', borderRadius: 9, padding: '9px 14px', flex: 1, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search products or scan barcode..." style={{ border: 'none', outline: 'none', fontSize: 14, color: '#374151', width: '100%', background: 'transparent' }} />
            <kbd style={{ fontSize: 10.5, color: '#9ca3af', background: '#f3f4f6', border: '1px solid #e5e7eb', padding: '2px 6px', borderRadius: 4 }}>⌘F</kbd>
          </div>
          <button style={{ padding: '9px 14px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', fontWeight: 500 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="4" height="4"/><rect x="14" y="10" width="4" height="4"/><rect x="3" y="14" width="7" height="7"/></svg>
            Scan QR
          </button>
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {['All', 'General', 'Beverages', 'Food'].map((cat, i) => (
            <button key={cat} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              background: i === 0 ? '#4f46e5' : 'white',
              color: i === 0 ? 'white' : '#6b7280',
              boxShadow: i === 0 ? '0 2px 8px rgba(79,70,229,0.25)' : '0 1px 3px rgba(0,0,0,0.06)',
            }}>{cat}</button>
          ))}
        </div>

        {/* Product grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {products.map((p) => (
            <button key={p.sku} className="product-btn">
              <div style={{ width: '100%', paddingBottom: '75%', background: '#f9fafb', borderRadius: 8, border: '1px solid #f3f4f6', position: 'relative', marginBottom: 10 }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4, lineHeight: 1.3 }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: '#9ca3af', marginBottom: 8 }}>{p.sku}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#4f46e5' }}>€{p.price.toFixed(2)}</div>
            </button>
          ))}

          {/* Add placeholder */}
          <button style={{
            background: 'transparent', border: '2px dashed #e5e7eb', borderRadius: 12, padding: 16,
            cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 160, color: '#9ca3af',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>Add Product</span>
          </button>
        </div>
      </div>

      {/* Right — cart */}
      <div style={{
        width: 340, background: 'white', borderLeft: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column', minHeight: '100vh',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.04)',
      }}>
        {/* Cart header */}
        <div style={{ padding: '20px 20px 14px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0 }}>Current Order</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ padding: '5px 10px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Hold</button>
              <button style={{ padding: '5px 10px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 7, cursor: 'pointer', fontSize: 12, color: '#dc2626', fontWeight: 500 }}>Clear</button>
            </div>
          </div>
          {/* Customer */}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span style={{ fontSize: 12.5, color: '#9ca3af' }}>Assign customer (optional)</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" style={{ marginLeft: 'auto' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </div>
        </div>

        {/* Empty cart */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, color: '#9ca3af' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ marginBottom: 12 }}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <p style={{ fontSize: 13.5, fontWeight: 500, color: '#6b7280', margin: '0 0 4px' }}>Cart is empty</p>
          <p style={{ fontSize: 12, margin: 0 }}>Tap a product to add it</p>
        </div>

        {/* Totals */}
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Subtotal</span>
            <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>€0.00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>Discount</span>
            <span style={{ fontSize: 13, color: '#059669', fontWeight: 500 }}>—</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#6b7280' }}>GCT (15%)</span>
            <span style={{ fontSize: 13, color: '#374151' }}>€0.00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', borderTop: '1px solid #f3f4f6', marginTop: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Total</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>€0.00</span>
          </div>
        </div>

        {/* Payment */}
        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
            {['Cash', 'Card', 'Split'].map((m, i) => (
              <button key={m} style={{
                padding: '9px 0', borderRadius: 8, border: '1px solid', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
                background: i === 1 ? '#eef2ff' : 'white',
                borderColor: i === 1 ? '#c7d2fe' : '#e5e7eb',
                color: i === 1 ? '#4f46e5' : '#6b7280',
              }}>{m}</button>
            ))}
          </div>
          <button style={{
            width: '100%', padding: '14px 0', background: '#4f46e5', color: 'white',
            border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(79,70,229,0.3)', transition: 'all 0.15s',
          }}>
            Charge €0.00
          </button>
          <button style={{
            width: '100%', marginTop: 8, padding: '10px 0', background: 'transparent',
            color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, cursor: 'pointer',
          }}>
            Apply Discount
          </button>
        </div>
      </div>
    </div>
  );
}
