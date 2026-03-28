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
        `SELECT c.id, c.created_at, c.updated_at,
                p.user_id AS other_user_id,
                p.display_name AS other_display_name,
                p.avatar_url AS other_avatar_url,
                m.body AS last_message,
                m.created_at AS last_message_at,
                m.sender_user_id AS last_sender_id
         FROM conversations c
         JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
         JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id != $1
         JOIN user_profiles p ON p.user_id = cp2.user_id
         LEFT JOIN LATERAL (
           SELECT body, created_at, sender_user_id
           FROM messages
           WHERE conversation_id = c.id
           ORDER BY created_at DESC
           LIMIT 1
         ) m ON true
         ORDER BY COALESCE(m.created_at, c.created_at) DESC
         LIMIT 50`,
        [userId]
      );

      return res.status(200).json({
        ok: true,
        conversations: (rows || []).map(r => ({
          id: r.id,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          otherUserId: r.other_user_id,
          otherDisplayName: r.other_display_name || '',
          otherAvatarUrl: r.other_avatar_url || '',
          lastMessage: r.last_message || '',
          lastMessageAt: r.last_message_at || null,
          lastSenderId: r.last_sender_id || null,
        })),
      });
    } catch (err) {
      console.error('GET /api/messages/conversations error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const targetUserId = body.targetUserId;
      if (!targetUserId) return res.status(400).json({ error: 'targetUserId is required' });

      // Check if conversation already exists
      const existing = await sql(
        `SELECT c.id FROM conversations c
         JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
         JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
         WHERE NOT EXISTS (
           SELECT 1 FROM conversation_participants cp3
           WHERE cp3.conversation_id = c.id
             AND cp3.user_id NOT IN ($1, $2)
         )
         LIMIT 1`,
        [userId, targetUserId]
      );

      if (existing?.[0]?.id) {
        return res.status(200).json({ ok: true, conversationId: existing[0].id });
      }

      // Create new conversation
      const inserted = await sql(
        `INSERT INTO conversations DEFAULT VALUES RETURNING id`,
        []
      );
      const conversationId = inserted?.[0]?.id;

      await sql(
        `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)`,
        [conversationId, userId, targetUserId]
      );

      return res.status(200).json({ ok: true, conversationId });
    } catch (err) {
      console.error('POST /api/messages/conversations error', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
