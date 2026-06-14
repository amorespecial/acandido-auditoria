import { createClient } from "@supabase/supabase-js";

// Retrieve Supabase URL and Key from environment variables.
// Use direct import.meta.env lines to allow Vite's bundler to perform static replacement during production build.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://placeholder-project-id.supabase.co";

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper check to see if we have valid Supabase credentials
export const isSupabaseReady = (): boolean => {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.length > 0 &&
    !supabaseUrl.includes("placeholder-project-id") &&
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.length > 30
  );
};
