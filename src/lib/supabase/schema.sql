-- ============================================================
-- SalesUp Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";  -- optional for geo

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN',
  'COMPANY_ADMIN',
  'SALES_MEMBER',
  'PERSONAL_USER'
);

CREATE TYPE sales_status AS ENUM (
  'NEW_LEAD',
  'FIRST_VISIT',
  'QUOTE_SENT',
  'FOLLOW_UP',
  'CONTRACT_IN_PROGRESS',
  'CONTRACTED',
  'REJECTED',
  'POTENTIAL'
);

CREATE TYPE activity_type AS ENUM (
  'NOTE',
  'CALL',
  'VISIT',
  'EMAIL',
  'STATUS_CHANGE',
  'AI_INSIGHT'
);

CREATE TYPE event_type AS ENUM (
  'CALL',
  'VISIT',
  'MEETING',
  'FOLLOW_UP',
  'OTHER'
);

CREATE TYPE claim_status AS ENUM (
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED'
);

CREATE TYPE claim_priority AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
);

CREATE TYPE processing_status AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

CREATE TYPE recommendation_type AS ENUM (
  'REVISIT',
  'FOLLOW_UP',
  'UPSELL',
  'RETENTION'
);

-- ============================================================
-- COMPANIES
-- ============================================================

CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  business_number TEXT UNIQUE NOT NULL,
  business_license_url TEXT,
  logo_url TEXT,
  admin_id UUID,
  is_verified BOOLEAN DEFAULT FALSE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'PERSONAL_USER',
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  avatar_url TEXT,
  phone TEXT,
  username TEXT UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add admin foreign key after profiles table is created
ALTER TABLE companies
  ADD CONSTRAINT fk_companies_admin
  FOREIGN KEY (admin_id) REFERENCES profiles(id);

-- ============================================================
-- CLIENTS
-- ============================================================

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT 'general',
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  memo TEXT,
  photo_url TEXT,
  business_card_url TEXT,
  sales_status sales_status NOT NULL DEFAULT 'NEW_LEAD',
  custom_fields JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  contract_probability INTEGER DEFAULT 0 CHECK (contract_probability >= 0 AND contract_probability <= 100),
  last_contacted_at TIMESTAMPTZ,
  next_contact_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ACTIVITIES (Timeline)
-- ============================================================

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type activity_type NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CALL RECORDS
-- ============================================================

CREATE TABLE call_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  duration_seconds INTEGER,
  audio_url TEXT,
  transcript TEXT,
  analysis JSONB,
  status processing_status DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- VISIT RECORDS
-- ============================================================

CREATE TABLE visit_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  audio_url TEXT,
  transcript TEXT,
  analysis JSONB,
  status processing_status DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================

CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  type event_type DEFAULT 'OTHER',
  is_ai_generated BOOLEAN DEFAULT FALSE,
  is_completed BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLAIMS
-- ============================================================

CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'general',
  description TEXT NOT NULL,
  status claim_status DEFAULT 'OPEN',
  priority claim_priority DEFAULT 'MEDIUM',
  resolved_at TIMESTAMPTZ,
  resolution TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AI RECOMMENDATIONS
-- ============================================================

CREATE TABLE ai_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type recommendation_type NOT NULL,
  reason TEXT NOT NULL,
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  expires_at TIMESTAMPTZ NOT NULL,
  is_dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_clients_owner ON clients(owner_id);
CREATE INDEX idx_clients_company ON clients(company_id);
CREATE INDEX idx_clients_status ON clients(sales_status);
CREATE INDEX idx_clients_next_contact ON clients(next_contact_at);
CREATE INDEX idx_activities_client ON activities(client_id);
CREATE INDEX idx_call_records_client ON call_records(client_id);
CREATE INDEX idx_visit_records_client ON visit_records(client_id);
CREATE INDEX idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_start ON calendar_events(start_at);
CREATE INDEX idx_ai_recommendations_user ON ai_recommendations(user_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_claims_updated_at
  BEFORE UPDATE ON claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

-- Profiles: 자신의 프로필 읽기/쓰기
CREATE POLICY "profiles_self_read" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Company member read
CREATE POLICY "profiles_company_read" ON profiles
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Clients: 자신 소유 또는 같은 회사
CREATE POLICY "clients_owner_all" ON clients
  FOR ALL USING (
    owner_id = auth.uid() OR
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid() AND company_id IS NOT NULL
    )
  );

-- Activities: 연결된 client 접근 가능자
CREATE POLICY "activities_access" ON activities
  FOR ALL USING (
    client_id IN (
      SELECT id FROM clients WHERE
        owner_id = auth.uid() OR
        company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- Calendar events: 자신 것
CREATE POLICY "calendar_events_own" ON calendar_events
  FOR ALL USING (user_id = auth.uid());

-- AI recommendations: 자신 것
CREATE POLICY "ai_rec_own" ON ai_recommendations
  FOR ALL USING (user_id = auth.uid());

-- Claims: 연결된 client 접근 가능자
CREATE POLICY "claims_access" ON claims
  FOR ALL USING (
    client_id IN (
      SELECT id FROM clients WHERE
        owner_id = auth.uid() OR
        company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    )
  );

-- ============================================================
-- AUTO PROFILE CREATION on Sign Up
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'PERSONAL_USER')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SEED DATA - PureOn 테스트 계정
-- ============================================================

-- 1. PureOn 회사 생성
INSERT INTO companies (id, name, business_number, is_verified)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'PureOn',
  '123-45-67890',
  true
);

-- 2. Auth user 생성은 Supabase Dashboard 또는 API를 통해 진행
-- username: pure-on, password: pureon123
-- 이후 profile에 company_id 연결

-- 더미 클라이언트 데이터 (인증 후 owner_id 설정 필요)
