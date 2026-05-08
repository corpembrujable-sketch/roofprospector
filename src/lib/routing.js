import { haversineDist } from './geo.js'

// ================================================================
// ROUTE OPTIMIZATION ENGINE
// Round-trip: farthest-first NN + 2-opt (return leg aware)
// ================================================================

/** Farthest-first Nearest Neighbor -- go far first, come home near */
export function nearestNeighborRoundTrip(home, pool) {
  if (!pool.length) return []
  const rem = [...pool], route = []

  // First stop = farthest from home
  let fi = 0, fd = 0
  rem.forEach((t, i) => {
    const d = haversineDist(home, t)
    if (d > fd) { fd = d; fi = i }
  })
  route.push(rem[fi])
  rem.splice(fi, 1)

  // Nearest-neighbor the rest
  let cur = route[0]
  while (rem.length) {
    let bi = 0, bd = Infinity
    rem.forEach((t, i) => {
      const d = haversineDist(cur, t)
      if (d < bd) { bd = d; bi = i }
    })
    route.push(rem[bi])
    cur = rem[bi]
    rem.splice(bi, 1)
  }
  return route
}

/** 2-opt improvement -- minimizes full round-trip cost (home + route + home) */
export function twoOptRoundTrip(route, home) {
  if (route.length < 4) return route
  let best = [...route]
  let improved = true

  const cost = r => {
    let d = haversineDist(home, r[0])
    for (let i = 1; i < r.length; i++) d += haversineDist(r[i - 1], r[i])
    return d + haversineDist(r[r.length - 1], home)
  }

  while (improved) {
    improved = false
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 2; j < best.length; j++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j).reverse(),
          ...best.slice(j),
        ]
        if (cost(candidate) < cost(best) - 0.001) {
          best = candidate
          improved = true
        }
      }
    }
  }
  return best
}

/** Grid clustering -- groups targets into cellKm x cellKm geographic cells */
function gridCluster(targets, cellKm = 3.5) {
  const g = cellKm / 111
  const cells = {}
  targets.forEach(t => {
    const k = `${Math.floor(t.lat / g)}_${Math.floor(t.lng / g)}`
    if (!cells[k]) cells[k] = {
      items: [],
      cLat: (Math.floor(t.lat / g) + 0.5) * g,
      cLng: (Math.floor(t.lng / g) + 0.5) * g,
    }
    cells[k].items.push(t)
  })
  return Object.values(cells)
}

// ================================================================
// optimizeRoute(startLoc, allTargets, activeTerId, opts)
//
// Security enforced here -- never includes:
//   - targets outside the active territory
//   - do_not_visit targets
//   - unverified addresses
//   - recently visited (within recentDays)
//   - score below minScore
//
// Returns { stops, km, estMin, splitSuggestion, eligibleCount }
// OR      { error: 'no_eligible' | 'empty_pool' }
// ================================================================
export function optimizeRoute(startLoc, allTargets, activeTerId, opts = {}) {
  const {
    maxB = 3,
    maxH = 8,
    minScore = 20,
    recentDays = 21,
  } = opts

  const now = Date.now()
  const recentMs = recentDays * 24 * 3600 * 1000

  // SECURITY LAYER
  const eligible = allTargets.filter(t => {
    if (t.tid !== activeTerId)          return false
    if (t.status === 'do_not_visit')    return false
    if (!t.address_verified)            return false  // never route unverified
    if (t.score < minScore)             return false
    if (t.lastVisit && (now - new Date(t.lastVisit).getTime()) < recentMs) return false
    return true
  })

  if (!eligible.length) return { error: 'no_eligible' }

  const bPool = eligible.filter(t => t.type === 'building').sort((a, b) => b.score - a.score).slice(0, maxB)
  const hPool = eligible.filter(t => t.type === 'house').sort((a, b) => b.score - a.score).slice(0, maxH)
  const pool  = [...bPool, ...hPool]

  if (!pool.length) return { error: 'empty_pool' }

  // Cluster and rank by score density vs distance from start
  const clusters = gridCluster(pool, 3.5)
    .map(c => ({
      ...c,
      distToStart: haversineDist(startLoc, { lat: c.cLat, lng: c.cLng }),
      scoreSum: c.items.reduce((s, t) => s + t.score, 0),
    }))
    .sort((a, b) => (b.scoreSum / (b.distToStart + 0.5)) - (a.scoreSum / (a.distToStart + 0.5)))

  const splitSuggestion = clusters.length >= 2 &&
    haversineDist(
      { lat: clusters[0].cLat, lng: clusters[0].cLng },
      { lat: clusters[1].cLat, lng: clusters[1].cLng }
    ) > 12

  // Build work pool: best cluster + nearby stragglers within 8km
  const work = [...clusters[0].items]
  const used = new Set(work.map(t => t.id))
  pool.filter(t => !used.has(t.id)).forEach(t => {
    if (haversineDist({ lat: clusters[0].cLat, lng: clusters[0].cLng }, t) < 8) work.push(t)
  })

  // Optimize
  let ordered = nearestNeighborRoundTrip(startLoc, work)
  ordered = twoOptRoundTrip(ordered, startLoc)

  // Distance including return leg
  let km = ordered.length ? haversineDist(startLoc, ordered[0]) : 0
  for (let i = 1; i < ordered.length; i++) km += haversineDist(ordered[i - 1], ordered[i])
  km += haversineDist(ordered[ordered.length - 1], startLoc)
  km = Math.round(km * 10) / 10

  return {
    stops: ordered.map((t, i) => ({ t, done: false, order: i + 1 })),
    km,
    estMin: Math.round((km / 30) * 60 + ordered.length * 15),
    splitSuggestion,
    eligibleCount: eligible.length,
  }
}

/** Build a fixed-order Google Maps directions URL */
export function buildGMapsUrl(startLoc, stops) {
  if (!stops.length || !startLoc) return null
  const enc = p => encodeURIComponent(`${p.lat},${p.lng}`)
  const pts  = stops.map(s => ({ lat: s.t.lat, lng: s.t.lng }))
  const wps  = pts.slice(0, -1).map(enc).join(encodeURIComponent('|'))
  const dest = enc(pts[pts.length - 1])
  return `https://www.google.com/maps/dir/?api=1&origin=${enc(startLoc)}&destination=${dest}&travelmode=driving${wps ? '&waypoints=' + wps : ''}`
}
