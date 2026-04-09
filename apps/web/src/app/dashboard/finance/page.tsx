import { Metadata } from 'next';
export const metadata: Metadata = { title: 'Finance — CRM OS' };

const invoices = [
  { number: 'INV-0001', customer: 'Demo Customer', amount: '€0.00', status: 'Draft', due: '—', issued: 'Today' },
];

export default function FinancePage() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance</h1>
          <p className="page-subtitle">Double-entry ledger · Invoices · P&L</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary">Export Report</button>
          <button className="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Invoice
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Revenue MTD', value: '€0.00', sub: 'Month to date', color: '#4f46e5', bg: '#eef2ff' },
          { label: 'Outstanding', value: '€0.00', sub: '0 invoices unpaid', color: '#d97706', bg: '#fef3c7' },
          { label: 'Expenses MTD', value: '€0.00', sub: 'Month to date', color: '#dc2626', bg: '#fee2e2' },
          { label: 'Net Profit', value: '€0.00', sub: 'P&L this month', color: '#059669', bg: '#d1fae5' },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: '#6b7280' }}>{k.label}</span>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: k.color }}></div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#111827', letterSpacing: '-0.5px' }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 5 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs + table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '0 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 0 }}>
          {['Invoices', 'Payments', 'Ledger', 'Reports'].map((tab, i) => (
            <button key={tab} style={{
              padding: '14px 16px', fontSize: 13.5, fontWeight: 500, border: 'none', cursor: 'pointer', background: 'none',
              color: i === 0 ? '#4f46e5' : '#6b7280',
              borderBottom: i === 0 ? '2px solid #4f46e5' : '2px solid transparent',
              transition: 'all 0.15s',
            }}>{tab}</button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 0 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, padding: '6px 12px' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input placeholder="Search invoices..." style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: 160 }} />
            </div>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Issued</th>
              <th>Due</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.number}>
                <td><span style={{ fontWeight: 600, color: '#4f46e5', fontFamily: 'monospace', fontSize: 13 }}>{inv.number}</span></td>
                <td style={{ color: '#374151' }}>{inv.customer}</td>
                <td style={{ fontWeight: 600, color: '#111827' }}>{inv.amount}</td>
                <td><span className="badge badge-gray">{inv.status}</span></td>
                <td style={{ color: '#6b7280' }}>{inv.issued}</td>
                <td style={{ color: '#9ca3af' }}>{inv.due}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }}>View</button>
                    <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }}>Send</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12.5, color: '#9ca3af' }}>Showing 1–1 of 1 invoices</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} disabled>← Prev</button>
            <button className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: 12 }} disabled>Next →</button>
          </div>
        </div>
      </div>
    </>
  );
}
