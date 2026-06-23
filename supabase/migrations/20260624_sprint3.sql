-- SalesUp — Sprint 3 migration (2026-06-24)
-- Idempotent: safe to re-run.

-- 1. scripts table (S3-3)
CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  -- category: followup_call | followup_text | intro | objection | closing | cs | general
  tags TEXT[] DEFAULT '{}',
  use_count INTEGER DEFAULT 0,
  is_shared BOOLEAN DEFAULT FALSE,
  -- is_shared=true: same-company members may also read
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scripts_user ON scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_company_shared ON scripts(company_id, is_shared);
CREATE INDEX IF NOT EXISTS idx_scripts_category_use_count
  ON scripts(category, use_count DESC);

ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy to keep semantics in sync on re-runs
DROP POLICY IF EXISTS "scripts_access" ON scripts;
CREATE POLICY "scripts_access" ON scripts
  FOR ALL USING (
    user_id = auth.uid() OR (
      is_shared = true AND company_id IN (
        SELECT company_id FROM profiles
        WHERE id = auth.uid() AND company_id IS NOT NULL
      )
    )
  )
  WITH CHECK (user_id = auth.uid());

-- updated_at trigger (re-uses helper from initial schema)
DROP TRIGGER IF EXISTS update_scripts_updated_at ON scripts;
CREATE TRIGGER update_scripts_updated_at
  BEFORE UPDATE ON scripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Activity timeline lookup performance (S3-5) and STATUS_CHANGE win-rate
--    fix (S3-0 bug 4) both benefit from this composite index.
CREATE INDEX IF NOT EXISTS idx_activities_type_client
  ON activities(client_id, type, created_at DESC);

-- 3. Push subscription lookup (S3-4) — restrict to rows that actually have one.
CREATE INDEX IF NOT EXISTS idx_profiles_push_sub
  ON profiles((metadata->>'push_subscription'))
  WHERE metadata->>'push_subscription' IS NOT NULL;
