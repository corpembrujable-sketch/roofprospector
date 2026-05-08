# RoofProspector

Sistema de prospectacion de techos para Raleigh NC.
Solo direcciones verificadas por Google Places -- sin datos mock.

---

## Stack

- **Frontend**: React 18 + Vite
- **Backend proxy**: Vercel Serverless Functions (`/api/maps.js`)
- **Storage**: localStorage (por usuario, por dispositivo)
- **Maps**: Google Geocoding API + Places API + Maps JS SDK

---

## DEPLOY EN VERCEL -- PASO A PASO

### Paso 1: Obtener Google API Key

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un proyecto nuevo o usa uno existente
3. Ve a **APIs & Services > Library** y habilita:
   - `Geocoding API`
   - `Places API`
   - `Maps JavaScript API`
4. Ve a **APIs & Services > Credentials > Create Credentials > API Key**
5. Copia la key -- la necesitaras en el paso 3

**Restricciones recomendadas** (despues de deploy):
- Application restrictions: HTTP referrers
- Add: `https://tu-app.vercel.app/*`
- API restrictions: Geocoding API, Places API, Maps JavaScript API

---

### Paso 2: Subir el codigo a GitHub

```bash
# En la carpeta del proyecto
git init
git add .
git commit -m "RoofProspector v1.0"

# Crea un repo en github.com, luego:
git remote add origin https://github.com/TU_USUARIO/roofprospector.git
git push -u origin main
```

---

### Paso 3: Conectar a Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesion con GitHub
2. Click **Add New Project**
3. Importa el repo `roofprospector`
4. En **Configure Project**:
   - Framework Preset: **Vite**
   - Root Directory: `.` (raiz)
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. En **Environment Variables**, agrega:

   | Name | Value |
   |------|-------|
   | `GOOGLE_MAPS_API_KEY` | `AIzaSy...` (tu key del paso 1) |
   | `VITE_GOOGLE_MAPS_PUBLIC_KEY` | `AIzaSy...` (misma key o una separada) |

6. Click **Deploy**

Vercel detecta automaticamente la carpeta `/api` y despliega `maps.js` como serverless function.

---

### Paso 4: Configurar dominio (opcional)

En Vercel > Settings > Domains, agrega tu dominio o usa el subdominio gratuito `*.vercel.app`.

Actualiza las restricciones de la API key en Google Cloud para incluir tu dominio final.

---

## DESARROLLO LOCAL

```bash
npm install

# Crea .env.local con tu API key
cp .env.example .env.local
# Edita .env.local y pon tu GOOGLE_MAPS_API_KEY

npm run dev
# App en http://localhost:5173
# El proxy /api/maps funciona automaticamente via vite.config.js
```

---

## ARQUITECTURA DE SEGURIDAD

```
Browser (React)
      |
      | fetch('/api/maps?endpoint=geocode&address=...')
      |
Vercel Edge (api/maps.js)          <-- API key nunca sale de aqui
      |
      | fetch('https://maps.googleapis.com/...?key=SECRET')
      |
Google Maps API
```

- El cliente NUNCA ve `GOOGLE_MAPS_API_KEY`
- `VITE_GOOGLE_MAPS_PUBLIC_KEY` es la key para el SDK de JS (autocomplete widget)
  y debe estar restringida por HTTP referrer en Google Cloud

---

## ESTRUCTURA DEL PROYECTO

```
roofprospector/
??? api/
?   ??? maps.js              # Proxy serverless -- Google Maps backend
??? src/
?   ??? lib/
?   ?   ??? constants.js     # Territorios, ZIPs, defaults
?   ?   ??? storage.js       # localStorage helpers
?   ?   ??? geo.js           # Territory validation, target factory
?   ?   ??? maps.js          # validateAddress, importBuildings (client)
?   ?   ??? routing.js       # TSP optimization engine
?   ??? components/
?   ?   ??? Login.jsx
?   ?   ??? Sidebar.jsx
?   ?   ??? Toast.jsx
?   ?   ??? Targets.jsx      # Add house + Import buildings + List
?   ?   ??? Detail.jsx       # Target detail + visits + signals
?   ?   ??? Planner.jsx      # Route optimization + map + AM/PM split
?   ?   ??? Visits.jsx       # Visit history
?   ?   ??? Settings.jsx     # Defaults + data cleanup
?   ??? App.jsx              # Root + state + routing
?   ??? index.css            # Global styles
?   ??? main.jsx             # ReactDOM entry
??? index.html
??? vite.config.js
??? vercel.json
??? package.json
??? .env.example
```

---

## FUNCIONES CLAVE

### validateAddress(query, territory)
Llama `/api/maps?endpoint=geocode`. Valida que la direccion:
1. Existe en Google (no ZERO_RESULTS)
2. No es APPROXIMATE (requiere numero de calle)
3. Pertenece al territorio activo (ZIP o proximidad)

Lanza error con mensaje en espanol si falla.

### importBuildingsForTerritory(territory, existingPlaceIds)
Llama `/api/maps?endpoint=textsearch` con 4 queries:
apartments, condominiums, HOA, property management.
Solo guarda resultados con `place_id` real de Google dentro del territorio.

### createTargetFromValidatedAddress(geo, meta)
Factory que garantiza `address_verified: true`, `created_by_seed: false`.

### removeDummyTargets(targets)
Filtra targets con `address_verified !== true` o `created_by_seed === true`.
Se ejecuta automaticamente en cada carga de la app.

### optimizeRoute(startLoc, targets, tid, opts)
- Filtra solo `address_verified: true` y dentro del territorio
- Excluye `do_not_visit`, visitados recientes, score bajo
- Algoritmo: Farthest-first NN + 2-opt round-trip
- Primera parada = mas lejana de casa
- Ultima parada = mas cercana a casa

---

## DATOS GUARDADOS POR TARGET

```js
{
  id:               "tgt_1234_abc",
  name:             "Oak Creek Apartments",
  type:             "building",           // "building" | "house"
  subtype:          "apartments",
  place_id:         "ChIJxxxxxxxxx",      // Google Places ID real
  formatted_address:"1234 Oak Creek Dr, Raleigh, NC 27615, USA",
  address_verified: true,                 // siempre true si esta en el sistema
  data_source:      "places",             // "places" | "manual_verified"
  created_by_seed:  false,               // siempre false
  lat:              35.900,
  lng:              -78.628,
  city:             "Raleigh",
  state:            "NC",
  zip:              "27615",
  tid:              "t1",               // territorio
  yr:               null,
  tree:             0,
  score:            45,
  status:           "new",
  lastVisit:        null,
  sigs:             [],
  reasons:          [],
  createdAt:        "2025-01-01T00:00:00Z"
}
```
