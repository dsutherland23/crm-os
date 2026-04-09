import { Metadata } from 'next';
export const metadata: Metadata = { title: 'Pricing — CRM OS' };

const rules = [
  { name: 'Wholesale Default', type: 'Wholesale', applies: 'All products', discount: '20%', status: 'Active' },
  { name: 'Retail Standard', type: 'Retail', applies: 'All products', discount: '0%', status: 'Active' },
  { name: 'Summer Promo 2025', type: 'Promo', applies: 'Category: General', discount: '15%', status: 'Scheduled' },
];

export default function PricingPage() {
  return (
    <>
      <div className='page-header'>
        <div>
          <h1 className='page-title'>Pricing Engine</h1>
          <p className='page-subtitle'>Dynamic pricing rules, tiers & promotions</p>
        </div>
        <button className='btn btn-primary'>+ New Rule</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Active Rules', value: '3', color: '#4f46e5' },
          { label: 'Price Tiers', value: '2', color: '#059669' },
        ].map((s) => (
          <div key={s.label} className='card' style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className='card' style={{ overflow: 'hidden' }}>
        <table className='data-table'>
          <thead>
            <tr>
              <th>Rule Name</th>
              <th>Type</th>
              <th>Applies To</th>
              <th>Discount</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.name}>
                <td style={{ fontWeight: 700, color: '#111827' }}>{r.name}</td>
                <td><span className={'badge ' + (r.type === 'Wholesale' ? 'badge-blue' : r.type === 'Promo' ? 'badge-amber' : 'badge-gray')}>{r.type}</span></td>
                <td style={{ color: '#6b7280' }}>{r.applies}</td>
                <td style={{ fontWeight: 700, color: '#111827' }}>{r.discount}</td>
                <td><span className={'badge ' + (r.status === 'Active' ? 'badge-green' : 'badge-amber')}>{r.status}</span></td>
                <td><button className='btn btn-secondary' style={{ padding: '5px 10px', fontSize: 12 }}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
