import { createClient } from "@supabase/supabase-js";

// Retrieve Supabase URL and Key from environment variables.
const rawUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";

const rawKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

// Try to clean and validate URL / key
let supabaseUrl = "https://placeholder-project-id.supabase.co";
let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_key";

const cleanUrl = typeof rawUrl === "string" ? rawUrl.trim() : "";
const cleanKey = typeof rawKey === "string" ? rawKey.trim() : "";

const isValidUrl = (url: string) => {
  if (!url || url === "undefined" || url === "null") return false;
  try {
    new URL(url);
    return url.startsWith("http://") || url.startsWith("https://");
  } catch (e) {
    return false;
  }
};

const isKeyValid = (key: string) => {
  return typeof key === "string" && key !== "undefined" && key !== "null" && key.length > 30;
};

if (isValidUrl(cleanUrl) && isKeyValid(cleanKey)) {
  supabaseUrl = cleanUrl;
  supabaseAnonKey = cleanKey;
}

// Safely initialize the client inside a try-catch to prevent a white screen at import-time.
let supabaseInstance: any = null;
try {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
} catch (e) {
  console.error("Critical: Failed to generate Supabase client due to invalid configuration:", e);
}

export const supabase = supabaseInstance;

// Helper check to see if we have valid Supabase credentials
export const isSupabaseReady = (): boolean => {
  return (
    !!supabase &&
    isValidUrl(cleanUrl) &&
    !cleanUrl.includes("placeholder-project-id") &&
    isKeyValid(cleanKey)
  );
};

