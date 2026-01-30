import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabaseServer: SupabaseClient | null = null

export function getSupabaseServer(): SupabaseClient {
  if (_supabaseServer) return _supabaseServer

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase server environment variables (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)')
  }

  _supabaseServer = createClient(url, serviceKey, {
    auth: { persistSession: false }
  })

  return _supabaseServer
}
