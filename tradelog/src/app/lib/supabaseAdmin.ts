import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase URL and Service Key are required for admin operations. Check your environment variables.');
}

/**
 * A Supabase client configured for server-side operations with admin privileges.
 * This client can bypass Row Level Security.
 * Make sure SUPABASE_SERVICE_KEY is set in your environment variables.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    // These options are required for the service role client
    autoRefreshToken: false,
    persistSession: false
  }
}); 