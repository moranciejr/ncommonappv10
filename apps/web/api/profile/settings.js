import { neon } from '@neondatabase/serverless';
import { createClient } from '@supabase/supabase-js';

const sql = neon(process.env.DATABASE_URL);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getUserFromRequest(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export default async function handler(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const userId = user.id;

  if (req.method === 'GET') {
    try {
      const rows = await sql(
        `SELECT p.user_id, p.display_name, p.bio, p.avatar_url,
                p.city, p.state, p.show_age, p.is_minor,
                p.hide_minors, p.only_verified,
                p.default_plan_expires_minutes,
                p.default_desired_group_size,
                p.default_desired_gender,
                p.onboarding_completed_at,
                COALESCE(
                  (SELECT array_agg(interest) FROM user_interests WHERE user_id = p.user_id),
                  '{}'::text[]
                ) AS interests
         FROM user_profiles p
         WHERE p.user_id = $1
         LIMIT 1`,
        [userId]
      );

      const profile = rows?.[0];

      if (!profile) {
        return res.status(200).json({ ok: true, profile: null });
      }

      return res.status(200).json({
        ok: true,
        profile: {
          userId: profile.user_id,
          displayName: profile.display_name || '',
          bio: profile.bio || '',
          avatarUrl: profile.avatar_url || '',
          city: profile.city || '',
          state: profile.state || '',
          showAge: profile.show_age !== false,
          isMinor: !!profile.is_minor,
          hideMinors: !!profile.hide_minors,
          onlyVerified: !!profile.only_verified,
          defaultPlanExpiresMinutes: profile.default_plan_expires_minutes || 120,
          defaultDesiredGroupSize: profile.default_desired_group_size || null,
          defaultDesiredGender: profile.default_desired_gender || 'any',
          onboardingCompletedAt: profile.onboarding_completed_at || null,
          interests: profile.interests || [],
        },
      });
    } catch (err) {
      console.error('GET /api/profile/settings error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    try {
      const body = req.body || {};

      await sql(
        `INSERT INTO user_profiles (user_id, display_name, bio, avatar_url, city, state, show_age,
          hide_minors, only_verified, default_plan_expires_minutes,
          default_desired_group_size, default_desired_gender)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (user_id) DO UPDATE SET
           display_name = COALESCE(EXCLUDED.display_name, user_profiles.display_name),
           bio = COALESCE(EXCLUDED.bio, user_profiles.bio),
           avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
           city = COALESCE(EXCLUDED.city, user_profiles.city),
           state = COALESCE(EXCLUDED.state, user_profiles.state),
           show_age = COALESCE(EXCLUDED.show_age, user_profiles.show_age),
           hide_minors = COALESCE(EXCLUDED.hide_minors, user_profiles.hide_minors),
           only_verified = COALESCE(EXCLUDED.only_verified, user_profiles.only_verified),
           default_plan_expires_minutes = COALESCE(EXCLUDED.default_plan_expires_minutes, user_profiles.default_plan_expires_minutes),
           default_desired_group_size = COALESCE(EXCLUDED.default_desired_group_size, user_profiles.default_desired_group_size),
           default_desired_gender = COALESCE(EXCLUDED.default_desired_gender, user_profiles.default_desired_gender)`,
        [
          userId,
          body.displayName || null,
          body.bio || null,
          body.avatarUrl || null,
          body.city || null,
          body.state || null,
          body.showAge !== undefined ? body.showAge : null,
          body.hideMinors !== undefined ? body.hideMinors : null,
          body.onlyVerified !== undefined ? body.onlyVerified : null,
          body.defaultPlanExpiresMinutes || null,
          body.defaultDesiredGroupSize || null,
          body.defaultDesiredGender || null,
        ]
      );

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('POST /api/profile/settings error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
