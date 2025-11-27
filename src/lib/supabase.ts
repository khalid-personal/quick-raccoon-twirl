import { createClient } from '@supabase/supabase-js';

// Fallback to provided URL if environment variable is not set.
const FALLBACK_SUPABASE_URL = 'https://wvidkfyajuqzbkvddcat.supabase.co';
const MOCK_SUPABASE_ANON_KEY = 'mock-anon-key'; // Keep mock key until provided

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || MOCK_SUPABASE_ANON_KEY;

if (supabaseAnonKey === MOCK_SUPABASE_ANON_KEY) {
  console.warn("WARNING: Using mock Supabase Anon Key. Real authentication will fail until VITE_SUPABASE_ANON_KEY is set.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);