-- =============================================================================
-- 0002 — Add audio_file and video_file source types
-- =============================================================================
-- Voice memo + video upload support. Files land in storage, ingestion
-- pipeline downloads, transcribes via AssemblyAI, summarises via Claude.

alter type context_source_type add value if not exists 'audio_file';
alter type context_source_type add value if not exists 'video_file';
