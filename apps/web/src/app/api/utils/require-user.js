import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getUserFromRequest(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '').trim();

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  return { user, userId: user.id, session: { user } };
}

export async function requireUser(sql, request) {
  return getUserFromRequest(request);
}

export async function requireOnboardedUser(sql, request) {
  const result = await getUserFromRequest(request);
  if (result.error) return result;

  const { userId } = result;

  const rows = await sql(
    `SELECT user_id, onboarding_completed_at, display_name
     FROM user_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  const profile = rows?.[0];

  if (!profile) {
    return { ...result, onboardingCompleted: false };
  }

  return {
    ...result,
    onboardingCompleted: !!profile.onboarding_completed_at,
    displayName: profile.display_name || '',
  };
}

export async function requireVerifiedOnboardedUser(sql, request) {
  const result = await requireOnboardedUser(sql, request);
  if (result.error) return result;

  const emailVerified = result.user?.email_confirmed_at || result.user?.confirmed_at;
  if (!emailVerified) {
    return { error: 'Email verification required', status: 403 };
  }

  return result;
}
