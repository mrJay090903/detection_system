import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { type NextRequest } from 'next/server'

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-url', request.url)

  return Response.json(
    { success: true },
    {
      headers: requestHeaders,
    }
  )
}