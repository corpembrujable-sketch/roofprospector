import { zipInTerritory, pointNearTerritory, createTargetFromValidatedAddress } from './geo.js'

// ================================================================
// GOOGLE MAPS API -- via /api/maps backend proxy
//
// All calls go to /api/maps/* on your own server.
// The server adds the real API key before forwarding to Google.
// This keeps the key OFF the client entirely.
//
// Backend proxy options (all free tier available):
//   - Vercel:     /api/maps.js  (serverless function)
//   - Netlify:    /.netlify/functions/maps
//   - Cloudflare: Worker
//   - Express:    /api/maps route
//
// The proxy file is at: /api/maps.js (Vercel) in this project.
// ================================================================

const PROXY = '/api/maps'  // Relative -- same domain, no CORS issues

// ================================================================
// validateAddress(query, territory)
//
// Uses Google Geocoding API (via proxy) to resolve a free-text
// address into a verified {place_id, formatted_address, lat, lng,
// city, state, zip}.
//
// Throws with user-visible message on failure.
// NEVER invents or guesses any field.
// ================================================================
export async function validateAddress(query, territory) {
  if (!query || query.trim().length < 6) {
    throw new Error('Escribe una direccion mas completa (incluye numero, calle, ciudad)')
  }

  const params = new URLSearchParams({
    endpoint: 'geocode',
    address:  query.trim(),
    region:   'us',
    components: 'country:US|administrative_area:NC',
  })

  const res = await fetch(`${PROXY}?${params}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Error del servidor: ${res.status}`)
  }

  const data = await res.json()

  if (data.status === 'ZERO_RESULTS' || !data.results?.length) {
    throw new Error('Direccion no encontrada. Incluye numero, calle y ciudad (ej: 930 Vintage Jones Way, Raleigh NC).')
  }
  if (data.status !== 'OK') {
    throw new Error('Error al geocodificar: ' + data.status)
  }

  const r     = data.results[0]
  const loc   = r.geometry.location
  const comps = r.address_components

  const getComp = type => comps.find(c => c.types.includes(type))
  const zip   = getComp('postal_code')?.short_name || ''
  const city  = getComp('locality')?.long_name || getComp('sublocality')?.long_name || ''
  const state = getComp('administrative_area_level_1')?.short_name || 'NC'

  // Reject overly approximate results
  if (r.geometry.location_type === 'APPROXIMATE') {
    throw new Error('Direccion demasiado aproximada. Incluye numero de calle.')
  }

  // Territory check
  if (territory) {
    const inZip  = zipInTerritory(zip, territory)
    const inProx = pointNearTerritory(loc.lat, loc.lng, territory)
    if (!inZip && !inProx) {
      throw new Error(`Fuera del territorio "${territory.name}". ZIP ${zip} no pertenece a este territorio.`)
    }
  }

  return {
    place_id:          r.place_id,
    formatted_address: r.formatted_address,
    lat:               loc.lat,
    lng:               loc.lng,
    city,
    state,
    zip,
    address_verified:  true,
    data_source:       'places',
  }
}

// ================================================================
// importBuildingsForTerritory(territory)
//
// Uses Google Places Text Search (via proxy) to find real
// apartment complexes, condos, HOAs, and property managers.
//
// Returns array of Target objects (address_verified: true).
// Skips any result already in existingPlaceIds.
// ================================================================
export async function importBuildingsForTerritory(territory, existingPlaceIds = new Set()) {
  const QUERIES = [
    'apartment complex',
    'condominium',
    'HOA homeowners association',
    'property management company',
  ]

  const allTargets = []
  const seen = new Set(existingPlaceIds)

  for (const q of QUERIES) {
    const params = new URLSearchParams({
      endpoint: 'textsearch',
      query:    `${q} in ${territory.name} NC`,
      radius:   '10000',
      type:     'establishment',
      territory_zips: territory.zips.join(','),
    })

    let data
    try {
      const res = await fetch(`${PROXY}?${params}`)
      if (!res.ok) continue
      data = await res.json()
    } catch {
      continue  // Skip this query, don't fail all
    }

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') continue

    for (const place of (data.results || [])) {
      if (!place.place_id || seen.has(place.place_id)) continue
      if (!place.geometry?.location) continue

      const { lat, lng } = place.geometry.location
      const addr = place.formatted_address || place.vicinity || ''

      // Extract ZIP from address string
      const zipMatch = addr.match(/\b(27[0-9]{3})\b/)
      const zip = zipMatch ? zipMatch[1] : ''

      // Strict territory validation on real coordinates
      const inTer = zipInTerritory(zip, territory) || pointNearTerritory(lat, lng, territory, 12)
      if (!inTer) continue

      seen.add(place.place_id)

      const subtype = q.includes('apartment') ? 'apartments'
        : q.includes('condo') ? 'condo'
        : q.includes('HOA')   ? 'hoa'
        :                       'property_management'

      allTargets.push(createTargetFromValidatedAddress(
        {
          place_id:          place.place_id,
          formatted_address: addr,
          lat, lng,
          city:  place.vicinity?.split(',')[1]?.trim() || territory.name.split('/')[0].trim(),
          state: 'NC',
          zip,
          address_verified: true,
          data_source:      'places',
        },
        {
          name:    place.name,
          type:    'building',
          subtype,
          tid:     territory.id,
          yr:      null,
        }
      ))
    }
  }

  return allTargets
}

// ================================================================
// getPlaceDetails(placeId)
//
// Fetches full Place Details for a given place_id.
// Used to enrich imported buildings with phone, website, etc.
// ================================================================
export async function getPlaceDetails(placeId) {
  const params = new URLSearchParams({
    endpoint: 'details',
    place_id: placeId,
    fields:   'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,opening_hours',
  })

  const res = await fetch(`${PROXY}?${params}`)
  if (!res.ok) return null
  const data = await res.json()
  return data.result || null
}
