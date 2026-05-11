-- ============================================================
-- SalesUp Seed Data
-- PureOn 테스트 계정 및 샘플 데이터
-- ============================================================

-- 이 시드는 Supabase에서 서비스 role key로 실행해야 합니다.
-- auth.users는 직접 INSERT 불가 - Supabase Admin API 사용

-- ============================================================
-- STEP 1: Supabase Auth API로 먼저 유저 생성
-- POST /auth/v1/admin/users
-- { "email": "pureon@salesup.app", "password": "pureon123",
--   "user_metadata": { "full_name": "PureOn 관리자", "role": "COMPANY_ADMIN" } }
-- ============================================================

-- ============================================================
-- STEP 2: 생성된 user id로 아래 실행
-- ============================================================

-- 회사 생성 (없으면)
INSERT INTO companies (id, name, business_number, is_verified, settings)
VALUES (
  'a1b2c3d4-0000-0000-0000-000000000001',
  'PureOn',
  '123-45-67890',
  true,
  '{"industry": "laundry", "theme": "blue"}'
) ON CONFLICT (id) DO NOTHING;

-- 프로필 업데이트 (auth user 생성 후 실행)
-- UPDATE profiles
-- SET role = 'COMPANY_ADMIN',
--     company_id = 'a1b2c3d4-0000-0000-0000-000000000001',
--     username = 'pure-on'
-- WHERE email = 'pureon@salesup.app';

-- ============================================================
-- SAMPLE CLIENTS (owner_id는 실제 user id로 교체)
-- ============================================================

-- 아래는 owner_id를 실제 관리자 ID로 교체 후 실행
/*
INSERT INTO clients (id, company_id, owner_id, name, industry, address, lat, lng, contact_name, phone, sales_status, contract_probability, custom_fields, tags) VALUES
(uuid_generate_v4(), 'a1b2c3d4-0000-0000-0000-000000000001', '<ADMIN_USER_ID>', '강남 드라이클리닝', 'laundry', '서울특별시 강남구 테헤란로 123', 37.5012, 127.0396, '김영수', '010-1234-5678', 'FOLLOW_UP', 65, '{"bag_volume": 50, "service_type": "dry_cleaning"}', '{"VIP", "재방문예정"}'),
(uuid_generate_v4(), 'a1b2c3d4-0000-0000-0000-000000000001', '<ADMIN_USER_ID>', '송파 세탁센터', 'laundry', '서울특별시 송파구 올림픽로 456', 37.5145, 127.1059, '이민수', '010-2345-6789', 'CONTRACT_IN_PROGRESS', 80, '{"bag_volume": 30}', '{"잠재고객"}'),
(uuid_generate_v4(), 'a1b2c3d4-0000-0000-0000-000000000001', '<ADMIN_USER_ID>', '홍대 런드리샵', 'laundry', '서울특별시 마포구 홍익로 789', 37.5546, 126.9236, '박지현', '010-3456-7890', 'NEW_LEAD', 20, '{}', '{"신규"}'),
(uuid_generate_v4(), 'a1b2c3d4-0000-0000-0000-000000000001', '<ADMIN_USER_ID>', '분당 클린업', 'laundry', '경기도 성남시 분당구 판교로 101', 37.3943, 127.1115, '최현식', '010-4567-8901', 'CONTRACTED', 95, '{"bag_volume": 100}', '{"계약완료", "VIP"}'),
(uuid_generate_v4(), 'a1b2c3d4-0000-0000-0000-000000000001', '<ADMIN_USER_ID>', '서초 화이트세탁', 'laundry', '서울특별시 서초구 강남대로 234', 37.4937, 127.0324, '정수진', '010-5678-9012', 'QUOTE_SENT', 50, '{"bag_volume": 20}', '{"견적발송"}');
*/
