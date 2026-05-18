-- Adds the long_form value to the script_format enum and the columns
-- needed to persist long-form scripts (sections array, working title,
-- total duration). Long-form covers YouTube videos and podcast outlines
-- (typically 3-15 minutes).

-- 1. Extend the enum (idempotent on Postgres 12+)
ALTER TYPE script_format ADD VALUE IF NOT EXISTS 'long_form';

-- 2. Add the new columns. sections holds [{ order, heading, content,
-- duration_s, shot_ideas[] }, ...] for long-form pieces.
ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS sections JSONB,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS total_duration_min INTEGER;
