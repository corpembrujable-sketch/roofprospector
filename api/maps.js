// api/maps.js -- Vercel Serverless Function
//
// Secure proxy for all Google Maps API calls.
// GOOGLE_MAPS_API_KEY lives only here -- the browser never sees it.
//
// Supported ?endpoint= values:
//   geocode      -> Geocoding API
//   textsearch   -> Places Text Search API
//   details      -> Place Details API
//   autocomplete -> Places Autocomplete API

const GMAPS = 'https://maps.googleapis.com/maps/api'

export default async function handler(req, res) {
  // ---- CORS: allow same Vercel deployment + localhost dev ----
  const origin = req.headers.origin || ''
  const host   = req.headers.host   || ''

  // Allow: localhost dev, any *.vercel.app deploy, and same-origin
  const allowed =
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('.vercel.app') ||
    origin === ''  // same-origin (no Origin header)

  if (allowed) res.setHeader('Access-Control-Allow-Origin', origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' })

  // ---- API Key ----
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error: 'GOOGLE_MAPS_API_KEY not configured',
      hint:  'Add it in Vercel > Settings > Environment Variables',
    })
  }

  // ---- Build upstream URL ----
  const { endpoint, territory_zips, ...params } = req.query
  // ^^ strip internal params before forwarding to Google

  let upstreamUrl
  switch (endpoint) {
    case 'geocode':
      upstreamUrl = `${GMAPS}/geocode/json?${new URLSearchParams({ ...params, key: apiKey })}`
      break
    case 'textsearch':
      upstreamUrl = `${GMAPS}/place/textsearch/json?${new URLSearchParams({ ...params, key: apiKey })}`
      break
    case 'details':
      upstreamUrl = `${GMAPS}/place/details/json?${new URLSearchParams({ ...params, key: apiKey })}`
      break
    case 'autocomplete':
      upstreamUrl = `${GMAPS}/place/autocomplete/json?${new URLSearchParams({ ...params, key: apiKey })}`
      break
    default:
      return res.status(400).json({ error: `Unknown endpoint: "${endpoint}"` })
  }

  // ---- Proxy the request ----
  try {
    const gRes  = await fetch(upstreamUrl)
    const gData = await gRes.json()

    // Scrub key from any error messages Google might echo back
    const safe = JSON.stringify(gData).replace(new RegExp(apiKey, 'g'), '[REDACTED]')

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).send(safe)
  } catch (err) {
    return res.status(502).json({ error: 'Upstream error', message: err.message })
  }
}
