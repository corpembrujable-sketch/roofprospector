import { useState } from 'react'
import { scoreColor, scoreLabel, STATUS_LABEL } from '../lib/constants.js'

const SIG_NAMES = {
  review_leak:  'Gotera reportada',
  permit_roof:  'Permiso de techo',
  age_old:      'Antiguedad',
  tree_risk:    'Riesgo de arboles',
  manual_note:  'Nota manual',
}

export default function Detail({ target, updTgt, visits, setVisits, back, notify }) {
  const [tree,   setTree]   = useState(target.tree || 0)
  const [showV,  setShowV]  = useState(false)
  const [vf,     setVf]     = useState({ outcome: 'no_answer', notes: '', followUp: '' })

  const tvs = visits.filter(v => v.tid === target.id)

  const saveTree = () => {
    const sigs2 = target.sigs.filter(s => s.signal_type !== 'tree_risk')
    if (tree > 0) sigs2.push({
      id: 'tr' + Date.now(),
      signal_type: 'tree_risk',
      severity: tree > 20 ? 4 : 3,
      confidence: 0.8,
      evidence_short: `Tree risk: ${tree}/25`,
      signal_date: new Date().toISOString().split('T')[0],
      source: 'manual',
    })
    const age  = target.yr ? (2025 - target.yr) : null
    const ageS = age == null ? 10 : age <= 15 ? 5 : age <= 25 ? 15 : age <= 35 ? 25 : age <= 50 ? 35 : 45
    updTgt(target.id, { tree, score: Math.min(100, ageS + tree), sigs: sigs2 })
    notify('Tree risk actualizado')
  }

  const recVisit = () => {
    setVisits(vs => [...vs, {
      id:  'v' + Date.now(),
      tid: target.id,
      dt:  new Date().toISOString(),
      ...vf,
    }])
    updTgt(target.id, { status: 'visited', lastVisit: new Date().toISOString() })
    setShowV(false)
    notify('Visita registrada')
  }

  const Row = ({ label, value }) => (
    <div>
      <div className="lbl" style={{ marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || '--'}</div>
    </div>
  )

  return (
    <div className="fade">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button className="btn-ghost btn-sm" onClick={back}>← Volver</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 19, color: '#f1f5f9' }}>{target.name}</div>
          <div style={{ fontSize: 12, color: '#475569' }}>{target.formatted_address}</div>
          {target.place_id && (
            <div style={{ fontSize: 10, color: '#334155', marginTop: 2, fontFamily: 'monospace' }}>
              place_id: {target.place_id}
            </div>
          )}
        </div>
        <div className="score-ring" style={{ width: 52, height: 52, fontSize: 18, background: `${scoreColor(target.score)}22`, color: scoreColor(target.score), border: `3px solid ${scoreColor(target.score)}` }}>
          {target.score}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Left column */}
        <div>
          {/* Meta */}
          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              <Row label="Tipo"         value={target.type === 'building' ? 'Edificio' : 'Casa'} />
              <Row label="Subtipo"      value={target.subtype} />
              <Row label="Ano"          value={target.yr} />
              <Row label="ZIP"          value={target.zip} />
              <Row label="Ciudad"       value={target.city} />
              <Row label="Estado"       value={STATUS_LABEL[target.status]} />
              <Row label="Verificada"   value={target.address_verified ? 'Si' : 'No'} />
              <Row label="Fuente"       value={target.data_source} />
              <Row label="Ultima visita" value={target.lastVisit ? new Date(target.lastVisit).toLocaleDateString() : 'Nunca'} />
            </div>
          </div>

          {/* Signals */}
          {target.sigs.length > 0 && (
            <div className="card">
              <div className="lbl" style={{ marginBottom: 10 }}>Senales ({target.sigs.length})</div>
              {target.sigs.map(s => (
                <div key={s.id} style={{ display: 'flex', gap: 10, padding: 10, background: '#060c18', borderRadius: 8, marginBottom: 7, border: '1px solid #1e2d45' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 6, background: '#1a2540', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 9, color: '#64748b', flexShrink: 0 }}>
                    {s.signal_type.substring(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: '#e2e8f0' }}>{SIG_NAMES[s.signal_type] || s.signal_type}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <span className="pill" style={{ background: '#ef444420', color: '#f87171', fontSize: 9 }}>Sev {s.severity}/5</span>
                        <span className="pill" style={{ background: '#10b98120', color: '#34d399', fontSize: 9 }}>Conf {Math.round(s.confidence * 100)}%</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{s.evidence_short}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Visit history */}
          {tvs.length > 0 && (
            <div className="card">
              <div className="lbl" style={{ marginBottom: 8 }}>Historial de visitas ({tvs.length})</div>
              {tvs.map(v => (
                <div key={v.id} style={{ background: '#0a1628', borderRadius: 8, padding: 10, marginBottom: 6, border: '1px solid #1e2d45' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 12, color: '#e2e8f0' }}>
                      {(v.outcome || '').replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span style={{ fontSize: 11, color: '#334155' }}>{new Date(v.dt).toLocaleString()}</span>
                  </div>
                  {v.notes    && <div style={{ fontSize: 12, color: '#64748b' }}>{v.notes}</div>}
                  {v.followUp && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 3 }}>Follow-up: {v.followUp}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div>
          {/* Actions */}
          <div className="card">
            <div className="lbl" style={{ marginBottom: 10 }}>Acciones</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn-primary" onClick={() => setShowV(true)}>Registrar visita</button>
              <button className="btn-ghost"   onClick={() => updTgt(target.id, { status: 'queued' })}>Agregar a cola</button>
              <button className="btn-danger"  onClick={() => updTgt(target.id, { status: 'do_not_visit', dnvReason: 'no_soliciting' })}>No solicitar</button>
              <button className="btn-danger"  onClick={() => updTgt(target.id, { status: 'do_not_visit', dnvReason: 'asked_to_leave' })}>Pidieron retirarse</button>
            </div>
          </div>

          {/* Tree risk (houses only) */}
          {target.type === 'house' && (
            <div className="card">
              <div className="lbl" style={{ marginBottom: 8 }}>Tree Risk</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                <span style={{ color: '#475569' }}>Densidad</span>
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>{tree}/25</span>
              </div>
              <input type="range" min={0} max={25} value={tree} onChange={e => setTree(+e.target.value)}
                style={{ width: '100%', accentColor: '#f59e0b', marginBottom: 10 }} />
              <button className="btn-ghost btn-sm" style={{ width: '100%' }} onClick={saveTree}>Guardar</button>
            </div>
          )}

          {/* Score card */}
          <div className="card" style={{ background: '#060c18', textAlign: 'center' }}>
            <div style={{ fontSize: 48, fontWeight: 700, color: scoreColor(target.score) }}>{target.score}</div>
            <div style={{ fontSize: 11, color: '#334155' }}>de 100</div>
            <span className="pill" style={{ background: `${scoreColor(target.score)}22`, color: scoreColor(target.score), marginTop: 6 }}>
              {scoreLabel(target.score)} RIESGO
            </span>
            <div style={{ background: '#1a2540', borderRadius: 8, height: 6, marginTop: 12 }}>
              <div style={{ height: '100%', width: target.score + '%', background: scoreColor(target.score), borderRadius: 8, transition: 'width .3s' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Visit modal */}
      {showV && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div className="card" style={{ width: 420, background: '#0f1929', border: '1px solid #1e3a5f' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9', marginBottom: 14 }}>Registrar Visita</div>
            <div style={{ marginBottom: 10 }}>
              <label className="lbl">Resultado</label>
              <select className="inp" value={vf.outcome} onChange={e => setVf(f => ({ ...f, outcome: e.target.value }))}>
                <option value="no_answer">Sin respuesta</option>
                <option value="spoke_admin">Hablo con admin</option>
                <option value="estimate_requested">Cotizacion solicitada</option>
                <option value="closed">Cerrado</option>
                <option value="not_interested">No interesado</option>
              </select>
            </div>
            <div style={{ marginBottom: 10 }}>
              <label className="lbl">Notas</label>
              <textarea className="inp" style={{ resize: 'vertical' }} rows={3} value={vf.notes} onChange={e => setVf(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="lbl">Follow-up</label>
              <input type="date" className="inp" value={vf.followUp} onChange={e => setVf(f => ({ ...f, followUp: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary" onClick={recVisit}>Guardar</button>
              <button className="btn-ghost"   onClick={() => setShowV(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
