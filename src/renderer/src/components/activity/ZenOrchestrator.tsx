import { useEffect, useRef } from 'react'
import { useZenStore } from '../../store/useZenStore'
import { useMusicStore } from '../../store/useMusicStore'
import { useUIStore } from '../../store/useUIStore'
import { useSettingsStore } from '../../store/useSettingsStore'

export const ZenOrchestrator = () => {
  const addToast = useUIStore((s) => s.addToast)
  const setVibe = useMusicStore((s) => s.setVibe)
  const isZenMode = useZenStore((s) => s.isZenMode)

  const reportedPomodoro = useRef(false)
  const lastReportedHour = useRef(0)

  useEffect(() => {
    if (isZenMode) {
      const settings = useSettingsStore.getState()
      const apiKey = settings.lyriaApiKey
      const useOAuth = settings.geminiOAuthActive

      if (!useOAuth && !apiKey?.trim()) {
        addToast(
          'Please connect Gemini via OAuth or set an API key in Settings to use Zen Vibe Mode.',
          'warning'
        )
        return
      }
      setVibe('focus')
      // Only generate if Lyria isn't already playing the right vibe, or let's just generate a new one
      ;(window as any).api?.music?.generate?.({
        model: 'lyria-3-pro-preview',
        prompt: 'Deep Focus (ambient/lo-fi), smooth ambient lo-fi beat for deep work',
        instrumental: true,
        apiKey: apiKey?.trim(),
        useGeminiOAuth: useOAuth
      })
      useMusicStore.getState().setIsLyriaPlaying(true)
      useUIStore.getState().setVibePlayerOpen(true)
    }
  }, [isZenMode, setVibe, addToast])

  useEffect(() => {
    const interval = setInterval(() => {
      const zenState = useZenStore.getState()
      zenState.incrementCodingTime(1)

      if (!zenState.isBreak) {
        const nextTimer = zenState.timer - 1
        zenState.setTimer(nextTimer)

        if (nextTimer <= 0 && !reportedPomodoro.current) {
          reportedPomodoro.current = true

          setVibe('upbeat')
          if (useMusicStore.getState().isLyriaPlaying) {
            const settings = useSettingsStore.getState()
            const apiKey = settings.lyriaApiKey
            const useOAuth = settings.geminiOAuthActive

            if (useOAuth || apiKey?.trim()) {
              ;(window as any).api?.music?.generate?.({
                model: 'lyria-3-pro-preview',
                prompt: 'An upbeat high energy electronic focus track for coding',
                instrumental: true,
                apiKey: apiKey?.trim(),
                useGeminiOAuth: useOAuth
              })
            }
          }
          addToast('Pomodoro cycle complete! Entering Upbeat Mode ⚡', 'zen-upbeat')

          // Reset timer automatically for next pomodoro
          zenState.resetTimer(25 * 60)

          reportedPomodoro.current = false
        }
      }

      const currentCodingTime = useZenStore.getState().continuousCodingTime
      // 7200 seconds = 2 hours
      const hours = Math.floor(currentCodingTime / 7200)
      if (hours > lastReportedHour.current && hours > 0) {
        lastReportedHour.current = hours
        addToast(
          "You've been coding for 2 hours, go grab some water, I'll review this code for you!",
          'zen-chill'
        )
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [addToast, setVibe])

  return null
}
