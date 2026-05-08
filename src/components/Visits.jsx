// components/Visits.jsx
const OC = { no_answer:'#64748b', spoke_admin:'#2563eb', estimate_requested:'#f59e0b', closed:'#10b981', not_interested:'#ef4444', visited_route:'#22d3ee' }
const OL = { no_answer:'Sin respuesta', spoke_admin:'Hablo con admin', estimate_requested:'Cotizacion', closed:'Cerrado', not_interested:'No interesado', visited_route:'Visitado en ruta' }

export function Visits({ visits, targets, goDetail }) {
  const sorted = [...visits].sort((a, b) => new Date(b.dt) - new Date(a.dt))

  return (
    <div className="fade">
      <div className="h1">Visitas ({visits.length})</div>

      {!visits.length && (
        <div className="card" style={{ color: '#334155', textAlign: 'center', padding: 40 }}>Sin visitas registradas aun</div>
      )}

      {sorted.map(v => {
        const t = targets.find(x => x.id === v.tid)
        const c = OC[v.outcome] || '#64748b'
        return (
          <div key={v.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: c, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 7, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0' }}>{t?.name || v.tid}</span>
                <span className="pill" style={{ background: `${c}22`, color: c }}>{OL[v.outcome] || v.outcome}</span>
              </div>
              {v.notes    && <div style={{ fontSize: 12, color: '#475569' }}>{v.notes}</div>}
              {v.followUp && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>Follow-up: {v.followUp}</div>}
            </div>
            <div style={{ fontSize: 11, color: '#1e2d45', flexShrink: 0 }}>{new Date(v.dt).toLocaleString()}</div>
            {t && <button className="btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => goDetail(t)}>Ver</button>}
          </div>
        )
      })}
    </div>
  )
}

export default Visits
