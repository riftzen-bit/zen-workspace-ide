import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Cloud, Sun, CloudRain, CloudLightning, Snowflake, Edit2 } from 'lucide-react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useUIStore } from '../../store/useUIStore'

interface LocationData {
  city: string
  country: string
  latitude: number
  longitude: number
  timezone: string
}

const WMO_CODES: Record<number, { text: string; icon: any }> = {
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

  const fetchLocationData = useCallback(async () => {
    setLoading(true)
    try {
      let locData: LocationData

      if (customLocation && customLocation.trim() !== '') {
        // Geocode custom location
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            customLocation
          )}&count=1&language=en&format=json`
        )
        const data = await res.json()
        if (data.results && data.results.length > 0) {
          const r = data.results[0]
          locData = {
            city: r.name,
            country: r.country || '',
            latitude: r.latitude,
            longitude: r.longitude,
            timezone: r.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
          }
        } else {
          // Fallback if not found
          throw new Error('Location not found')
        }
      } else {
        // IP-based location
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json')
        const data = await res.json()
        locData = {
          city: data.city,
          country: data.country,
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          timezone: data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      }

      setLocation(locData)

      // Fetch Weather
      const wRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${locData.latitude}&longitude=${locData.longitude}&current=temperature_2m,weather_code`
      )
      const wData = await wRes.json()
      if (wData.current) {
        setWeather({
          temp: Math.round(wData.current.temperature_2m),
          code: wData.current.weather_code
        })
      }
    } catch (error) {
      console.error('Failed to fetch weather/location', error)
    } finally {
      setLoading(false)
    }
  }, [customLocation])

  useEffect(() => {
    fetchLocationData()
    // Refresh weather every 30 mins
    const interval = setInterval(fetchLocationData, 30 * 60 * 1000)
    return () => clearInterval(interval)
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
        // Fallback to local if timezone is invalid
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
      className="absolute top-6 right-8 flex flex-col items-end gap-2 z-20"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
    >
      <div className="flex items-center gap-4 bg-black/20 backdrop-blur-md border border-white/5 px-4 py-2.5 rounded-none shadow-xl">
        {/* Time */}
        <div className="flex flex-col items-end">
          <span className="text-[22px] font-semibold tracking-tight text-white leading-none">
            {timeStr || '...'}
          </span>
          <span className="text-[11px] font-medium text-zinc-400 mt-1 uppercase tracking-wider">
            {dateStr}
          </span>
        </div>

        <div className="w-px h-8 bg-white/10" />

        {/* Weather & Location */}
        <div className="flex flex-col items-start min-w-[100px]">
          <div className="flex items-center gap-1.5 text-zinc-200">
            {loading ? (
              <span className="text-[13px] text-zinc-500">Loading...</span>
            ) : weather ? (
              <>
                <WeatherIcon size={14} className="text-[#00f3ff]" />
                <span className="text-[13px] font-medium">{weather.temp}°C</span>
                <span className="text-[12px] text-zinc-500 ml-1 truncate max-w-[80px]">
                  {weatherText}
                </span>
              </>
            ) : (
              <span className="text-[13px] text-zinc-500">No data</span>
            )}
          </div>

          <button
            onClick={handleEditLocation}
            className="group flex items-center gap-1 mt-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <MapPin size={10} />
            <span className="truncate max-w-[120px]">
              {location
                ? `${location.city}${location.country ? `, ${location.country}` : ''}`
                : 'Auto-detecting...'}
            </span>
            <Edit2
              size={10}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
            />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

