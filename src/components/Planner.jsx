import { useState, useMemo } from 'react'
import { optimizeRoute, buildGMapsUrl } from '../lib/routing.js'
import { scoreColor } from '../lib/constants.js'
import { lsSet } from '../lib/storage.js'
import { SK } from '../lib/constants.js'

export default function Planner({ targets, territories, activeTer, setActiveTer, settings, setSettings, locs, setLocs, updTgt, visits, setVisits, goDetail, notify }) {
  const [terSel,     setTerSel]    = useState(activeTer?.id || '')
  const [startMode,  setStartMode] = useState('saved')
  const [locId,      setLocId]     = useState(settings.defaultLocId || locs[0]?.id || '')
  const [gpsData,    setGpsData]   = useState(null)
  const [gpsLoad,    setGpsLoad]   = useState(false)
  const [manLat,     setManLat]    = useState('35.78')
  const [manLng,     setManLng]    = useState('-78.64')
  const [manAddr,    setManAddr]   = useState('')
  const [maxB,       setMaxB]      = useState(settings.defB)
  const [maxH,       setMaxH]      = useState(settings.defH)
  const [minScore,   setMinScore]  = useState(settings.minScore)
  const [rDays,      setRDays]     = useState(settings.recentDays)
  const [rDate,      setRDate]     = useState(new Date().toISOString().split('T')[0])
  const [showNewLoc, setShowNewLoc]= useState(false)
  const [nLabel,     setNLabel]    = useState('')
  const [nAddr,      setNAddr]     = useState('')
  const [nLat,       setNLat]      = useState('35.78')
  const [nLng,       setNLng]      = useState('-78.64')
  const [route,      setRoute]     = useState(null)
  const [split,      setSplit]     = useState(null)

  const effTer = territories.find(t => t.id === terSel) || activeTer

  const resolveStart = () => {
    if (startMode === 'gps') return gpsData
    if (startMode === 'saved') {
      const l = locs.find(l => l.id === locId)
      return l ? { lat: l.lat, lng: l.lng, label: l.label } : null
    }
    const lat = parseFloat(manLat), lng = parseFloat(manLng)
    if (isNaN(lat) || isNaN(lng)) return null
    return { lat, lng, label: manAddr || 'Inicio manual' }
  }

  const startLoc = resolveStart()
  const startOk  = !!startLoc

  const getGPS = () => {
    if (!navigator.geolocation) { notify('GPS no disponible', 'err'); return }
    setGpsLoad(true)
    navigator.geolocation.getCurrentPosition(
      p => { setGpsData({ lat: p.coords.latitude, lng: p.coords.longitude, label: 'Mi GPS' }); setGpsLoad(false); notify('GPS obtenido') },
      () => { setGpsLoad(false); notify('No se pudo obtener GPS', 'err') },
      { timeout: 8000 }
    )
  }

  const saveNewLoc = () => {
    if (!nLabel.trim()) { notify('Nombre requerido', 'err'); return }
    const lat = parseFloat(nLat), lng = parseFloat(nLng)
    if (isNaN(lat) || isNaN(lng)) { notify('Coordenadas invalidas', 'err'); return }
    const loc = { id: 'loc' + Date.now(), label: nLabel.trim(), address: nAddr || `${lat},${lng}`, lat, lng }
    setLocs(prev => { const next = [...prev, loc]; lsSet(SK.locs, next); return next })
    setLocId(loc.id); setStartMode('saved'); setShowNewLoc(false)
    setNLabel(''); setNAddr(''); setNLat('35.78'); setNLng('-78.64')
    notify(`"${loc.label}" guardada`)
  }

  const generate = () => {
    if (!effTer) { notify('Selecciona un territorio', 'err'); return }
    if (!startOk) { notify('Define el punto de inicio', 'err'); return }
    const verifiedOnly = targets.filter(t => t.address_verified === true)
    const r = optimizeRoute(startLoc, verifiedOnly, effTer.id, { maxB, maxH, minScore, recentDays: rDays })
    if (r.error === 'no_eligible') { notify('Sin targets elegibles para esta configuracion', 'err'); return }
    if (r.error === 'empty_pool' || !r.stops.length) { notify('Sin suficientes targets verificados', 'err'); return }
    setRoute({ id: 'r' + Date.now(), date: rDate, startLoc, stops: r.stops, km: r.km, estMin: r.estMin, splitSuggestion: r.splitSuggestion })
    setSplit(null)
    if (effTer && activeTer?.id !== effTer.id) setActiveTer(effTer)
    notify(`${r.stops.length} paradas . ${r.km} km . ~${r.estMin} min`)
  }

  const markDone = id => {
    setRoute(r => ({ ...r, stops: r.stops.map(s => s.t.id === id ? { ...s, done: true } : s) }))
    if (split) setSplit(sv => ({ am: sv.am.map(s => s.t.id === id ? { ...s, done: true } : s), pm: sv.pm.map(s => s.t.id === id ? { ...s, done: true } : s) }))
    updTgt(id, { status: 'visited', lastVisit: new Date().toISOString() })
    setVisits(vs => [...vs, { id: 'v' + Date.now(), tid: id, dt: new Date().toISOString(), outcome: 'visited_route', notes: '', followUp: '' }])
  }

  const openMaps = (stops, sl) => { const url = buildGMapsUrl(sl, stops); if (url) window.open(url, '_blank') }

  const shareRoute = async (stops, sl) => {
    const url = buildGMapsUrl(sl, stops)
    if (!url) return
    try {
      if (navigator.share) { await navigator.share({ title: 'Ruta RoofPro', url }); notify('Enlace compartido') }
      else { await navigator.clipboard.writeText(url); notify('URL copiada al portapapeles') }
    } catch { notify('No se pudo compartir', 'err') }
  }

  const eligibleCount = useMemo(() => {
    if (!effTer) return null
    const now = Date.now(), ms = rDays * 24 * 3600 * 1000
    return targets.filter(t =>
      t.tid === effTer.id && t.address_verified && t.status !== 'do_not_visit' &&
      t.score >= minScore && !(t.lastVisit && (now - new Date(t.lastVisit).getTime()) < ms)
    ).length
  }, [targets, effTer, minScore, rDays])

  // ---- Sub-components ----
  const RouteMap = ({ stops, sl, h = 200 }) => {
    if (!stops?.length || !sl) return null
    const pts  = [sl, ...stops.map(s => ({ lat: s.t.lat, lng: s.t.lng })), sl]
    const lats = pts.map(p => p.lat), lngs = pts.map(p => p.lng)
    const pad  = 0.008
    const minLat = Math.min(...lats) - pad, maxLat = Math.max(...lats) + pad
    const minLng = Math.min(...lngs) - pad, maxLng = Math.max(...lngs) + pad
    const W = 520
    const tx = lng => ((lng - minLng) / (maxLng - minLng)) * W
    const ty = lat => (1 - (lat - minLat) / (maxLat - minLat)) * h
    const fwd = pts.slice(0, -1).map((p, i) => (i ? 'L' : 'M') + tx(p.lng).toFixed(1) + ',' + ty(p.lat).toFixed(1)).join(' ')
    const last = stops[stops.length - 1]
    const ret  = `M${tx(last.t.lng).toFixed(1)},${ty(last.t.lat).toFixed(1)} L${tx(sl.lng).toFixed(1)},${ty(sl.lat).toFixed(1)}`
    return (
      <svg width="100%" viewBox={`0 0 ${W} ${h}`} style={{ display: 'block', background: '#060c18', borderRadius: 10, marginBottom: 12, border: '1px solid #1e2d45' }}>
        {[0.25, 0.5, 0.75].map(v => (
          <g key={v}>
            <line x1={0} y1={v * h} x2={W} y2={v * h} stroke="#1a2540" strokeWidth={0.5} />
            <line x1={v * W} y1={0} x2={v * W} y2={h} stroke="#1a2540" strokeWidth={0.5} />
          </g>
        ))}
        <path d={fwd} fill="none" stroke="#2563eb" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5} />
        <path d={ret}  fill="none" stroke="#22d3ee" strokeWidth={1}   strokeDasharray="3 4" opacity={0.3} />
        <circle cx={tx(sl.lng)} cy={ty(sl.lat)} r={8} fill="#22d3ee" stroke="#060c18" strokeWidth={2} />
        <text x={tx(sl.lng) + 11} y={ty(sl.lat) + 4} fill="#22d3ee" fontSize={8} fontWeight="bold">CASA</text>
        {stops.map((s, i) => {
          const x = tx(s.t.lng), y = ty(s.t.lat), c = scoreColor(s.t.score)
          const isF = i === 0, isL = i === stops.length - 1
          return (
            <g key={s.t.id} opacity={s.done ? 0.25 : 1}>
              {s.t.type === 'building'
                ? <rect x={x - 5} y={y - 5} width={10} height={10} fill={c} rx={2} />
                : <circle cx={x} cy={y} r={5} fill={c} />}
              <text x={x} y={y - 9} fill={isF ? '#f59e0b' : isL ? '#a78bfa' : '#475569'} fontSize={7} textAnchor="middle" fontWeight={isF || isL ? 'bold' : 'normal'}>
                {isF ? 'FAR' : isL ? 'NEAR' : i + 1}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  const StopRow = ({ s, i, total }) => {
    const isF = i === 0, isL = i === total - 1
    return (
      <div style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '10px 12px', background: s.done ? '#060c18' : i % 2 ? '#0a1628' : '#0f1929', borderRadius: 9, marginBottom: 5, opacity: s.done ? 0.35 : 1, border: `1px solid ${isF ? '#f59e0b40' : isL ? '#a78bfa40' : '#1e2d45'}` }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 9, background: s.done ? '#065f4640' : isF ? '#f59e0b22' : isL ? '#a78bfa22' : '#1a2540', color: s.done ? '#34d399' : isF ? '#f59e0b' : isL ? '#a78bfa' : '#64748b', border: `1px solid ${isF ? '#f59e0b50' : isL ? '#a78bfa50' : 'transparent'}` }}>
          {s.done ? 'OK' : isF ? 'FAR' : isL ? 'NEAR' : i + 1}
        </div>
        <div className="score-ring" style={{ width: 32, height: 32, fontSize: 11, flexShrink: 0, background: `${scoreColor(s.t.score)}22`, color: scoreColor(s.t.score), border: `2px solid ${scoreColor(s.t.score)}` }}>
          {s.t.score}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.t.name}</div>
          <div style={{ fontSize: 11, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.t.formatted_address}</div>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          <button className="btn-ghost btn-sm" onClick={() => goDetail(s.t)}>Ver</button>
          {!s.done && <button className="btn-primary btn-sm" onClick={() => markDone(s.t.id)}>Listo</button>}
        </div>
      </div>
    )
  }

  const RoutePanel = ({ label, stops, sl, col }) => (
    <div className="card" style={{ flex: 1, border: `1px solid ${col}40`, marginBottom: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontWeight: 700, color: col, fontSize: 14 }}>{label} <span style={{ color: '#475569', fontSize: 12, fontWeight: 400 }}>{stops.length} paradas</span></span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-ghost btn-sm" onClick={() => openMaps(stops, sl)}>Maps</button>
          <button className="btn-ghost btn-sm" style={{ color: '#60a5fa' }} onClick={() => shareRoute(stops, sl)}>Compartir</button>
        </div>
      </div>
      <RouteMap stops={stops} sl={sl} h={150} />
      {stops.map((s, i) => <StopRow key={s.t.id} s={s} i={i} total={stops.length} />)}
    </div>
  )

  return (
    <div className="fade">
      <div className="h1">Route Planner</div>

      <div className="card-accent">
        <div className="grid-2">
          {/* Left: territory + start */}
          <div>
            <div style={{ marginBottom: 14 }}>
              <label className="lbl">Territorio</label>
              <select className="inp" value={terSel} onChange={e => setTerSel(e.target.value)}>
                <option value="">-- Selecciona --</option>
                {territories.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {effTer && eligibleCount != null && (
                <div style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>
                  <span style={{ color: '#22d3ee', fontWeight: 700 }}>{eligibleCount}</span> targets elegibles
                </div>
              )}
            </div>

            {/* Start location */}
            <div style={{ background: '#060c18', borderRadius: 10, padding: 12, border: '1px solid #1e2d45' }}>
              <label className="lbl" style={{ color: '#60a5fa', marginBottom: 8 }}>Punto de inicio <span style={{ color: '#ef4444' }}>*</span></label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {[['saved', 'Guardada'], ['gps', 'GPS'], ['manual', 'Manual']].map(([m, l]) => (
                  <button key={m} onClick={() => setStartMode(m)} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: `1px solid ${startMode === m ? '#2563eb' : '#2d3f5a'}`, background: startMode === m ? '#0f1d35' : 'transparent', color: startMode === m ? '#60a5fa' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
                ))}
              </div>

              {startMode === 'saved' && (
                <div>
                  {locs.map(l => (
                    <div key={l.id} onClick={() => setLocId(l.id)} style={{ display: 'flex', gap: 10, padding: '9px 11px', borderRadius: 8, marginBottom: 5, cursor: 'pointer', border: `1px solid ${locId === l.id ? '#2563eb' : '#1e2d45'}`, background: locId === l.id ? '#0f1d35' : '#0a1628' }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', marginTop: 2, background: locId === l.id ? '#2563eb' : '#1a2540', border: `2px solid ${locId === l.id ? '#60a5fa' : '#2d3f5a'}`, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: '#e2e8f0' }}>
                          {l.label}
                          {l.id === settings.defaultLocId && <span className="pill" style={{ background: '#1e3a5f', color: '#60a5fa', marginLeft: 6, fontSize: 8 }}>DEF</span>}
                        </div>
                        <div style={{ fontSize: 10, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.address}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setShowNewLoc(!showNewLoc)}>+ Nueva</button>
                    {locId && <button className="btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => { setSettings(s => { const n = { ...s, defaultLocId: locId }; lsSet(SK.settings, n); return n }); notify('Default guardado') }}>Def</button>}
                  </div>
                  {showNewLoc && (
                    <div style={{ marginTop: 10, background: '#0a1628', borderRadius: 8, padding: 10, border: '1px solid #1e3a5f' }}>
                      <div className="grid-2" style={{ gap: 6, marginBottom: 6 }}>
                        <div><label className="lbl">Nombre</label><input className="inp" value={nLabel} onChange={e => setNLabel(e.target.value)} placeholder="Casa" /></div>
                        <div><label className="lbl">Direccion</label><input className="inp" value={nAddr} onChange={e => setNAddr(e.target.value)} /></div>
                        <div><label className="lbl">Lat</label><input className="inp" value={nLat} onChange={e => setNLat(e.target.value)} /></div>
                        <div><label className="lbl">Lng</label><input className="inp" value={nLng} onChange={e => setNLng(e.target.value)} /></div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-primary btn-sm" onClick={saveNewLoc}>Guardar</button>
                        <button className="btn-ghost btn-sm" onClick={() => setShowNewLoc(false)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {startMode === 'gps' && (
                <div>
                  <button className="btn-ghost btn-sm" style={{ width: '100%', marginBottom: 6 }} onClick={getGPS} disabled={gpsLoad}>
                    {gpsLoad ? 'Obteniendo...' : 'Obtener GPS'}
                  </button>
                  {gpsData
                    ? <div style={{ fontSize: 12, color: '#34d399', textAlign: 'center' }}>OK: {gpsData.lat.toFixed(4)}, {gpsData.lng.toFixed(4)}</div>
                    : <div style={{ fontSize: 11, color: '#334155', textAlign: 'center' }}>Presiona para detectar posicion</div>}
                </div>
              )}

              {startMode === 'manual' && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 6 }}>
                  <div><label className="lbl">Direccion</label><input className="inp" value={manAddr} onChange={e => setManAddr(e.target.value)} /></div>
                  <div><label className="lbl">Lat</label><input className="inp" value={manLat} onChange={e => setManLat(e.target.value)} /></div>
                  <div><label className="lbl">Lng</label><input className="inp" value={manLng} onChange={e => setManLng(e.target.value)} /></div>
                </div>
              )}

              <div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: startOk ? '#022c22' : '#1c0505', color: startOk ? '#34d399' : '#f87171', border: `1px solid ${startOk ? '#065f4640' : '#7f1d1d40'}` }}>
                {startOk ? `Inicio: ${startLoc.label} (${startLoc.lat.toFixed(4)}, ${startLoc.lng.toFixed(4)})` : 'Sin punto de inicio -- ruta bloqueada'}
              </div>
            </div>
          </div>

          {/* Right: quotas + filters */}
          <div>
            <label className="lbl">Cupos y filtros</label>
            <div className="grid-2" style={{ gap: 8, marginBottom: 14 }}>
              <div><label className="lbl">Max edificios</label><input type="number" className="inp" value={maxB} min={0} max={20} onChange={e => setMaxB(+e.target.value)} /></div>
              <div><label className="lbl">Max casas</label><input type="number" className="inp" value={maxH} min={0} max={50} onChange={e => setMaxH(+e.target.value)} /></div>
              <div><label className="lbl">Score minimo</label><input type="number" className="inp" value={minScore} min={0} max={100} onChange={e => setMinScore(+e.target.value)} /></div>
              <div><label className="lbl">No visitado (dias)</label><input type="number" className="inp" value={rDays} min={1} max={365} onChange={e => setRDays(+e.target.value)} /></div>
              <div style={{ gridColumn: '1/-1' }}><label className="lbl">Fecha de ruta</label><input type="date" className="inp" value={rDate} onChange={e => setRDate(e.target.value)} /></div>
            </div>

            {/* Security rules display */}
            <div style={{ background: '#060c18', borderRadius: 9, padding: 10, border: '1px solid #1e2d45', fontSize: 11 }}>
              <div style={{ color: '#334155', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Seguridad activa</div>
              {[
                'Solo targets con address_verified=true',
                'Excluye do_not_visit siempre',
                `Excluye visitados en ${rDays} dias`,
                `Score minimo: ${minScore}`,
                'Bloqueado sin punto de inicio',
              ].map(r => (
                <div key={r} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
                  <span style={{ color: '#22d3ee', fontSize: 10 }}>[OK]</span>
                  <span style={{ color: '#334155' }}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <button className="btn-primary" style={{ fontSize: 14, padding: '11px 22px', opacity: (!effTer || !startOk) ? 0.4 : 1 }} onClick={generate} disabled={!effTer || !startOk}>
            Generar Ruta
          </button>
          {route && !split && route.stops.length > 3 && (
            <button className="btn-ghost" onClick={() => { const m = Math.ceil(route.stops.length / 2); setSplit({ am: route.stops.slice(0, m), pm: route.stops.slice(m) }); notify('Dividida AM/PM') }}>
              Dividir AM/PM
            </button>
          )}
          {route && !split && <button className="btn-ghost" onClick={() => openMaps(route.stops, route.startLoc)}>Google Maps</button>}
          {route && !split && <button className="btn-ghost" style={{ color: '#60a5fa', borderColor: '#2563eb60' }} onClick={() => shareRoute(route.stops, route.startLoc)}>Compartir</button>}
          {split  && <button className="btn-ghost" onClick={() => setSplit(null)}>Ruta completa</button>}
        </div>
      </div>

      {/* Stats bar */}
      {route && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            ['Paradas',   route.stops.length,                                                  '#22d3ee'],
            ['Edificios', route.stops.filter(s => s.t.type === 'building').length,              '#f59e0b'],
            ['Casas',     route.stops.filter(s => s.t.type === 'house').length,                 '#10b981'],
            ['Distancia', route.km + ' km',                                                     '#a78bfa'],
            ['Tiempo',    '~' + route.estMin + ' min',                                          '#fb923c'],
            ['Listas',    route.stops.filter(s => s.done).length + '/' + route.stops.length,    '#34d399'],
          ].map(([l, v, c]) => (
            <div key={l} style={{ background: '#0a1628', border: '1px solid #1e2d45', borderRadius: 9, padding: '7px 14px', flex: '1 1 auto', minWidth: 80 }}>
              <div className="lbl" style={{ marginBottom: 2 }}>{l}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: c }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Split suggestion banner */}
      {route?.splitSuggestion && !split && (
        <div style={{ background: '#1c1203', border: '1px solid #f59e0b40', borderRadius: 10, padding: '10px 16px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: 13 }}>Targets dispersos -- considera AM/PM</div>
            <div style={{ color: '#78350f', fontSize: 12, marginTop: 2 }}>Clusters separados por mas de 12 km.</div>
          </div>
          <button className="btn-ghost btn-sm" style={{ color: '#f59e0b', borderColor: '#f59e0b60' }}
            onClick={() => { const m = Math.ceil(route.stops.length / 2); setSplit({ am: route.stops.slice(0, m), pm: route.stops.slice(m) }); notify('Dividida AM/PM') }}>
            Dividir
          </button>
        </div>
      )}

      {/* Route display */}
      {route && !split && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, color: '#f1f5f9' }}>Ruta {route.date} -- {route.startLoc.label}</span>
            <span style={{ fontSize: 12, color: '#334155' }}>{route.stops.filter(s => s.done).length}/{route.stops.length}</span>
          </div>
          <RouteMap stops={route.stops} sl={route.startLoc} />
          {route.stops.map((s, i) => <StopRow key={s.t.id} s={s} i={i} total={route.stops.length} />)}
        </div>
      )}

      {split && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <RoutePanel label="AM" stops={split.am} sl={route.startLoc} col="#f59e0b" />
          <RoutePanel label="PM" stops={split.pm} sl={route.startLoc} col="#a78bfa" />
        </div>
      )}

      {!route && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 13, color: '#1e2d45' }}>Selecciona territorio, define inicio y genera la ruta</div>
        </div>
      )}
    </div>
  )
}
