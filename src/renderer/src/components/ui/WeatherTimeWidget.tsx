import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  MapPin,
  Cloud,
  Sun,
  CloudRain,
  CloudLightning,
  Snowflake,
  Edit2,
  type LucideIcon
} from 'lucide-react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useUIStore } from '../../store/useUIStore'

interface LocationData {
  city: string
  country: string
  latitude: number
  longitude: number
  timezone: string
}

const WMO_CODES: Record<number, { text: string; icon: LucideIcon }> = {
  0: { text: 'Clear', icon: Sun },
  1: { text: 'Mostly Clear', icon: Sun },
  2: { text: 'Partly Cloudy', icon: Cloud },
  3: { text: 'Overcast', icon: Cloud },
  45: { text: 'Fog', icon: Cloud },
  48: { text: 'Rime Fog', icon: Cloud },
  51: { text: 'Light Drizzle', icon: CloudRain },
  53: { text: 'Drizzle', icon: CloudRain },
  55: { text: 'Heavy Drizzle', icon: CloudRain },
  61: { text: 'Light Rain', icon: CloudRain },
  63: { text: 'Rain', icon: CloudRain },
  65: { text: 'Heavy Rain', icon: CloudRain },
  71: { text: 'Light Snow', icon: Snowflake },
  73: { text: 'Snow', icon: Snowflake },
  75: { text: 'Heavy Snow', icon: Snowflake },
  95: { text: 'Thunderstorm', icon: CloudLightning }
}

export const WeatherTimeWidget = () => {
  const customLocation = useSettingsStore((s) => s.customLocation)
  const setCustomLocation = useSettingsStore((s) => s.setCustomLocation)
  const showPrompt = useUIStore((s) => s.showPrompt)

  const [timeStr, setTimeStr] = useState('')
  const [dateStr, setDateStr] = useState('')
  const [location, setLocation] = useState<LocationData | null>(null)
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchLocationData = useCallback(
    async (isCancelled: () => boolean) => {
      setLoading(true)
      try {
        const fallbackTz = Intl.DateTimeFormat().resolvedOptions().timeZone
        let locData: LocationData | null = null

        if (customLocation && customLocation.trim() !== '') {
          const res = await window.api.weather.geocode(customLocation)
          if (isCancelled()) return
          if (res.ok && res.data) {
            locData = {
              city: res.data.city,
              country: res.data.country,
              latitude: res.data.latitude,
              longitude: res.data.longitude,
              timezone: res.data.timezone || fallbackTz
            }
          }
        } else {
          const res = await window.api.weather.ipLocate()
          if (isCancelled()) return
          if (res.ok) {
            locData = {
              city: res.data.city,
              country: res.data.country,
              latitude: res.data.latitude,
              longitude: res.data.longitude,
              timezone: res.data.timezone || fallbackTz
            }
          }
        }

        if (!locData) {
          if (!isCancelled()) {
            setLocation(null)
            setWeather(null)
          }
          return
        }

        if (isCancelled()) return
        setLocation(locData)

        const wRes = await window.api.weather.current(locData.latitude, locData.longitude)
        if (isCancelled()) return
        if (wRes.ok) {
          setWeather({ temp: wRes.data.temp, code: wRes.data.code })
        } else {
          setWeather(null)
        }
      } catch (error) {
        if (!isCancelled()) console.error('Failed to fetch weather/location', error)
      } finally {
        if (!isCancelled()) setLoading(false)
      }
    },
    [customLocation]
  )

  useEffect(() => {
    let cancelled = false
    const isCancelled = () => cancelled
    fetchLocationData(isCancelled)
    const interval = setInterval(() => fetchLocationData(isCancelled), 30 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [fetchLocationData])

  useEffect(() => {
    const updateTime = () => {
      const d = new Date()
      const tOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true }
      const dOpts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' }

      if (location?.timezone) {
        tOpts.timeZone = location.timezone
        dOpts.timeZone = location.timezone
      }

      try {
        setTimeStr(new Intl.DateTimeFormat('en-US', tOpts).format(d))
        setDateStr(new Intl.DateTimeFormat('en-US', dOpts).format(d))
      } catch {
        delete tOpts.timeZone
        delete dOpts.timeZone
        setTimeStr(new Intl.DateTimeFormat('en-US', tOpts).format(d))
        setDateStr(new Intl.DateTimeFormat('en-US', dOpts).format(d))
      }
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [location])

  const handleEditLocation = async () => {
    const newLoc = await showPrompt(
      'Set your city/location (e.g. "Tokyo", "New York, US")',
      customLocation
    )
    if (newLoc !== null) {
      setCustomLocation(newLoc.trim())
    }
  }

  const WeatherIcon = weather ? WMO_CODES[weather.code]?.icon || Cloud : Cloud
  const weatherText = weather ? WMO_CODES[weather.code]?.text || 'Unknown' : ''

  return (
    <motion.div
      className="absolute top-3 right-3 sm:top-6 sm:right-8 flex flex-col items-end gap-2 z-20 max-w-[calc(100%-1.5rem)]"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
    >
      <div className="flex items-center gap-2 sm:gap-4 bg-black/20 backdrop-blur-md border border-white/5 px-2.5 py-2 sm:px-4 sm:py-2.5 rounded-none shadow-xl">
        <div className="flex flex-col items-end">
          <span className="text-[16px] sm:text-[22px] font-semibold tracking-tight text-white leading-none">
            {timeStr || '...'}
          </span>
          <span className="hidden sm:inline text-[11px] font-medium text-zinc-400 mt-1 uppercase tracking-wider">
            {dateStr}
          </span>
        </div>

        <div className="w-px h-6 sm:h-8 bg-white/10" />

        <div className="flex flex-col items-start min-w-0 sm:min-w-[100px]">
          <div className="flex items-center gap-1.5 text-zinc-200">
            {loading ? (
              <span className="text-[12px] sm:text-[13px] text-zinc-500">Loading...</span>
            ) : weather ? (
              <>
                <WeatherIcon size={14} className="text-[#00f3ff] shrink-0" />
                <span className="text-[12px] sm:text-[13px] font-medium">{weather.temp}°C</span>
                <span className="hidden md:inline text-[12px] text-zinc-500 ml-1 truncate max-w-[80px]">
                  {weatherText}
                </span>
              </>
            ) : (
              <span className="text-[12px] sm:text-[13px] text-zinc-500">No data</span>
            )}
          </div>

          <button
            onClick={handleEditLocation}
            className="group flex items-center gap-1 mt-1 text-[10px] sm:text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors min-w-0"
          >
            <MapPin size={10} className="shrink-0" />
            <span className="truncate max-w-[80px] sm:max-w-[120px]">
              {location
                ? `${location.city}${location.country ? `, ${location.country}` : ''}`
                : 'Auto-detecting...'}
            </span>
            <Edit2
              size={10}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0"
            />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
