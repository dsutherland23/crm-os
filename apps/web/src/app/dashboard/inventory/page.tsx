import { Metadata } from 'next';
export const metadata: Metadata = { title: 'Inventory — CRM OS' };

const items = [
  { product: 'Sample Product A', sku: 'SKU-001', location: 'Main Store', inStock: 50, reserved: 0, reorderAt: 10, status: 'OK' },
  { product: 'Sample Product B', sku: 'SKU-002', location: 'Main Store', inStock: 8, reserved: 2, reorderAt: 10, status: 'Low' },
  { product: 'Sample Product C', sku: 'SKU-003', location: 'Warehouse', inStock: 200, reserved: 0, reorderAt: 20, status: 'OK' },
];

export default function InventoryPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Real-time stock across all locations</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary">Adjust Stock</button>
          <button className="btn btn-secondary">Transfer</button>
          <button className="btn btn-primary">+ Add Product</button>
        </div>
      </div>

      <div className="alert-banner">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: '#92400e' }}>1 item below reorder point — SKU-002 needs restocking</span>
        <button style={{ marginLeft: 'auto', fontSize: 12, color: '#d97706', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>View →</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total SKUs', value: '3', color: '#4f46e5' },
          { label: 'In Stock', value: '258', color: '#059669' },
          { label: 'Reserved', value: '2', color: '#2563eb' },
          { label: 'Low Stock', value: '1', color: '#dc2626' },
        ].map((k) => (
          <div key={k.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 12px', flex: 1, maxWidth: 300 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search products..." className="form-input" style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none' }} />
          </div>
          <select className="form-input" style={{ width: 140 }}>
            <option>All locations</option>
            <option>Main Store</option>
            <option>Warehouse</option>
          </select>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Location</th>
              <th>In Stock</th>
              <th>Reserved</th>
              <th>Reorder At</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.sku}>
                <td style={{ fontWeight: 700, color: '#111827' }}>{item.product}</td>
                <td><code style={{ fontSize: 12, background: '#f3f4f6', padding: '3px 7px', borderRadius: 5, fontWeight: 600 }}>{item.sku}</code></td>
                <td style={{ color: '#6b7280' }}>{item.location}</td>
                <td style={{ fontWeight: 700, color: item.inStock <= item.reorderAt ? '#dc2626' : '#111827' }}>{item.inStock}</td>
                <td style={{ color: '#6b7280' }}>{item.reserved}</td>
                <td style={{ color: '#9ca3af' }}>{item.reorderAt}</td>
                <td><span className={`badge ${item.status === 'Low' ? 'badge-red' : 'badge-green'}`}>{item.status === 'Low' ? '⚠ Low Stock' : '✓ OK'}</span></td>
                <td><button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }}>Adjust</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
