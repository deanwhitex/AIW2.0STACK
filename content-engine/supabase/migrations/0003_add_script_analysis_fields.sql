-- Adds the new richer breakdown fields to scripts: content_format,
-- why_it_works, and shot_ideas. These are populated by the generator
-- and shown in the script card expansion to teach the user the logic
-- behind each script.

ALTER TABLE scripts
  ADD COLUMN IF NOT EXISTS content_format TEXT,
  ADD COLUMN IF NOT EXISTS why_it_works TEXT,
  ADD COLUMN IF NOT EXISTS shot_ideas JSONB DEFAULT '[]'::jsonb;

-- Optional index for filtering by format later (e.g. "show me all
-- talking_head scripts I've written")
CREATE INDEX IF NOT EXISTS scripts_content_format_idx ON scripts (content_format);
