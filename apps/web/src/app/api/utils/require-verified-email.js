import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export function buildVerifyNudge({ title, message, reason }) {
  return {
    title: title || 'Verify your email',
    message: message || 'Please verify your email to continue.',
    primaryCta: 'Verify email',
    secondaryCta: 'Not now',
    target: '/verify-email',
    reason: reason || 'email_verify_required',
  };
}

export async function requireVerifiedOnboardedUser(sql, request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: 'Unauthorized', status: 401 };
  }

  const emailVerified = user.email_confirmed_at || user.confirmed_at;
  if (!emailVerified) {
    return { error: 'Email verification required', status: 403 };
  }

  const rows = await sql(
    `SELECT user_id, onboarding_completed_at, display_name
     FROM user_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [user.id]
  );

  return {
    user,
    userId: user.id,
    session: { user },
    onboardingCompleted: !!rows?.[0]?.onboarding_completed_at,
    displayName: rows?.[0]?.display_name || '',
  };
}
