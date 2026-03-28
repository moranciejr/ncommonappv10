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
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = parseFloat(req.query.radiusKm) || 10;
    const interest = req.query.interest || null;

    if (!isFinite(lat) || !isFinite(lng)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const interestFilter = interest ? `AND c.interest = $5` : '';
    const params = interest
      ? [userId, lat, lng, radiusKm, interest]
      : [userId, lat, lng, radiusKm];

    const users = await sql(
      `SELECT c.id, c.user_id, c.location_name, c.note, c.lat, c.lng,
              c.starts_at, c.expires_at, c.interest,
              c.desired_group_size, c.desired_gender,
              p.display_name, p.avatar_url,
              mr.id AS my_request_id,
              mr.status AS my_request_status,
              (6371 * acos(
                cos(radians($2)) * cos(radians(c.lat)) *
                cos(radians(c.lng) - radians($3)) +
                sin(radians($2)) * sin(radians(c.lat))
              )) AS distance_km
       FROM checkins c
       JOIN user_profiles p ON p.user_id = c.user_id
       LEFT JOIN checkin_requests mr
         ON mr.checkin_id = c.id AND mr.requester_user_id = $1
       WHERE c.expires_at > NOW()
         AND p.onboarding_completed_at IS NOT NULL
         AND c.lat IS NOT NULL AND c.lng IS NOT NULL
         ${interestFilter}
       HAVING (6371 * acos(
         cos(radians($2)) * cos(radians(c.lat)) *
         cos(radians(c.lng) - radians($3)) +
         sin(radians($2)) * sin(radians(c.lat))
       )) <= $4
       ORDER BY distance_km ASC
       LIMIT 50`,
      params
    );

    const events = await sql(
      `SELECT e.id, e.title, e.description, e.lat, e.lng,
              e.starts_at, e.ends_at, e.interest,
              e.host_user_id,
              p.display_name AS host_display_name,
              (6371 * acos(
                cos(radians($1)) * cos(radians(e.lat)) *
                cos(radians(e.lng) - radians($2)) +
                sin(radians($1)) * sin(radians(e.lat))
              )) AS distance_km
       FROM events e
       JOIN user_profiles p ON p.user_id = e.host_user_id
       WHERE e.ends_at > NOW()
         AND e.lat IS NOT NULL AND e.lng IS NOT NULL
       HAVING (6371 * acos(
         cos(radians($1)) * cos(radians(e.lat)) *
         cos(radians(e.lng) - radians($2)) +
         sin(radians($1)) * sin(radians(e.lat))
       )) <= $3
       ORDER BY distance_km ASC
       LIMIT 30`,
      [lat, lng, radiusKm]
    );

    return res.status(200).json({
      ok: true,
      users: (users || []).map(r => ({
        id: r.id,
        userId: r.user_id,
        locationName: r.location_name,
        note: r.note || '',
        lat: Number(r.lat),
        lng: Number(r.lng),
        startsAt: r.starts_at || null,
        expiresAt: r.expires_at,
        interest: r.interest || '',
        desiredGroupSize: r.desired_group_size ? Number(r.desired_group_size) : null,
        desiredGender: r.desired_gender || null,
        displayName: r.display_name || '',
        avatarUrl: r.avatar_url || '',
        distanceKm: Number(r.distance_km),
        myRequest: r.my_request_id ? {
          id: r.my_request_id,
          status: r.my_request_status,
          conversationId: null,
        } : null,
      })),
      events: (events || []).map(r => ({
        id: r.id,
        title: r.title || '',
        description: r.description || '',
        lat: Number(r.lat),
        lng: Number(r.lng),
        startsAt: r.starts_at || null,
        endsAt: r.ends_at || null,
        interest: r.interest || '',
        hostUserId: r.host_user_id,
        hostDisplayName: r.host_display_name || '',
        distanceKm: Number(r.distance_km),
      })),
      hotspots: [],
    });
  } catch (err) {
    console.error('GET /api/map/points error', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
