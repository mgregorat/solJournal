import { createClient } from '@supabase/supabase-js';

let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdminInstance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase URL and Service Key are required for admin operations. Check your environment variables.');
    }

    supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        // These options are required for the service role client
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return supabaseAdminInstance;
}

/**
 * A Supabase client configured for server-side operations with admin privileges.
 * This client can bypass Row Level Security.
 * Make sure SUPABASE_SERVICE_KEY is set in your environment variables.
 */
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    const admin = getSupabaseAdmin();
    const value = (admin as any)[prop];
    return typeof value === 'function' ? value.bind(admin) : value;
  }
}); 