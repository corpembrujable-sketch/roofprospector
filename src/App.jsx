import { useState, useEffect, useMemo, Component } from 'react'
import { TERRITORIES, DEFAULT_LOCS, DEFAULT_SETTINGS, SK } from './lib/constants.js'
import { lsGet, lsSet } from './lib/storage.js'
import { removeDummyTargets } from './lib/geo.js'
import { loadGoogleMapsSDK } from './lib/useGoogleMaps.js'
import Login    from './components/Login.jsx'
import Sidebar  from './components/Sidebar.jsx'
import Targets  from './components/Targets.jsx'
import Detail   from './components/Detail.jsx'
import Planner  from './components/Planner.jsx'
import Visits   from './components/Visits.jsx'
import Settings from './components/Settings.jsx'
import Toast    from './components/Toast.jsx'
import './index.css'

// ================================================================
// ERROR BOUNDARY
// Catches any unhandled render error and shows a recovery screen
// instead of a blank white page.
// ================================================================
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('RoofPro ErrorBoundary caught:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={{
        minHeight: '100vh', background: '#060c18', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif',
      }}>
        <div style={{ maxWidth: 480, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>&#9888;&#65039;</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#f1f5f9', marginBottom: 8 }}>
            Algo salio mal
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginBottom: 6, lineHeight: 1.6 }}>
            {this.state.error?.message || 'Error desconocido'}
          </div>
          <div style={{ fontSize: 11, color: '#334155', marginBottom: 24, fontFamily: 'monospace', background: '#0a1628', padding: '8px 12px', borderRadius: 8, textAlign: 'left', overflowX: 'auto' }}>
            {this.state.error?.stack?.split('\n').slice(0, 4).join('\n')}
          </div>
          <button
            onClick={() => { this.setState({ error: null }); window.location.reload() }}
            style={{ padding: '10px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}
          >
            Recargar app
          </button>
        </div>
      </div>
    )
  }
}

// ================================================================
// APP ROOT
// ================================================================
function AppInner() {
  const [ready,      setReady]      = useState(false)
  const [loggedIn,   setLoggedIn]   = useState(false)
  const [screen,     setScreen]     = useState('targets')
  const [activeTer,  setActiveTerR] = useState(null)
  const [targets,    setTargets]    = useState([])
  const [visits,     setVisits]     = useState([])
  const [settings,   setSettings]   = useState(DEFAULT_SETTINGS)
  const [locs,       setLocs]       = useState(DEFAULT_LOCS)
  const [selTgt,     setSelTgt]     = useState(null)
  const [toast,      setToast]      = useState(null)

  // ---- Persisted setters ----
  const setActiveTer = ter => { setActiveTerR(ter); lsSet(SK.activeTer, ter?.id || null) }

  const setLocsAndSave = fn => setLocs(prev => {
    const next = typeof fn === 'function' ? fn(prev) : fn
    lsSet(SK.locs, next); return next
  })
  const setSettingsAndSave = fn => setSettings(prev => {
    const next = typeof fn === 'function' ? fn(prev) : fn
    lsSet(SK.settings, next); return next
  })
  const setVisitsAndSave = fn => setVisits(prev => {
    const next = typeof fn === 'function' ? fn(prev) : fn
    lsSet(SK.visits, next); return next
  })
  const setTargetsAndSave = fn => setTargets(prev => {
    const next = typeof fn === 'function' ? fn(prev) : fn
    lsSet(SK.targets, next); return next
  })
  const updTgt = (id, patch) => setTargetsAndSave(ts =>
    ts.map(t => t.id === id ? { ...t, ...patch } : t)
  )

  const notify = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const goDetail = t => { setSelTgt(t); setScreen('detail') }

  // ---- Bootstrap: load storage + start Maps SDK in parallel ----
  useEffect(() => {
    // Fire Maps SDK load early (non-blocking) so it's ready by the
    // time user opens the "Add House" form
    loadGoogleMapsSDK().catch(() => {
      // Non-fatal: autocomplete just won't work, fallback to geocode API
    })

    const savedTargets   = lsGet(SK.targets)
    const savedLocs      = lsGet(SK.locs)
    const savedSettings  = lsGet(SK.settings)
    const savedVisits    = lsGet(SK.visits)
    const savedActiveTer = lsGet(SK.activeTer)

    if (savedTargets)    setTargets(removeDummyTargets(savedTargets))
    if (savedLocs)       setLocs(savedLocs)
    if (savedSettings)   setSettings(s => ({ ...s, ...savedSettings }))
    if (savedVisits)     setVisits(savedVisits)
    if (savedActiveTer) {
      const ter = TERRITORIES.find(t => t.id === savedActiveTer)
      if (ter) setActiveTerR(ter)
    }

    setReady(true)
  }, [])

  const ats = useMemo(
    () => activeTer ? targets.filter(t => t.tid === activeTer.id) : targets,
    [targets, activeTer]
  )

  if (!ready) return (
    <div className="loading-screen">
      <div className="spinner" />
      <div className="loading-text">Cargando...</div>
    </div>
  )

  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />

  return (
    <div className="app-shell">
      <Toast toast={toast} />
      <Sidebar screen={screen} setScreen={setScreen} activeTer={activeTer} />

      <main className="main-content">
        {screen === 'targets' && (
          <Targets
            targets={ats} allTargets={targets} territories={TERRITORIES}
            activeTer={activeTer} setActiveTer={setActiveTer}
            setTargetsAndSave={setTargetsAndSave}
            goDetail={goDetail} notify={notify}
          />
        )}
        {screen === 'detail' && selTgt && (
          <Detail
            target={targets.find(t => t.id === selTgt.id) || selTgt}
            updTgt={updTgt} visits={visits} setVisits={setVisitsAndSave}
            back={() => setScreen('targets')} notify={notify}
          />
        )}
        {screen === 'planner' && (
          <Planner
            targets={targets} territories={TERRITORIES}
            activeTer={activeTer} setActiveTer={setActiveTer}
            settings={settings} setSettings={setSettingsAndSave}
            locs={locs} setLocs={setLocsAndSave}
            updTgt={updTgt} visits={visits} setVisits={setVisitsAndSave}
            goDetail={goDetail} notify={notify}
          />
        )}
        {screen === 'visits'   && <Visits visits={visits} targets={targets} goDetail={goDetail} />}
        {screen === 'settings' && (
          <Settings
            settings={settings} setSettings={setSettingsAndSave}
            locs={locs} setLocs={setLocsAndSave}
            targets={targets} setTargetsAndSave={setTargetsAndSave}
            notify={notify}
          />
        )}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  )
}
