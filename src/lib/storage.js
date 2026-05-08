// ================================================================
// STORAGE -- localStorage for real web app
// Key prefix: rp: (RoofProspector)
// ================================================================

export function lsGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key)
    return raw != null ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('localStorage write failed:', e)
  }
}

export function lsDel(key) {
  try { localStorage.removeItem(key) } catch {}
}
