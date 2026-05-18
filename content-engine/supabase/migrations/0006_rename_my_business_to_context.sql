-- Renames the my_business bucket value to context. The internal codename
-- never matched the user-facing label or the system prompt label (both
-- "Context"). After this migration the slug, the prompt label, and the
-- UI label all align.
--
-- Postgres does not allow removing an enum value once added, so we keep
-- my_business in the enum as a dead value. Code stops writing to it.
--
-- The two statements must run in separate transactions (Postgres requires
-- the ADD VALUE to commit before the new value can be used in an UPDATE).
-- Supabase migration runner handles split statements correctly.

ALTER TYPE public.context_bucket ADD VALUE IF NOT EXISTS 'context';

UPDATE public.context_items
SET bucket = 'context'
WHERE bucket = 'my_business';
