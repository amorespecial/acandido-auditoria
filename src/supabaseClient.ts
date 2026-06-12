import { createClient } from "@supabase/supabase-js";

// Retrieve Supabase URL and Key from environment variables.
// Use type casting to prevent TypeScript compilation issues with import.meta in some configurations.
const meta = import.meta as any;
const env = meta.env || {};

const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project-id.supabase.co";
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_key";

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
