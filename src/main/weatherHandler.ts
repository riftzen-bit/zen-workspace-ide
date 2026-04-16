import { ipcMain } from 'electron'
import { isTrustedIpcSender } from './security'

const FETCH_TIMEOUT_MS = 8000
const USER_AGENT = 'ZenWorkspace/1.1.6 (+https://github.com/riftzen-bit/zen-workspace-ide)'

export interface WeatherGeocodeResult {
  city: string
  country: string
  latitude: number
  longitude: number
  timezone: string
}

export interface WeatherCurrent {
  temp: number
  code: number
}

type WeatherResponse<T> = { ok: true; data: T } | { ok: false; error: string }

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}

function parseCoords(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  const la = typeof lat === 'string' ? parseFloat(lat) : lat
  const lo = typeof lon === 'string' ? parseFloat(lon) : lon
  if (typeof la !== 'number' || typeof lo !== 'number') return null
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null
  return { lat: la, lon: lo }
}

export function setupWeatherHandlers(): void {
  ipcMain.handle(
    'weather:geocode',
    async (event, query: string): Promise<WeatherResponse<WeatherGeocodeResult | null>> => {
      if (!isTrustedIpcSender(event)) return { ok: false, error: 'Untrusted sender' }
      if (typeof query !== 'string' || query.trim().length === 0) {
        return { ok: false, error: 'Invalid query' }
      }

      const safe = query.trim().slice(0, 120)
      const url =
        'https://geocoding-api.open-meteo.com/v1/search?' +
        `name=${encodeURIComponent(safe)}&count=1&language=en&format=json`

      try {
        const data = await fetchJson<{
          results?: Array<{
            name: string
            country?: string
            latitude: number
            longitude: number
            timezone?: string
          }>
        }>(url)

        const first = data.results?.[0]
        if (!first) return { ok: true, data: null }
        const coords = parseCoords(first.latitude, first.longitude)
        if (!coords) return { ok: true, data: null }

        return {
          ok: true,
          data: {
            city: String(first.name),
            country: String(first.country ?? ''),
            latitude: coords.lat,
            longitude: coords.lon,
            timezone: typeof first.timezone === 'string' ? first.timezone : ''
          }
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle(
    'weather:ipLocate',
    async (event): Promise<WeatherResponse<WeatherGeocodeResult>> => {
      if (!isTrustedIpcSender(event)) return { ok: false, error: 'Untrusted sender' }

      try {
        const data = await fetchJson<{
          city?: string
          country?: string
          latitude?: string | number
          longitude?: string | number
          timezone?: string
        }>('https://get.geojs.io/v1/ip/geo.json')

        const coords = parseCoords(data.latitude, data.longitude)
        if (!coords) {
          return { ok: false, error: 'Invalid IP location response' }
        }

        return {
          ok: true,
          data: {
            city: String(data.city ?? ''),
            country: String(data.country ?? ''),
            latitude: coords.lat,
            longitude: coords.lon,
            timezone: typeof data.timezone === 'string' ? data.timezone : ''
          }
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  ipcMain.handle(
    'weather:current',
    async (
      event,
      latitude: number,
      longitude: number
    ): Promise<WeatherResponse<WeatherCurrent>> => {
      if (!isTrustedIpcSender(event)) return { ok: false, error: 'Untrusted sender' }
      const coords = parseCoords(latitude, longitude)
      if (!coords) {
        return { ok: false, error: 'Invalid coordinates' }
      }

      const url =
        'https://api.open-meteo.com/v1/forecast?' +
        `latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,weather_code`

      try {
        const data = await fetchJson<{
          current?: { temperature_2m?: number; weather_code?: number }
        }>(url)

        const current = data.current
        if (
          !current ||
          typeof current.temperature_2m !== 'number' ||
          typeof current.weather_code !== 'number'
        ) {
          return { ok: false, error: 'No current weather data' }
        }

        return {
          ok: true,
          data: {
            temp: Math.round(current.temperature_2m),
            code: current.weather_code
          }
        }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )
}
