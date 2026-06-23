-- SalesUp — AI assistant migration (2026-06-23)
-- Idempotent: safe to re-run.

-- 1. profiles.metadata already exists as JSONB; AI settings live under
--    metadata.ai_settings — no schema change needed.

-- 2. calendar_events: distinguish AI-sourced events from manual ones.
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
COMMENT ON COLUMN calendar_events.source IS
  'manual | ai_analysis | ai_recommendation | quick_capture | cs_reminder';

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_source
  ON calendar_events(user_id, source);

-- 3. call_records: track whether a call was recorded vs typed.
ALTER TABLE call_records
  ADD COLUMN IF NOT EXISTS input_method TEXT DEFAULT 'audio';
COMMENT ON COLUMN call_records.input_method IS
  'audio | text_input';

-- 4. Composite index for activities used by the follow-up counter widget
--    (count contacts per client by type).
CREATE INDEX IF NOT EXISTS idx_activities_client_type
  ON activities(client_id, type);

-- 5. clients.custom_fields is JSONB already (MEDDIC stored under
--    custom_fields.meddic).
