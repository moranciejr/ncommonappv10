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
        `SELECT p.user_id, p.display_name, p.bio, p.avatar_url, p.city,
                p.state, p.onboarding_completed_at, p.show_age,
                p.default_plan_expires_minutes,
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
        return res.status(200).json({
          ok: true,
          onboarding: {
            completed: false,
            profile: null,
            interests: [],
          }
        });
      }

      return res.status(200).json({
        ok: true,
        onboarding: {
          completed: !!profile.onboarding_completed_at,
          profile: {
            displayName: profile.display_name || '',
            bio: profile.bio || '',
            avatarUrl: profile.avatar_url || '',
            city: profile.city || '',
            state: profile.state || '',
            showAge: profile.show_age !== false,
          },
          interests: profile.interests || [],
        }
      });
    } catch (err) {
      console.error('GET /api/onboarding/status error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
