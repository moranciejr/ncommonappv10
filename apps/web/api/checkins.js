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
        `SELECT c.id, c.user_id, c.location_name, c.note, c.lat, c.lng,
                c.starts_at, c.expires_at, c.created_at, c.interest,
                c.desired_group_size, c.desired_gender,
                p.display_name, p.avatar_url
         FROM checkins c
         JOIN user_profiles p ON p.user_id = c.user_id
         WHERE c.expires_at > NOW()
           AND p.onboarding_completed_at IS NOT NULL
         ORDER BY c.created_at DESC
         LIMIT 80`,
        []
      );

      const checkins = (rows || []).map(r => ({
        id: r.id,
        userId: r.user_id,
        locationName: r.location_name,
        note: r.note || '',
        lat: r.lat === null ? null : Number(r.lat),
        lng: r.lng === null ? null : Number(r.lng),
        startsAt: r.starts_at || null,
        expiresAt: r.expires_at,
        createdAt: r.created_at,
        interest: r.interest || '',
        desiredGroupSize: r.desired_group_size === null ? null : Number(r.desired_group_size),
        desiredGender: r.desired_gender || null,
        displayName: r.display_name || '',
        avatarUrl: r.avatar_url || '',
        isMine: r.user_id === userId,
        myRequest: null,
        pendingRequestCount: 0,
      }));

      return res.status(200).json({ ok: true, checkins });
    } catch (err) {
      console.error('GET /api/checkins error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const locationName = (body.locationName || '').trim().slice(0, 160);
      const note = (body.note || '').trim().slice(0, 280);
      const interest = (body.interest || '').toLowerCase().slice(0, 64);
      const lat = typeof body.lat === 'number' ? body.lat : null;
      const lng = typeof body.lng === 'number' ? body.lng : null;
      const desiredGroupSize = body.desiredGroupSize || null;
      const desiredGender = body.desiredGender || null;
      const expiresInMinutes = body.expiresInMinutes || 120;
      const startsAt = body.startsAt ? new Date(body.startsAt) : new Date();
      const expiresAt = new Date(startsAt.getTime() + expiresInMinutes * 60 * 1000);

      if (!locationName) return res.status(400).json({ error: 'Location name is required' });

      const inserted = await sql(
        `INSERT INTO checkins (user_id, location_name, note, lat, lng, interest,
          desired_group_size, desired_gender, starts_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [userId, locationName, note, lat, lng, interest || null,
         desiredGroupSize, desiredGender, startsAt.toISOString(), expiresAt.toISOString()]
      );

      return res.status(200).json({ ok: true, id: inserted?.[0]?.id });
    } catch (err) {
      console.error('POST /api/checkins error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
