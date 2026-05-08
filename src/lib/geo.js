import { ZIP_LL } from './constants.js'

// ================================================================
// TERRITORY VALIDATION
// ================================================================

/** Returns true if the ZIP belongs to this territory's zip list */
export function zipInTerritory(zip, territory) {
  if (!zip || !territory) return false
  return territory.zips.includes(String(zip).substring(0, 5))
}

/** Haversine distance in km between two {lat, lng} points */
export function haversineDist(a, b) {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * Returns true if lat/lng is within thresholdKm of any ZIP centroid
 * in the territory. Default 15km covers full ZIP area.
 */
export function pointNearTerritory(lat, lng, territory, thresholdKm = 15) {
  return territory.zips.some(z => {
    const ll = ZIP_LL[z]
    if (!ll) return false
    return haversineDist({ lat, lng }, { lat: ll[0], lng: ll[1] }) < thresholdKm
  })
}

// ================================================================
// TARGET FACTORY
// ================================================================

/**
 * createTargetFromValidatedAddress(geo, meta)
 *
 * ONLY creates targets with:
 *   address_verified: true
 *   created_by_seed:  false
 *   data_source:      "places" | "manual_verified"
 *
 * geo  = { place_id, formatted_address, lat, lng, city, state, zip, data_source }
 * meta = { name, type, subtype, tid, yr }
 */
export function createTargetFromValidatedAddress(geo, meta) {
  const yr   = meta.yr || null
  const age  = yr ? (2025 - yr) : null
  const ageS = age == null ? 10
    : age <= 15 ? 5
    : age <= 25 ? 15
    : age <= 35 ? 25
    : age <= 50 ? 35 : 45

  return {
    id:               'tgt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name:             meta.name || geo.formatted_address,
    type:             meta.type    || 'house',
    subtype:          meta.subtype || 'single_family',

    // Address -- all fields from verified geocoding response
    place_id:          geo.place_id,
    formatted_address: geo.formatted_address,
    address_verified:  true,
    data_source:       geo.data_source || 'manual_verified',
    created_by_seed:   false,

    // Flattened for convenience
    address: geo.formatted_address,
    city:    geo.city,
    state:   geo.state,
    zip:     geo.zip,
    lat:     geo.lat,
    lng:     geo.lng,

    // Territory
    tid: meta.tid,

    // Roof scoring
    yr,
    tree:    0,
    score:   Math.min(100, ageS),
    reasons: yr ? ['Construccion ' + yr] : ['Sin anio de construccion'],
    sigs:    [],

    // CRM
    status:    'new',
    dnvReason: null,
    lastVisit: null,
    createdAt: new Date().toISOString(),
  }
}

/**
 * removeDummyTargets(targets)
 * Removes any target that is:
 *  - created_by_seed === true
 *  - address_verified !== true
 *  - data_source === "mock"
 *  - place_id is null (unless type is "house" and data_source is "manual_verified")
 */
export function removeDummyTargets(targets) {
  return targets.filter(t => {
    if (t.created_by_seed === true)   return false
    if (t.address_verified !== true)  return false
    if (t.data_source === 'mock')     return false
    if (!t.place_id && t.data_source !== 'manual_verified') return false
    return true
  })
}
