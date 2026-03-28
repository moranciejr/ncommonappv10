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
      const summary = req.query.summary === '1';

      if (summary) {
        const rows = await sql(
          `SELECT COUNT(*)::int AS unread_count
           FROM notifications
           WHERE user_id = $1 AND read_at IS NULL`,
          [userId]
        );
        return res.status(200).json({ ok: true, unreadCount: rows?.[0]?.unread_count || 0 });
      }

      const rows = await sql(
        `SELECT id, type, title, body, data, read_at, created_at
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      );

      return res.status(200).json({ ok: true, notifications: rows || [] });
    } catch (err) {
      console.error('GET /api/notifications error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
