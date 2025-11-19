import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

// Browser client with proper cookie handling for SSR
export function createClient() {
  return createBrowserClient(supabaseUrl!, supabaseKey!);
}

// Legacy export for backward compatibility
export const supabase = createClient();