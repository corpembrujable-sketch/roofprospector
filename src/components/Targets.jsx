import { useState, useEffect, useRef } from 'react'
import useGoogleMaps from '../lib/useGoogleMaps.js'
import { validateAddress, importBuildingsForTerritory } from '../lib/maps.js'
import { createTargetFromValidatedAddress, zipInTerritory, pointNearTerritory } from '../lib/geo.js'
import { scoreColor, STATUS_COLOR, STATUS_LABEL } from '../lib/constants.js'

export default function Targets({ targets, allTargets, territories, activeTer, setActiveTer, setTargetsAndSave, goDetail, notify }) {
  const googleReady  = useGoogleMaps()  // true when window.google.maps.places is loaded
  const [tab,        setTab]        = useState('list')
  const [terSel,     setTerSel]     = useState(activeTer?.id || '')
  const [query,      setQuery]      = useState('')
  const [validating, setValidating] = useState(false)
  const [validated,  setValidated]  = useState(null)
  const [valError,   setValError]   = useState(null)
  const [hName,      setHName]      = useState('')
  const [hYr,        setHYr]        = useState('')
  const [hTree,      setHTree]      = useState('0')
  const [importing,  setImporting]  = useState(false)
  const [importRes,  setImportRes]  = useState(null)
  const [fType,      setFType]      = useState('all')
  const [fStat,      setFStat]      = useState('all')
  const [q,          setQ]          = useState('')

  // Google Places Autocomplete
  const autocompleteRef  = useRef(null)
  const inputRef         = useRef(null)
  const autocompleteInst = useRef(null)

  const effTer = territories.find(t => t.id === terSel) || activeTer

  useEffect(() => {
    if (terSel) {
      const t = territories.find(x => x.id === terSel)
      if (t) setActiveTer(t)
    }
  }, [terSel])

  // Initialize Google Places Autocomplete
  // Re-runs whenever googleReady flips to true or user opens the add_house tab
  useEffect(() => {
    if (tab !== 'add_house') return
    if (!googleReady || !window.google?.maps?.places) return
    if (!inputRef.current) return
    if (autocompleteInst.current) return  // Already initialized

    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'us' },
      fields: ['place_id', 'formatted_address', 'geometry', 'address_components', 'name'],
      types: ['address'],
    })

    ac.addListener('place_changed', () => {
      const place = ac.getPlace()
      if (!place.geometry) return

      const comps = place.address_components || []
      const getC  = type => comps.find(c => c.types.includes(type))
      const zip   = getC('postal_code')?.short_name || ''
      const city  = getC('locality')?.long_name || ''
      const state = getC('administrative_area_level_1')?.short_name || 'NC'
      const lat   = place.geometry.location.lat()
      const lng   = place.geometry.location.lng()

      setQuery(place.formatted_address)
      setValError(null)

      // Territory check on autocomplete result
      if (effTer) {
        // zipInTerritory and pointNearTerritory imported at top of file
        const inTer = zipInTerritory(zip, effTer) || pointNearTerritory(lat, lng, effTer)
        if (!inTer) {
          setValError(`Fuera del territorio "${effTer.name}". ZIP ${zip} no pertenece.`)
          return
        }
      }

      setValidated({
        place_id:          place.place_id,
        formatted_address: place.formatted_address,
        lat, lng, city, state, zip,
        address_verified:  true,
        data_source:       'places',
      })
    })

    autocompleteInst.current = ac
  }, [tab, effTer, googleReady])

  const shown = targets
    .filter(t => {
      if (fType !== 'all' && t.type !== fType) return false
      if (fStat !== 'all' && t.status !== fStat) return false
      if (q && !t.name.toLowerCase().includes(q.toLowerCase()) &&
               !t.formatted_address?.toLowerCase().includes(q.toLowerCase())) return false
      return true
    })
    .sort((a, b) => b.score - a.score)

  // Fallback: validate via proxy API if no autocomplete
  const doValidate = async () => {
    if (!effTer) { notify('Selecciona un territorio primero', 'err'); return }
    setValidating(true); setValidated(null); setValError(null)
    try {
      const geo = await validateAddress(query, effTer)
      setValidated(geo)
    } catch (e) {
      setValError(e.message)
    } finally {
      setValidating(false)
    }
  }

  const doSaveHouse = () => {
    if (!validated || !effTer) return
    const yr   = parseInt(hYr) || null
    const tree = parseInt(hTree) || 0
    const age  = yr ? (2025 - yr) : null
    const ageS = age == null ? 10 : age <= 15 ? 5 : age <= 25 ? 15 : age <= 35 ? 25 : age <= 50 ? 35 : 45
    const score = Math.min(100, ageS + tree)

    const tgt = createTargetFromValidatedAddress(validated, {
      name:    hName.trim() || validated.formatted_address,
      type:    'house',
      subtype: 'single_family',
      tid:     effTer.id,
      yr,
    })
    tgt.tree  = tree
    tgt.score = score
    if (tree > 0) {
      tgt.sigs.push({
        id: 'ts' + Date.now(),
        signal_type: 'tree_risk',
        severity: tree > 20 ? 4 : 3,
        confidence: 0.8,
        evidence_short: `Tree risk: ${tree}/25`,
        signal_date: new Date().toISOString().split('T')[0],
        source: 'manual',
      })
    }

    setTargetsAndSave(ts => [...ts, tgt])
    setQuery(''); setValidated(null); setHName(''); setHYr(''); setHTree('0')
    setTab('list')
    notify(`Casa guardada: ${tgt.formatted_address}`)
  }

  const doImport = async () => {
    if (!effTer) { notify('Selecciona un territorio primero', 'err'); return }
    setImporting(true); setImportRes(null)
    try {
      const existingIds = new Set(allTargets.filter(t => t.place_id).map(t => t.place_id))
      const buildings   = await importBuildingsForTerritory(effTer, existingIds)
      if (!buildings.length) { setImportRes({ count: 0 }); return }
      setTargetsAndSave(ts => [...ts, ...buildings])
      setImportRes({ count: buildings.length, names: buildings.map(b => b.name) })
      notify(`${buildings.length} edificios importados en ${effTer.name}`)
    } catch (e) {
      notify(e.message, 'err')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fade">
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
        <div>
          <div className="h1" style={{ marginBottom:2 }}>Targets</div>
          <div style={{ fontSize:12, color:'#475569' }}>Solo direcciones verificadas por Google Places</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button
            className="btn-ghost btn-sm"
            style={{ color: tab === 'add_house' ? '#60a5fa' : undefined, borderColor: tab === 'add_house' ? '#2563eb60' : undefined }}
            onClick={() => setTab(tab === 'add_house' ? 'list' : 'add_house')}
          >+ Casa</button>
          <button
            className="btn-ghost btn-sm"
            style={{ color: tab === 'import' ? '#f59e0b' : undefined, borderColor: tab === 'import' ? '#f59e0b60' : undefined }}
            onClick={() => setTab(tab === 'import' ? 'list' : 'import')}
          >Importar Edificios</button>
        </div>
      </div>

      {/* Territory selector */}
      <div className="card-accent" style={{ marginBottom:14 }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ flex:1, minWidth:220 }}>
            <label className="lbl">Territorio activo</label>
            <select className="inp" value={terSel} onChange={e => setTerSel(e.target.value)}>
              <option value="">-- Selecciona un territorio --</option>
              {territories.map(t => (
                <option key={t.id} value={t.id}>{t.name} -- ZIPs: {t.zips.join(', ')}</option>
              ))}
            </select>
          </div>
          {effTer && (
            <div style={{ fontSize:12, color:'#475569', paddingTop:16 }}>
              <span style={{ color:'#22d3ee', fontWeight:700 }}>{targets.length}</span> targets verificados
            </div>
          )}
        </div>
      </div>

      {/* ADD HOUSE */}
      {tab === 'add_house' && (
        <div className="card" style={{ border:'1px solid #2563eb30', background:'#0a1628', marginBottom:14 }}>
          <div style={{ fontWeight:700, color:'#60a5fa', fontSize:14, marginBottom:14 }}>Agregar Casa -- Direccion Verificada</div>

          {!validated ? (
            <div>
              <label className="lbl">Direccion completa <span style={{ color:'#ef4444' }}>*</span></label>
              <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                <input
                  ref={inputRef}
                  className="inp"
                  style={{ flex:1 }}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setValError(null) }}
                  placeholder="930 Vintage Jones Way, Raleigh NC 27606"
                  onKeyDown={e => e.key === 'Enter' && doValidate()}
                />
                <button
                  className="btn-primary btn-sm"
                  style={{ flexShrink:0 }}
                  onClick={doValidate}
                  disabled={validating || !query.trim()}
                >
                  {validating ? 'Verificando...' : 'Verificar'}
                </button>
              </div>

              {valError && (
                <div style={{ padding:'8px 12px', background:'#1c0505', border:'1px solid #dc262640', borderRadius:7, fontSize:12, color:'#f87171', marginBottom:8 }}>
                  {valError}
                </div>
              )}

              <div style={{ fontSize:11, color:'#334155' }}>
                {googleReady
                  ? 'Autocomplete activo -- escribe para ver sugerencias de Google.'
                  : 'Cargando Google Maps... o escribe la direccion y presiona Verificar.'}
              </div>

              {!effTer && <div style={{ fontSize:12, color:'#f87171', marginTop:8 }}>Selecciona un territorio antes de agregar.</div>}
            </div>
          ) : (
            <div>
              <div style={{ padding:'10px 14px', background:'#022c22', border:'1px solid #065f4640', borderRadius:8, marginBottom:14 }}>
                <div style={{ fontSize:11, color:'#6ee7b7', fontWeight:700, marginBottom:3 }}>DIRECCION VERIFICADA POR GOOGLE</div>
                <div style={{ fontWeight:600, color:'#f1f5f9', fontSize:13 }}>{validated.formatted_address}</div>
                <div style={{ fontSize:11, color:'#475569', marginTop:2 }}>
                  {validated.city}, {validated.state} {validated.zip} &bull; ({validated.lat.toFixed(5)}, {validated.lng.toFixed(5)}) &bull; place_id: {validated.place_id?.substring(0, 20)}...
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:10, marginBottom:14 }}>
                <div><label className="lbl">Nombre / referencia (opcional)</label><input className="inp" value={hName} onChange={e => setHName(e.target.value)} placeholder="Casa Smith" /></div>
                <div><label className="lbl">Ano construccion</label><input className="inp" type="number" value={hYr} onChange={e => setHYr(e.target.value)} placeholder="1985" /></div>
                <div><label className="lbl">Tree risk (0-25)</label><input className="inp" type="number" value={hTree} min="0" max="25" onChange={e => setHTree(e.target.value)} /></div>
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button className="btn-primary btn-sm" onClick={doSaveHouse}>Guardar casa</button>
                <button className="btn-ghost btn-sm" onClick={() => { setValidated(null); setValError(null) }}>Cambiar direccion</button>
                <button className="btn-ghost btn-sm" onClick={() => { setTab('list'); setValidated(null); setQuery('') }}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* IMPORT BUILDINGS */}
      {tab === 'import' && (
        <div className="card" style={{ border:'1px solid #f59e0b30', background:'#0a1628', marginBottom:14 }}>
          <div style={{ fontWeight:700, color:'#f59e0b', fontSize:14, marginBottom:8 }}>Importar Edificios -- Google Places</div>
          <div style={{ fontSize:12, color:'#64748b', marginBottom:14, lineHeight:1.6 }}>
            Busca en <b style={{ color:'#94a3b8' }}>{effTer?.name || 'el territorio activo'}</b> usando Places Text Search.
            Solo se guardan resultados con <code style={{ background:'#1a2540', padding:'1px 5px', borderRadius:3 }}>place_id</code> real de Google.
          </div>

          {!effTer ? (
            <div style={{ color:'#f87171', fontSize:13 }}>Selecciona un territorio primero.</div>
          ) : (
            <div>
              <div style={{ fontSize:12, color:'#475569', marginBottom:12 }}>
                Queries: {['apartments', 'condominiums', 'HOA communities', 'property management'].map(q => (
                  <span key={q} className="pill" style={{ background:'#1e2d4560', color:'#94a3b8', marginLeft:6 }}>{q}</span>
                ))}
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button
                  className="btn-primary btn-sm"
                  style={{ background:'#b45309' }}
                  onClick={doImport}
                  disabled={importing}
                >
                  {importing ? 'Importando...' : `Importar en ${effTer.name}`}
                </button>
                {importing && <div className="spinner" style={{ width:16, height:16 }} />}
              </div>

              {importRes && (
                <div style={{ marginTop:12, padding:'10px 14px', background: importRes.count > 0 ? '#022c22' : '#1c0a00', border:`1px solid ${importRes.count > 0 ? '#065f4640' : '#78350f40'}`, borderRadius:8, fontSize:12 }}>
                  {importRes.count > 0 ? (
                    <div>
                      <div style={{ color:'#6ee7b7', fontWeight:700, marginBottom:6 }}>{importRes.count} edificios importados</div>
                      {importRes.names?.map((n, i) => <div key={i} style={{ color:'#94a3b8', marginBottom:2 }}>{i + 1}. {n}</div>)}
                    </div>
                  ) : (
                    <div style={{ color:'#fcd34d' }}>No se encontraron edificios nuevos.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* LIST */}
      {tab === 'list' && (
        <div>
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
            <input className="inp" style={{ width:220 }} placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} />
            <select className="inp" style={{ width:130 }} value={fType} onChange={e => setFType(e.target.value)}>
              <option value="all">Todos</option>
              <option value="building">Edificios</option>
              <option value="house">Casas</option>
            </select>
            <select className="inp" style={{ width:140 }} value={fStat} onChange={e => setFStat(e.target.value)}>
              <option value="all">Todos estados</option>
              <option value="new">Nuevos</option>
              <option value="queued">En cola</option>
              <option value="visited">Visitados</option>
              <option value="do_not_visit">No visitar</option>
            </select>
            <span style={{ alignSelf:'center', fontSize:12, color:'#334155', marginLeft:'auto' }}>{shown.length} resultados</span>
          </div>

          {!shown.length && (
            <div className="card" style={{ textAlign:'center', padding:56 }}>
              <div style={{ fontSize:32, marginBottom:14 }}>&#127968;</div>
              <div style={{ fontWeight:700, fontSize:16, color:'#334155', marginBottom:6 }}>Sin targets aun</div>
              <div style={{ fontSize:13, color:'#1e2d45', maxWidth:380, margin:'0 auto', lineHeight:1.6 }}>
                Usa <b style={{ color:'#60a5fa' }}>+ Casa</b> para agregar con direccion verificada, o
                <b style={{ color:'#f59e0b' }}> Importar Edificios</b> para traer apartments/HOAs reales de Google Places.
              </div>
              <div style={{ marginTop:14, fontSize:11, color:'#1e2d45' }}>Ningun dato mock sera guardado.</div>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:10 }}>
            {shown.map(t => (
              <div
                key={t.id}
                onClick={() => goDetail(t)}
                className="card"
                style={{ cursor:'pointer', borderLeft:`3px solid ${scoreColor(t.score)}`, marginBottom:0, transition:'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#0f1d35'}
                onMouseLeave={e => e.currentTarget.style.background = '#0a1628'}
              >
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                  <div style={{ fontWeight:600, fontSize:13, color:'#e2e8f0', lineHeight:1.3, flex:1, marginRight:10 }}>{t.name}</div>
                  <div className="score-ring" style={{ width:32, height:32, fontSize:11, flexShrink:0, background:`${scoreColor(t.score)}22`, color:scoreColor(t.score), border:`2px solid ${scoreColor(t.score)}` }}>{t.score}</div>
                </div>
                <div style={{ fontSize:11, color:'#475569', marginBottom:6, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.formatted_address}</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  <span className="pill" style={{ background: t.type === 'building' ? '#f59e0b22' : '#22d3ee22', color: t.type === 'building' ? '#f59e0b' : '#22d3ee', fontSize:10 }}>
                    {t.type === 'building' ? 'Edificio' : 'Casa'}
                  </span>
                  <span className="pill" style={{ background:`${STATUS_COLOR[t.status]}22`, color:STATUS_COLOR[t.status], fontSize:10 }}>
                    {STATUS_LABEL[t.status]}
                  </span>
                  {t.place_id && <span className="pill" style={{ background:'#1e3a5f', color:'#60a5fa', fontSize:9 }}>Places ID</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
