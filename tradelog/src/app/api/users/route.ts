import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { requireUser } from '@/app/lib/authorization';
import { throwHttp, withTiming } from '@/app/lib/http';

export async function POST(request: NextRequest) {
  return withTiming(request, async () => {
    // Single source of truth: bearer token -> Privy subject -> db user.
    const dbUser = await requireUser(request);
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', dbUser.id)
      .single();

    if (error || !user) {
      throwHttp("internal_error", "Failed to load user", 500);
    }

    return user;
  });
}
