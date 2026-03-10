-- ============================================================
-- Meetup Confirmations + Would Meet Again
-- Run each statement individually (not in a transaction).
-- ============================================================

-- Core confirmation table.
-- One row per (checkin, confirmer, confirmed_user).
-- A "confirmed meetup" pair requires BOTH directions to exist.
CREATE TABLE IF NOT EXISTS public.meetup_confirmations (
  id                  BIGSERIAL PRIMARY KEY,
  checkin_id          BIGINT NOT NULL REFERENCES public.checkins(id) ON DELETE CASCADE,
  confirmer_user_id   BIGINT NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  confirmed_user_id   BIGINT NOT NULL REFERENCES public.auth_users(id) ON DELETE CASCADE,
  would_meet_again    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- A user can only confirm once per (plan, other person).
  CONSTRAINT meetup_confirmations_unique
    UNIQUE (checkin_id, confirmer_user_id, confirmed_user_id),

  -- Can't confirm yourself.
  CONSTRAINT meetup_confirmations_no_self
    CHECK (confirmer_user_id <> confirmed_user_id)
);

-- Fast lookup: "which plans did user X confirm on?"
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meetup_confirmations_confirmer
  ON public.meetup_confirmations (confirmer_user_id, checkin_id);

-- Fast lookup: "who confirmed user X on a given plan?"
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meetup_confirmations_confirmed
  ON public.meetup_confirmations (confirmed_user_id, checkin_id);

-- For the mutual-pair meetup list query.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meetup_confirmations_checkin
  ON public.meetup_confirmations (checkin_id);

-- Track which plans have had the confirmation push sent so we don't double-send.
ALTER TABLE public.checkins
  ADD COLUMN IF NOT EXISTS meetup_prompt_sent_at TIMESTAMPTZ;
