import { Metadata } from 'next';
export const metadata: Metadata = { title: 'Customers — CRM OS' };

const customers = [
  { name: 'Demo Customer', email: 'demo@company.com', phone: '+31 6 0000 0000', clv: '€0.00', points: 0, status: 'Active', initials: 'DC', color: '#6366f1' },
];

export default function CustomersPage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Manage contacts, loyalty & purchase history</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary">Import CSV</button>
          <button className="btn btn-primary">+ Add Customer</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Customers', value: '1', bg: '#eef2ff', color: '#4f46e5' },
          { label: 'Avg. CLV', value: '€0.00', bg: '#d1fae5', color: '#059669' },
          { label: 'Loyalty Members', value: '0', bg: '#fef3c7', color: '#d97706' },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
            <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 12px', flex: 1, maxWidth: 320 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Search customers..." className="form-input" style={{ border: 'none', background: 'transparent', padding: 0, boxShadow: 'none' }} />
          </div>
          <select className="form-input" style={{ width: 120 }}>
            <option>All status</option>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th>Loyalty Points</th>
              <th>CLV</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.email}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar" style={{ background: `linear-gradient(135deg,${c.color},${c.color}99)`, width: 36, height: 36, fontSize: 13 }}>{c.initials}</div>
                    <div style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>{c.name}</div>
                  </div>
                </td>
                <td>
                  <div style={{ fontSize: 13.5, color: '#374151' }}>{c.email}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{c.phone}</div>
                </td>
                <td><span style={{ fontSize: 13.5, fontWeight: 500, color: '#374151' }}>{c.points} pts</span></td>
                <td><span style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>{c.clv}</span></td>
                <td><span className="badge badge-green">{c.status}</span></td>
                <td><button className="btn btn-secondary" style={{ padding: '5px 12px', fontSize: 12 }}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>Showing 1–1 of 1 customers</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} disabled>← Prev</button>
            <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} disabled>Next →</button>
          </div>
        </div>
      </div>
    </>
  );
}
