import { createClient } from '@supabase/supabase-js';

// NOTE: Temporarily hardcoding URL to bypass environment variable loading issue.
const supabaseUrl = 'https://wvidkfyajuqzbkvddcat.supabase.co';
const supabaseAnonKey = 'YOUR_ACTUAL_ANON_KEY_HERE'; 

if (supabaseAnonKey === 'YOUR_ACTUAL_ANON_KEY_HERE') {
  console.warn("WARNING: Supabase Anon Key is still a placeholder. Please update src/lib/supabase.ts with your actual key.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);