-- SalesUp — Sprint 2 migration (2026-06-23)
-- Idempotent: safe to re-run.
--
-- This migration only adds indexes used by Sprint 2 stats endpoints (monthly
-- stats, competitor aggregation, daily report). Schema is unchanged because
-- all new state piggybacks on existing JSONB columns:
--   - profiles.metadata.daily_brief_cache   (S2-1 cache)
--   - profiles.metadata.monthly_goal        (S2-3 goals)
--   - calendar_events.source = 'followup_sequence' (S2-2)
--   - calendar_events.source = 'cs_reminder'       (Sprint 1)
--   - call_records.analysis.competitor_names       (Sprint 1)
--
-- The 'business-cards' Supabase Storage bucket required by S2-5 must be
-- created from the Supabase Dashboard (Storage → New bucket, Public: OFF).
-- Policy: auth.uid()::text = (storage.foldername(name))[1].

-- 1. Stats queries: per-user time-range scans on call_records / activities
CREATE INDEX IF NOT EXISTS idx_call_records_user_created
  ON call_records(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_user_created
  ON activities(user_id, created_at DESC);

-- 2. Monthly-stats pipeline narrows by status + updated_at within owner_id
CREATE INDEX IF NOT EXISTS idx_clients_status_updated
  ON clients(owner_id, sales_status, updated_at DESC);

-- 3. Competitor aggregation reads call_records.analysis JSONB heavily
CREATE INDEX IF NOT EXISTS idx_call_records_analysis_gin
  ON call_records USING GIN (analysis);
