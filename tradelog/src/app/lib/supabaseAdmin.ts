import { createClient } from '@supabase/supabase-js';

function createFreshSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase URL and Service Key are required for admin operations. Check your environment variables.');
  }

  // Always create a fresh client to avoid any caching issues
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        // Add a unique header to force fresh connections
        'x-request-id': `fresh-${Date.now()}-${Math.random()}`
      }
    }
  });
}

/**
 * A Supabase client configured for server-side operations with admin privileges.
 * This client can bypass Row Level Security and creates fresh connections for each request.
 * Make sure SUPABASE_SERVICE_KEY is set in your environment variables.
 */
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    const admin = createFreshSupabaseAdmin();
    const value = (admin as any)[prop];
    return typeof value === 'function' ? value.bind(admin) : value;
  }
}); 