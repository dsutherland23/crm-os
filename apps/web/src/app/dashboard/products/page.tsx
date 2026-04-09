import { Metadata } from 'next';
export const metadata: Metadata = { title: 'Products — CRM OS' };

const products = [
  { name: 'Sample Product A', sku: 'SKU-001', category: 'General', price: '€10.00', variants: 1, status: 'Active' },
  { name: 'Sample Product B', sku: 'SKU-002', category: 'General', price: '€25.00', variants: 3, status: 'Active' },
  { name: 'Sample Product C', sku: 'SKU-003', category: 'General', price: '€5.50', variants: 1, status: 'Active' },
];

export default function ProductsPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Catalog, variants & barcode management</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary">Import</button>
          <button className="btn btn-primary">+ New Product</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Products', value: '3', color: '#4f46e5' },
          { label: 'Active SKUs', value: '3', color: '#059669' },
          { label: 'Categories', value: '1', color: '#d97706' },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 12px', flex: 1, maxWidth: 300 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search products..." className="form-input" style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none' }} />
          </div>
          <select className="form-input" style={{ width: 140 }}>
            <option>All categories</option>
            <option>General</option>
          </select>
          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
            <button className="btn btn-secondary" style={{ padding: '7px 10px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></button>
            <button className="btn btn-secondary" style={{ padding: '7px 10px' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg></button>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Price</th>
              <th>Variants</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.sku}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f3f4f6', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                    </div>
                    <div style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>{p.name}</div>
                  </div>
                </td>
                <td><code style={{ fontSize: 12, background: '#f3f4f6', padding: '3px 7px', borderRadius: 5, fontWeight: 600 }}>{p.sku}</code></td>
                <td><span className="badge badge-blue">{p.category}</span></td>
                <td style={{ fontWeight: 700, color: '#111827' }}>{p.price}</td>
                <td style={{ color: '#6b7280' }}>{p.variants} variant{p.variants > 1 ? 's' : ''}</td>
                <td><span className="badge badge-green">{p.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }}>Edit</button>
                    <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }}>QR</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
