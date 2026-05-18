-- =============================================================================
-- AIW Content Engine — initial schema
-- =============================================================================
-- Single-tenant. Run this once in your Supabase SQL Editor after creating
-- the project. Re-runnable: every CREATE uses IF NOT EXISTS where possible.
--
-- Stack assumptions:
--   - Postgres 15+ (Supabase default)
--   - Supabase Auth handles users; the first signup becomes the owner
--   - Postgres full-text search (tsvector) replaces vector embeddings
-- =============================================================================

create extension if not exists pg_trgm;

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------

do $$ begin
  create type context_bucket as enum (
    'video_ideas', 'inspiration', 'expert_brain',
    'my_voice', 'my_business', 'instructions', 'feedback'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type context_source_type as enum (
    'text', 'youtube_url', 'instagram_reel', 'tiktok_url',
    'pdf', 'link'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type context_status as enum (
    'queued', 'fetching', 'transcribing', 'summarising', 'ready', 'failed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type script_format as enum ('reel', 'carousel', 'story_sequence');
exception when duplicate_object then null; end $$;

do $$ begin
  create type script_status as enum (
    'idea', 'approved', 'shot', 'edited', 'posted', 'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type hook_formula as enum (
    'contrarian', 'curiosity_gap', 'pain_point', 'secret_value',
    'time_bound_result', 'mistake_callout', 'numbered_list'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type generation_source as enum ('chat', 'radar', 'manual', 'regenerate');
exception when duplicate_object then null; end $$;

do $$ begin
  create type feedback_rating as enum ('up', 'down');
exception when duplicate_object then null; end $$;

do $$ begin
  create type generation_run_status as enum ('pending', 'running', 'completed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type post_platform as enum (
    'instagram_reels', 'instagram_feed', 'instagram_stories',
    'tiktok', 'youtube_shorts'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type watch_platform as enum ('instagram', 'tiktok', 'youtube');
exception when duplicate_object then null; end $$;

do $$ begin
  create type watch_type as enum ('creator_handle', 'hashtag');
exception when duplicate_object then null; end $$;

do $$ begin
  create type run_status as enum ('pending', 'running', 'completed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type signal_status as enum ('new', 'saved', 'dismissed', 'used');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- BUSINESS PROFILE
-- ----------------------------------------------------------------------------
create table if not exists public.business_profile (
  id uuid primary key default gen_random_uuid(),
  niche text,
  avatar_description text,
  offer_description text,
  lead_magnet text,
  default_comment_keyword text,
  geographic_focus text,
  onboarding_step int not null default 0,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- VOICE PROFILE
-- ----------------------------------------------------------------------------
create table if not exists public.voice_profile (
  id uuid primary key default gen_random_uuid(),
  tone_descriptor text,
  catchphrases text[] not null default '{}',
  do_not_use_phrases text[] not null default '{}',
  sample_transcripts text[] not null default '{}',
  refreshed_from_posts_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- APP SETTINGS (single row, holds API keys + flags)
-- ----------------------------------------------------------------------------
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  secrets jsonb not null default '{}'::jsonb,
  notifications jsonb not null default '{"banners":true}'::jsonb,
  flags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- CONTEXT ITEMS (the seven Library buckets)
-- ----------------------------------------------------------------------------
create table if not exists public.context_items (
  id uuid primary key default gen_random_uuid(),
  bucket context_bucket not null,
  source_type context_source_type not null,
  source_url text,
  storage_path text,
  title text,
  raw_input text,
  raw_payload jsonb,
  processed_content text,
  summary text,
  tags text[] not null default '{}',
  hook_extracted text,
  metadata jsonb not null default '{}'::jsonb,
  status context_status not null default 'queued',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  search_doc tsvector
);

-- Postgres rejects to_tsvector inside a generated-always column because
-- text-search configurations are technically mutable. We use a trigger instead.
create or replace function public.context_items_update_search_doc()
returns trigger language plpgsql as $$
begin
  new.search_doc :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.summary, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(new.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.processed_content, '')), 'C');
  return new;
end;
$$;

drop trigger if exists trg_context_items_search on public.context_items;
create trigger trg_context_items_search
  before insert or update of title, summary, tags, processed_content
  on public.context_items
  for each row execute function public.context_items_update_search_doc();

create index if not exists idx_context_items_bucket
  on public.context_items (bucket) where deleted_at is null;
create index if not exists idx_context_items_status
  on public.context_items (status) where status not in ('ready', 'failed');
create index if not exists idx_context_items_search
  on public.context_items using gin (search_doc);
create index if not exists idx_context_items_tags
  on public.context_items using gin (tags);
create unique index if not exists idx_context_items_url
  on public.context_items (source_url) where source_url is not null and deleted_at is null;
create index if not exists idx_context_items_created
  on public.context_items (created_at desc);

-- ----------------------------------------------------------------------------
-- SCRIPTS (kanban cards)
-- ----------------------------------------------------------------------------
create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid,
  format script_format not null default 'reel',
  status script_status not null default 'idea',
  hook text,
  hook_formula hook_formula,
  body text,
  cta text,
  full_script text,
  caption text,
  keyword text,
  hashtags text[] not null default '{}',
  topic text,
  angle text,
  slides jsonb,
  target_length_s int,
  inspired_by uuid[] not null default '{}',
  generation_source generation_source not null default 'chat',
  generation_prompt text,
  notes text,
  feedback_rating feedback_rating,
  feedback_notes text,
  feedback_at timestamptz,
  edit_count int not null default 0,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  shot_at timestamptz,
  edited_at timestamptz,
  posted_at timestamptz,
  archived_at timestamptz
);

create index if not exists idx_scripts_status
  on public.scripts (status, updated_at desc);
create index if not exists idx_scripts_generation
  on public.scripts (generation_id);
create index if not exists idx_scripts_format
  on public.scripts (format);

-- ----------------------------------------------------------------------------
-- GENERATION RUNS (audit log)
-- ----------------------------------------------------------------------------
create table if not exists public.generation_runs (
  id uuid primary key default gen_random_uuid(),
  request_text text not null,
  format script_format not null,
  count_requested int not null,
  retrieved_items uuid[] not null default '{}',
  prompt_tokens int,
  output_tokens int,
  cost_usd numeric(10, 6),
  model text,
  status generation_run_status not null default 'pending',
  error_message text,
  duration_ms int,
  resulting_script_ids uuid[] not null default '{}',
  source generation_source not null default 'chat',
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_generation_runs_started
  on public.generation_runs (started_at desc);

-- ----------------------------------------------------------------------------
-- POSTS (published URLs)
-- ----------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  script_id uuid references public.scripts(id) on delete set null,
  platform post_platform not null,
  external_id text,
  external_url text not null,
  posted_at timestamptz not null default now(),
  last_pulled_at timestamptz,
  pull_failures int not null default 0,
  keyword_dms int,
  notes text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_posts_url on public.posts (external_url);
create index if not exists idx_posts_posted on public.posts (posted_at desc);

-- ----------------------------------------------------------------------------
-- PERFORMANCE (time-series)
-- ----------------------------------------------------------------------------
create table if not exists public.performance (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  captured_at timestamptz not null default now(),
  views int,
  reach int,
  likes int,
  comments int,
  shares int,
  saves int,
  total_interactions int,
  avg_watch_time_ms int,
  swipe_through_rate numeric(5, 4),
  completion_rate numeric(5, 4),
  raw_payload jsonb
);

create unique index if not exists idx_performance_post_capture
  on public.performance (post_id, captured_at);

-- ----------------------------------------------------------------------------
-- NICHE WATCH (Radar config)
-- ----------------------------------------------------------------------------
create table if not exists public.niche_watch (
  id uuid primary key default gen_random_uuid(),
  type watch_type not null,
  platform watch_platform not null,
  value text not null,
  added_at timestamptz not null default now(),
  paused_at timestamptz
);

create unique index if not exists idx_niche_watch_unique
  on public.niche_watch (type, platform, value);

-- ----------------------------------------------------------------------------
-- NICHE WATCH RUNS (cron audit)
-- ----------------------------------------------------------------------------
create table if not exists public.niche_watch_runs (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid not null references public.niche_watch(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  items_pulled int,
  signals_created int,
  status run_status not null default 'pending',
  error_message text
);

create index if not exists idx_niche_watch_runs_started
  on public.niche_watch_runs (started_at desc);

-- ----------------------------------------------------------------------------
-- NICHE SIGNALS (Radar output)
-- ----------------------------------------------------------------------------
create table if not exists public.niche_signals (
  id uuid primary key default gen_random_uuid(),
  watch_id uuid references public.niche_watch(id) on delete set null,
  source watch_platform not null,
  source_handle text,
  content_url text not null,
  title_or_caption text,
  posted_at timestamptz,
  captured_at timestamptz not null default now(),
  metrics jsonb,
  velocity_score numeric(8, 4),
  hook_extracted text,
  hook_formula hook_formula,
  suggestion_text text,
  status signal_status not null default 'new',
  script_id uuid references public.scripts(id) on delete set null,
  user_seen_at timestamptz,
  user_actioned_at timestamptz
);

create unique index if not exists idx_niche_signals_url
  on public.niche_signals (content_url);
create index if not exists idx_niche_signals_status
  on public.niche_signals (status, captured_at desc);

-- ----------------------------------------------------------------------------
-- TRIGGER: keep updated_at fresh
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_business_profile_updated on public.business_profile;
create trigger trg_business_profile_updated before update on public.business_profile
  for each row execute function public.set_updated_at();

drop trigger if exists trg_voice_profile_updated on public.voice_profile;
create trigger trg_voice_profile_updated before update on public.voice_profile
  for each row execute function public.set_updated_at();

drop trigger if exists trg_app_settings_updated on public.app_settings;
create trigger trg_app_settings_updated before update on public.app_settings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_context_items_updated on public.context_items;
create trigger trg_context_items_updated before update on public.context_items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_scripts_updated on public.scripts;
create trigger trg_scripts_updated before update on public.scripts
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RPC: full-text retrieval per bucket
-- ----------------------------------------------------------------------------
create or replace function public.search_context_items_fts(
  p_bucket context_bucket,
  p_query text,
  p_limit int default 5
)
returns table (
  id uuid,
  bucket context_bucket,
  title text,
  summary text,
  processed_content text,
  tags text[],
  metadata jsonb,
  rank real
) language sql stable as $$
  select
    ci.id,
    ci.bucket,
    ci.title,
    ci.summary,
    ci.processed_content,
    ci.tags,
    ci.metadata,
    ts_rank(ci.search_doc, websearch_to_tsquery('english', p_query)) as rank
  from public.context_items ci
  where ci.bucket = p_bucket
    and ci.deleted_at is null
    and ci.status = 'ready'
    and (
      p_query = ''
      or ci.search_doc @@ websearch_to_tsquery('english', p_query)
    )
  order by rank desc nulls last, ci.created_at desc
  limit p_limit;
$$;

-- Variant: fetch the entire bucket (for small ones like business / instructions)
create or replace function public.fetch_context_items_full(
  p_bucket context_bucket,
  p_limit int default 100
)
returns table (
  id uuid,
  bucket context_bucket,
  title text,
  summary text,
  processed_content text,
  tags text[],
  metadata jsonb
) language sql stable as $$
  select
    ci.id,
    ci.bucket,
    ci.title,
    ci.summary,
    ci.processed_content,
    ci.tags,
    ci.metadata
  from public.context_items ci
  where ci.bucket = p_bucket
    and ci.deleted_at is null
    and ci.status = 'ready'
  order by ci.created_at desc
  limit p_limit;
$$;

-- ----------------------------------------------------------------------------
-- ROW-LEVEL SECURITY (single-tenant: any authenticated user has full access)
-- ----------------------------------------------------------------------------
alter table public.business_profile enable row level security;
alter table public.voice_profile enable row level security;
alter table public.app_settings enable row level security;
alter table public.context_items enable row level security;
alter table public.scripts enable row level security;
alter table public.generation_runs enable row level security;
alter table public.posts enable row level security;
alter table public.performance enable row level security;
alter table public.niche_watch enable row level security;
alter table public.niche_watch_runs enable row level security;
alter table public.niche_signals enable row level security;

do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'business_profile', 'voice_profile', 'app_settings',
      'context_items', 'scripts', 'generation_runs',
      'posts', 'performance',
      'niche_watch', 'niche_watch_runs', 'niche_signals'
    ])
  loop
    execute format(
      'drop policy if exists authenticated_all on public.%I', t
    );
    execute format(
      'create policy authenticated_all on public.%I for all to authenticated using (true) with check (true)', t
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- STORAGE: uploads bucket for PDFs and other file types
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

drop policy if exists "auth read uploads" on storage.objects;
drop policy if exists "auth insert uploads" on storage.objects;
drop policy if exists "auth update uploads" on storage.objects;
drop policy if exists "auth delete uploads" on storage.objects;

create policy "auth read uploads" on storage.objects
  for select to authenticated using (bucket_id = 'uploads');
create policy "auth insert uploads" on storage.objects
  for insert to authenticated with check (bucket_id = 'uploads');
create policy "auth update uploads" on storage.objects
  for update to authenticated using (bucket_id = 'uploads');
create policy "auth delete uploads" on storage.objects
  for delete to authenticated using (bucket_id = 'uploads');

-- ----------------------------------------------------------------------------
-- SEED: ensure single-row tables have their row
-- ----------------------------------------------------------------------------
insert into public.app_settings (id) values (1) on conflict (id) do nothing;
