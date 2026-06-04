#!/bin/bash
# SalesUp - 변경사항 커밋 스크립트
# 터미널에서 실행: bash DO_COMMIT.sh

cd "$(dirname "$0")"

# 스테일 lock 파일 제거
rm -f .git/index.lock

# tmp 빌드 디렉토리 제거
rm -rf tmp/

# 모든 변경사항 스테이징
git add -A ':!tmp/'

# 커밋
git commit -m "feat: replace Kakao Maps with Google Maps, add auth/company APIs, schema migration SQL

Kakao Maps → Google Maps:
- layout.tsx: Kakao script 제거, Google Maps API (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
- map/page.tsx: Google Maps 완전 재작성 (상태별 컬러 마커, InfoWindow, 현재 위치)

회원가입/인증:
- register/page.tsx: 개인/회사 2-step 회원가입 UI
- api/auth/register/route.ts: 신규 회원가입 API
- useAuth.ts: 신/구 profiles 스키마 fallback 지원
- lib/supabase/admin.ts: createAdminClient, hasCompanySchema, upsertProfile

회사 기능:
- api/company/route.ts: GET/POST/PATCH
- company/page.tsx: 회사 생성/수정/멤버 목록
- api/admin/create-member/route.ts: 멤버 생성

Quick Capture:
- QuickCapture.tsx: NOTE/CLIENT/EVENT/VOICE 모두 저장 완성

기타:
- settings/page.tsx: 프로필 수정 + 비밀번호 변경
- Sidebar.tsx: 회사 정보 메뉴
- next.config.ts: 127.0.0.1 허용
- .env.local: KAKAO → GOOGLE_MAPS_API_KEY
- reset-and-migrate.sql: Supabase SQL Editor용 스키마 초기화+재적용 스크립트

BUILD: lint OK, tsc OK, 27/27 pages compiled"

echo ""
echo "커밋 완료! 'git log --oneline -3' 으로 확인:"
git log --oneline -3
echo ""
echo "푸시하려면: git push"
