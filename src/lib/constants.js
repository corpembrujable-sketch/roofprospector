// ================================================================
// CONSTANTS
// ================================================================

export const TERRITORIES = [
  { id: 't1', name: 'North Raleigh',           zips: ['27615','27616','27613','27614'] },
  { id: 't2', name: 'Downtown Raleigh',         zips: ['27601','27603','27604','27605'] },
  { id: 't3', name: 'Cary / Apex',              zips: ['27511','27513','27519','27502'] },
  { id: 't4', name: 'Wake Forest / Rolesville', zips: ['27587','27571','27588'] },
  { id: 't5', name: 'Garner / Knightdale',      zips: ['27529','27545','27560'] },
]

// ZIP centroid coordinates for territory proximity checks
export const ZIP_LL = {
  '27615':[35.900,-78.628], '27616':[35.888,-78.555],
  '27613':[35.874,-78.700], '27614':[35.932,-78.627],
  '27601':[35.780,-78.640], '27603':[35.752,-78.650],
  '27604':[35.812,-78.590], '27605':[35.789,-78.662],
  '27511':[35.791,-78.781], '27513':[35.809,-78.821],
  '27519':[35.756,-78.868], '27502':[35.730,-78.852],
  '27587':[35.977,-78.509], '27571':[35.975,-78.557],
  '27588':[35.950,-78.502], '27529':[35.704,-78.601],
  '27545':[35.789,-78.484], '27560':[35.791,-78.530],
}

export const DEFAULT_LOCS = [
  { id: 'loc1', label: 'Casa',    address: '930 Vintage Jones Way Apt 101, Raleigh NC 27606', lat: 35.7541, lng: -78.7282 },
  { id: 'loc2', label: 'Oficina', address: '8200 Creedmoor Rd, Raleigh NC 27613',              lat: 35.872,  lng: -78.700  },
]

export const DEFAULT_SETTINGS = {
  recentDays: 21,
  defB: 3,
  defH: 8,
  minScore: 20,
  defaultLocId: 'loc1',
}

export const STATUS_COLOR = {
  new:          '#22d3ee',
  queued:       '#f59e0b',
  visited:      '#10b981',
  do_not_visit: '#ef4444',
}

export const STATUS_LABEL = {
  new:          'Nuevo',
  queued:       'En cola',
  visited:      'Visitado',
  do_not_visit: 'No visitar',
}

export const scoreColor = s => s >= 70 ? '#ef4444' : s >= 45 ? '#f59e0b' : s >= 20 ? '#22d3ee' : '#64748b'
export const scoreLabel = s => s >= 70 ? 'ALTO' : s >= 45 ? 'MEDIO' : 'BAJO'

// Storage keys
export const SK = {
  targets:   'rp:targets_v3',
  locs:      'rp:locs',
  settings:  'rp:settings',
  activeTer: 'rp:activeTer',
  visits:    'rp:visits',
}
