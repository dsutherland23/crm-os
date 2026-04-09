import { Metadata } from 'next';
export const metadata: Metadata = { title: 'Operations — CRM OS' };

export default function OperationsPage() {
  return (
    <>
      <div className='page-header'>
        <div>
          <h1 className='page-title'>Operations</h1>
          <p className='page-subtitle'>Transfers, returns, cancellations & approvals</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className='btn btn-secondary'>New Transfer</button>
          <button className='btn btn-secondary'>New Return</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Pending Transfers', value: '0', color: '#4f46e5' },
          { label: 'Open Returns', value: '0', color: '#d97706' },
          { label: 'Pending Approvals', value: '0', color: '#dc2626' },
          { label: 'Completed Today', value: '0', color: '#059669' },
        ].map((s) => (
          <div key={s.label} className='card' style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12.5, color: '#9ca3af', marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className='card' style={{ overflow: 'hidden' }}>
        <div style={{ padding: '0 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 0 }}>
          {['Transfers', 'Returns', 'Cancellations', 'Approvals'].map((tab, i) => (
            <button key={tab} className={'tab-btn ' + (i === 0 ? 'active' : '')}>{tab}</button>
          ))}
        </div>
        <div style={{ padding: 60, textAlign: 'center' }}>
          <svg width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='#d1d5db' strokeWidth='1.5' style={{ marginBottom: 16 }}>
            <polyline points='17 1 21 5 17 9' /><path d='M3 11V9a4 4 0 0 1 4-4h14' /><polyline points='7 23 3 19 7 15' /><path d='M21 13v2a4 4 0 0 1-4 4H3' />
          </svg>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#6b7280', margin: '0 0 8px' }}>No transfers pending</p>
          <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>Create a transfer to move stock between locations</p>
          <button className='btn btn-primary' style={{ marginTop: 16 }}>+ New Transfer</button>
        </div>
      </div>
    </>
  );
}
