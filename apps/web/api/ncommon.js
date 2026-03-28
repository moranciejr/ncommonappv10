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

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const userId = user.id;
    const targetUserId = req.query.userId || null;

    if (targetUserId) {
      // Get overlap between current user and target user
      const rows = await sql(
        `SELECT i1.interest
         FROM user_interests i1
         JOIN user_interests i2 ON i1.interest = i2.interest
         WHERE i1.user_id = $1 AND i2.user_id = $2`,
        [userId, targetUserId]
      );

      const overlapInterests = (rows || []).map(r => r.interest);
      return res.status(200).json({
        ok: true,
        overlapCount: overlapInterests.length,
        overlapInterests,
      });
    }

    // Get nearby users with shared interests
    const rows = await sql(
      `SELECT p.user_id, p.display_name, p.avatar_url, p.bio,
              COALESCE(
                (SELECT array_agg(i2.interest)
                 FROM user_interests i2
                 WHERE i2.user_id = p.user_id
                   AND i2.interest IN (
                     SELECT interest FROM user_interests WHERE user_id = $1
                   )
                ),
                '{}'::text[]
              ) AS overlap_interests
       FROM user_profiles p
       WHERE p.user_id != $1
         AND p.onboarding_completed_at IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM user_interests i2
           WHERE i2.user_id = p.user_id
             AND i2.interest IN (
               SELECT interest FROM user_interests WHERE user_id = $1
             )
         )
       LIMIT 30`,
      [userId]
    );

    return res.status(200).json({
      ok: true,
      users: (rows || []).map(r => ({
        userId: r.user_id,
        displayName: r.display_name || '',
        avatarUrl: r.avatar_url || '',
        bio: r.bio || '',
        overlapInterests: r.overlap_interests || [],
        overlapCount: (r.overlap_interests || []).length,
      })),
    });
  } catch (err) {
    console.error('GET /api/ncommon error', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
