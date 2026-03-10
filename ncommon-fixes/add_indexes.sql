-- ============================================================
-- nCommon — missing index migration
-- ============================================================
-- Run this once against your production database.
-- All indexes use CREATE INDEX IF NOT EXISTS and CONCURRENTLY
-- so they are safe to run on a live database with zero downtime.
-- CONCURRENTLY cannot run inside a transaction block — run each
-- statement individually if your client wraps things in BEGIN.
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- profile_views
-- ──────────────────────────────────────────────────────────────
-- Three query shapes hit this table on every profile view:
--
-- (1) Dedup check:
--     WHERE viewer_user_id = $1
--       AND viewed_user_id = $2
--       AND created_at > now() - interval '24 hours'
--
-- (2) 24h count (×2, before and after insert):
--     WHERE viewer_user_id = $1
--       AND created_at > now() - interval '24 hours'
--     → COUNT(DISTINCT viewed_user_id)
--
-- (3) Account delete / clear-activity:
--     WHERE viewer_user_id = $1 OR viewed_user_id = $1
--
-- Index strategy:
--   • A composite on (viewer_user_id, created_at, viewed_user_id) covers
--     both (1) and (2): viewer_user_id + created_at narrow the row set;
--     viewed_user_id is included for the DISTINCT without a heap fetch.
--   • A separate index on viewed_user_id covers the OR branch of (3)
--     (viewer_user_id branch is already covered by the composite above).

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_views_viewer_created_viewed
    ON public.profile_views (viewer_user_id, created_at DESC, viewed_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_views_viewed_user
    ON public.profile_views (viewed_user_id);


-- ──────────────────────────────────────────────────────────────
-- checkin_views
-- ──────────────────────────────────────────────────────────────
-- Query shapes:
--
-- (1) Dedup / ON CONFLICT:
--     (checkin_id, viewer_user_id) — unique constraint already exists if
--     the ON CONFLICT clause works, but an explicit index makes it visible.
--
-- (2) Insights count (24h window):
--     WHERE checkin_id = $1
--       AND created_at > now() - interval '24 hours'
--
-- (3) Insights viewer list:
--     WHERE checkin_id = $1
--       AND created_at > now() - interval '24 hours'
--     ORDER BY created_at DESC LIMIT 40
--
-- (4) Account clear-activity (checkin owner branch):
--     WHERE checkin_id IN (SELECT id FROM checkins WHERE user_id = $1)
--     → only needs checkin_id; covered by the composite below.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checkin_views_checkin_created
    ON public.checkin_views (checkin_id, created_at DESC);

-- viewer_user_id branch of clear-activity
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_checkin_views_viewer
    ON public.checkin_views (viewer_user_id);


-- ──────────────────────────────────────────────────────────────
-- rate_limit_counters
-- ──────────────────────────────────────────────────────────────
-- Query shape (upsert + cleanup):
--
--   INSERT ... ON CONFLICT (user_id, action, window_start, window_seconds)
--   → primary key / unique constraint should already cover this.
--
-- Cleanup cron (added separately):
--   DELETE WHERE window_start < NOW() - (window_seconds * 3 || ' seconds')::interval
--   → needs (window_start) at minimum; include window_seconds for the
--     expression filter so Postgres can prune old partitions efficiently.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rate_limit_counters_window_start
    ON public.rate_limit_counters (window_start);


-- ──────────────────────────────────────────────────────────────
-- productivity_completions
-- ──────────────────────────────────────────────────────────────
-- Query shapes:
--
-- (1) Bulk load for streak/done-today (GET /habits):
--     WHERE user_id = $1
--       AND completed_date >= (CURRENT_DATE - INTERVAL '30 days')
--
-- (2) Week summary:
--     WHERE user_id = $1
--       AND completed_date >= (CURRENT_DATE - INTERVAL '6 days')
--     GROUP BY completed_date
--
-- (3) Toggle existence check:
--     WHERE habit_id = $1 AND user_id = $2 AND completed_date = $3
--
-- (4) Toggle insert ON CONFLICT (habit_id, user_id, completed_date)
--     → unique constraint already required for ON CONFLICT to work.
--
-- A composite on (user_id, completed_date) covers (1) and (2).
-- If there's no unique constraint yet on (habit_id, user_id, completed_date),
-- add it so the ON CONFLICT clause doesn't silently fail.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_productivity_completions_user_date
    ON public.productivity_completions (user_id, completed_date DESC);

-- Unique constraint backing the ON CONFLICT in toggle route.
-- IF NOT EXISTS guard means this is a no-op if it already exists.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
    uidx_productivity_completions_habit_user_date
    ON public.productivity_completions (habit_id, user_id, completed_date);


-- ──────────────────────────────────────────────────────────────
-- productivity_habits
-- ──────────────────────────────────────────────────────────────
-- All queries filter on user_id (GET list, count for cap, PATCH owner check).
-- If there's no index on user_id this becomes a seq scan as habits grow.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_productivity_habits_user_id
    ON public.productivity_habits (user_id);


-- ──────────────────────────────────────────────────────────────
-- Verify (run after migration to confirm all indexes exist)
-- ──────────────────────────────────────────────────────────────
-- SELECT indexname, tablename
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND indexname IN (
--     'idx_profile_views_viewer_created_viewed',
--     'idx_profile_views_viewed_user',
--     'idx_checkin_views_checkin_created',
--     'idx_checkin_views_viewer',
--     'idx_rate_limit_counters_window_start',
--     'idx_productivity_completions_user_date',
--     'uidx_productivity_completions_habit_user_date',
--     'idx_productivity_habits_user_id'
--   )
-- ORDER BY tablename, indexname;
