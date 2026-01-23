"use client"

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import speedInsights from '@vercel/speed-insights'

// Lightweight wrapper to inject the Speed Insights script into the page
export default function SpeedInsights() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    try {
      // Construct a simple route value - for dynamic routes you could compute route with params
      const route = pathname || '/' 

      // Inject script. In production you can supply `dsn` or `endpoint` in props.
      const res = speedInsights.injectSpeedInsights({ route, debug: process.env.NODE_ENV === 'development' })
      // Log success for easier debugging in dev tools
      // eslint-disable-next-line no-console
      console.log('[Speed Insights] injected script for route', route, { res })
      // Optionally expose setRoute API on window (not necessary here)
    } catch (e) {
      // Do not crash the app if Speed Insights fails
      // eslint-disable-next-line no-console
      console.warn('Speed Insights injection failed', e)
    }
  }, [pathname, searchParams])

  return null
}
