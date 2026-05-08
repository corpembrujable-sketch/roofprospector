// src/lib/useGoogleMaps.js
//
// Loads the Google Maps JS SDK once, dynamically.
// Uses VITE_GOOGLE_MAPS_PUBLIC_KEY from .env.local / Vercel env vars.
//
// Usage:
//   const googleReady = useGoogleMaps()
//   // googleReady === true when window.google.maps.places is available

import { useState, useEffect } from 'react'

const CALLBACK = '__googleMapsReady'
let loadState = 'idle' // 'idle' | 'loading' | 'ready' | 'error'
const listeners = []

function notifyAll() {
  listeners.forEach(fn => fn())
  listeners.length = 0
}

export function loadGoogleMapsSDK() {
  if (loadState === 'ready')   return Promise.resolve()
  if (loadState === 'error')   return Promise.reject(new Error('Google Maps failed to load'))
  if (loadState === 'loading') return new Promise((res, rej) => listeners.push(() => loadState === 'ready' ? res() : rej()))

  const key = import.meta.env.VITE_GOOGLE_MAPS_PUBLIC_KEY
  if (!key) {
    console.warn('VITE_GOOGLE_MAPS_PUBLIC_KEY not set -- Google Places Autocomplete disabled')
    loadState = 'error'
    return Promise.reject(new Error('No API key'))
  }

  loadState = 'loading'

  return new Promise((resolve, reject) => {
    window[CALLBACK] = () => {
      loadState = 'ready'
      notifyAll()
      resolve()
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&callback=${CALLBACK}&loading=async`
    script.async = true
    script.defer = true
    script.onerror = () => {
      loadState = 'error'
      notifyAll()
      reject(new Error('Google Maps SDK failed to load. Check your API key and HTTP referrer restrictions.'))
    }
    document.head.appendChild(script)
  })
}

export default function useGoogleMaps() {
  const [ready, setReady] = useState(loadState === 'ready')

  useEffect(() => {
    if (loadState === 'ready') { setReady(true); return }

    loadGoogleMapsSDK()
      .then(() => setReady(true))
      .catch(() => setReady(false))
  }, [])

  return ready
}
