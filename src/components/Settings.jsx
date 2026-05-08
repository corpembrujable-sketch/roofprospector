import { useState } from 'react'
import { removeDummyTargets } from '../lib/geo.js'
import { lsSet } from '../lib/storage.js'
import { SK } from '../lib/constants.js'

export default function Settings({ settings, setSettings, locs, setLocs, targets, setTargetsAndSave, notify }) {
  const [f, setF] = useState(settings)

  const save = () => { setSettings(f); notify('Settings guardados') }

  const delLoc = id => {
    setLocs(ls => { const n = ls.filter(l => l.id !== id); lsSet(SK.locs, n); return n })
    if (f.defaultLocId === id) setF(x => ({ ...x, defaultLocId: '' }))
    notify('Ubicacion eliminada')
  }

  const cleanDummy = () => {
    const before = targets.length
    const clean  = removeDummyTargets(targets)
    setTargetsAndSave(clean)
    notify(`Limpieza: ${before - clean.length} targets mock eliminados. Quedan ${clean.length} verificados.`)
  }

  const clearAll = () => {
    if (!window.confirm('?Eliminar TODOS los targets? Esta accion no se puede deshacer.')) return
    setTargetsAndSave([])
    notify('Todos los targets eliminados')
  }

  return (
    <div className="fade">
      <div className="h1">Settings</div>

      <div className="grid-2" style={{ maxWidth: 720 }}>
        {/* Planner defaults */}
        <div className="card">
          <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: 12 }}>Planner defaults</div>
          <div style={{ marginBottom: 10 }}><label className="lbl">Max edificios</label><input type="number" className="inp" value={f.defB} min={1} max={20} onChange={e => setF(x => ({ ...x, defB: +e.target.value }))} /></div>
          <div style={{ marginBottom: 10 }}><label className="lbl">Max casas</label><input type="number" className="inp" value={f.defH} min={1} max={50} onChange={e => setF(x => ({ ...x, defH: +e.target.value }))} /></div>
          <div style={{ marginBottom: 10 }}><label className="lbl">Score minimo</label><input type="number" className="inp" value={f.minScore} min={0} max={100} onChange={e => setF(x => ({ ...x, minScore: +e.target.value }))} /></div>
          <div><label className="lbl">Dias reciente</label><input type="number" className="inp" value={f.recentDays} min={1} max={365} onChange={e => setF(x => ({ ...x, recentDays: +e.target.value }))} /></div>
        </div>

        {/* Saved locations */}
        <div className="card">
          <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: 12 }}>Ubicaciones guardadas ({locs.length})</div>
          {locs.map(l => (
            <div key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', background: '#060c18', borderRadius: 8, marginBottom: 6, border: '1px solid #1e2d45' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>
                  {l.label}
                  {f.defaultLocId === l.id && <span className="pill" style={{ background: '#1e3a5f', color: '#60a5fa', marginLeft: 6, fontSize: 8 }}>DEFAULT</span>}
                </div>
                <div style={{ fontSize: 11, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.address}</div>
              </div>
              <button className="btn-ghost btn-sm" onClick={() => setF(x => ({ ...x, defaultLocId: l.id }))}>Def</button>
              <button className="btn-ghost btn-sm" style={{ color: '#f87171' }} onClick={() => delLoc(l.id)}>?</button>
            </div>
          ))}
          {!locs.length && <div style={{ color: '#334155', fontSize: 13 }}>Sin ubicaciones guardadas</div>}
        </div>

        {/* Data management */}
        <div className="card-accent" style={{ gridColumn: '1/-1', border: '1px solid #7f1d1d40' }}>
          <div style={{ fontWeight: 700, color: '#f87171', marginBottom: 10 }}>Gestion de datos</div>
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 14, lineHeight: 1.6 }}>
            <code style={{ background: '#1a2540', padding: '1px 5px', borderRadius: 4, color: '#60a5fa' }}>RemoveDummyTargets()</code> elimina targets con{' '}
            <code style={{ background: '#1a2540', padding: '1px 5px', borderRadius: 4, color: '#60a5fa' }}>address_verified=false</code>,{' '}
            <code style={{ background: '#1a2540', padding: '1px 5px', borderRadius: 4, color: '#60a5fa' }}>created_by_seed=true</code> o{' '}
            <code style={{ background: '#1a2540', padding: '1px 5px', borderRadius: 4, color: '#60a5fa' }}>data_source="mock"</code>.
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn-danger btn-sm" onClick={cleanDummy}>RemoveDummyTargets()</button>
            <button className="btn-danger btn-sm" onClick={clearAll}>Eliminar todos los targets</button>
            <span style={{ fontSize: 12, color: '#334155' }}>
              {targets.length} targets . {targets.filter(t => t.address_verified).length} verificados
            </span>
          </div>
        </div>

        {/* API info */}
        <div className="card-accent" style={{ gridColumn: '1/-1' }}>
          <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: 10 }}>Google Maps API</div>
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>
            La API key vive en <code style={{ background: '#1a2540', padding: '1px 5px', borderRadius: 4, color: '#22d3ee' }}>GOOGLE_MAPS_API_KEY</code> como variable de entorno en Vercel.<br />
            La app nunca expone la key al cliente -- todas las llamadas pasan por <code style={{ background: '#1a2540', padding: '1px 5px', borderRadius: 4, color: '#22d3ee' }}>/api/maps</code> (serverless function).<br />
            APIs necesarias: <strong style={{ color: '#94a3b8' }}>Geocoding API</strong> + <strong style={{ color: '#94a3b8' }}>Places API</strong> + <strong style={{ color: '#94a3b8' }}>Maps JavaScript API</strong> (para autocomplete).
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <button className="btn-primary" onClick={save}>Guardar settings</button>
      </div>
    </div>
  )
}
