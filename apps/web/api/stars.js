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
        `SELECT s.id, s.starred_user_id, s.created_at,
                p.display_name, p.avatar_url, p.bio,
                COALESCE(
                  (SELECT array_agg(i2.interest)
                   FROM user_interests i2
                   WHERE i2.user_id = s.starred_user_id
                     AND i2.interest IN (
                       SELECT interest FROM user_interests WHERE user_id = $1
                     )
                  ),
                  '{}'::text[]
                ) AS overlap_interests
         FROM user_stars s
         JOIN user_profiles p ON p.user_id = s.starred_user_id
         WHERE s.user_id = $1
         ORDER BY s.created_at DESC
         LIMIT 50`,
        [userId]
      );

      return res.status(200).json({
        ok: true,
        stars: (rows || []).map(r => ({
          id: r.id,
          starredUserId: r.starred_user_id,
          createdAt: r.created_at,
          displayName: r.display_name || '',
          avatarUrl: r.avatar_url || '',
          bio: r.bio || '',
          overlapInterests: r.overlap_interests || [],
          overlapCount: (r.overlap_interests || []).length,
        })),
      });
    } catch (err) {
      console.error('GET /api/stars error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const starredUserId = body.userId;
      if (!starredUserId) return res.status(400).json({ error: 'userId is required' });

      await sql(
        `INSERT INTO user_stars (user_id, starred_user_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, starred_user_id) DO NOTHING`,
        [userId, starredUserId]
      );

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('POST /api/stars error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const starredUserId = req.query.userId;
      if (!starredUserId) return res.status(400).json({ error: 'userId is required' });

      await sql(
        `DELETE FROM user_stars WHERE user_id = $1 AND starred_user_id = $2`,
        [userId, starredUserId]
      );

      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/stars error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
