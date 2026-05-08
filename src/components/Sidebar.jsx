export default function Sidebar({ screen, setScreen, activeTer }) {
  const items = [
    ['targets',  'Targets'],
    ['planner',  'Planner'],
    ['visits',   'Visitas'],
    ['settings', 'Settings'],
  ]

  return (
    <nav style={{
      width: 180,
      background: '#070e1c',
      borderRight: '1px solid #1e2d45',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 0',
      flexShrink: 0,
    }}>
      <div style={{ padding: '0 14px 18px', borderBottom: '1px solid #1e2d45', marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#f1f5f9', letterSpacing: 0.5 }}>ROOFPRO</div>
        {activeTer
          ? <div style={{ fontSize: 10, color: '#2563eb', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTer.name}</div>
          : <div style={{ fontSize: 10, color: '#374151', marginTop: 4 }}>Sin territorio activo</div>
        }
      </div>

      {items.map(([id, lbl]) => (
        <button key={id} onClick={() => setScreen(id)} style={{
          display: 'flex',
          alignItems: 'center',
          padding: '11px 16px',
          background: screen === id ? '#0f1d35' : 'transparent',
          color: screen === id ? '#60a5fa' : '#475569',
          border: 'none',
          textAlign: 'left',
          fontSize: 13,
          fontWeight: screen === id ? 700 : 500,
          borderLeft: screen === id ? '3px solid #2563eb' : '3px solid transparent',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}>
          {lbl}
        </button>
      ))}
    </nav>
  )
}
