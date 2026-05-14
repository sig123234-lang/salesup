# SalesUp 설정 가이드

## 1. Supabase 프로젝트 생성

1. https://supabase.com 접속 → 새 프로젝트 생성
2. Settings → API에서 아래 값 복사:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

## 2. 데이터베이스 스키마 적용

Supabase Dashboard → SQL Editor에서 아래 파일 순서로 실행:
```
src/lib/supabase/schema.sql
```

## 3. Supabase Storage 버킷 생성

SQL Editor에서 실행:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);
```

## 4. PureOn 테스트 계정 생성

Supabase Dashboard → Authentication → Users → Add user:
- Email: pureon@salesup.app
- Password: pureon123

그 후 SQL Editor에서:
```sql
UPDATE profiles
SET role = 'COMPANY_ADMIN',
    company_id = 'a1b2c3d4-0000-0000-0000-000000000001',
    full_name = 'PureOn 관리자'
WHERE email = 'pureon@salesup.app';
```

## 5. 환경변수 설정

`.env.local` 파일 수정:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY  # 선택
```

## 6. 개발 서버 실행

```bash
cd salesup
npm install
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 7. 로그인 테스트

- 아이디: `pure-on` 또는 이메일: `pureon@salesup.app`
- 비밀번호: `pureon123`

## 8. Google Maps API (선택)

Google Cloud Console에서 Maps JavaScript API를 활성화한 뒤 API 키를 발급하세요.
`.env.local`의 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`에 입력

## 9. OpenAI API

https://platform.openai.com 에서 API 키 발급
- gpt-4o-mini 모델 사용 (저비용 고성능)
- whisper-1 모델 사용 (음성 인식)

## 프로젝트 구조

```
salesup/
├── src/
│   ├── app/
│   │   ├── (auth)/         # 로그인, 회원가입
│   │   ├── (dashboard)/    # 메인 앱
│   │   │   ├── dashboard/  # 대시보드
│   │   │   ├── clients/    # 거래처 관리
│   │   │   ├── kanban/     # 영업 현황 보드
│   │   │   ├── calendar/   # 캘린더
│   │   │   ├── map/        # 지도
│   │   │   ├── calls/      # 통화 기록
│   │   │   ├── visits/     # 방문 기록
│   │   │   ├── ai-insights/# AI 인사이트
│   │   │   ├── claims/     # 클레임
│   │   │   └── settings/   # 설정
│   │   ├── admin/          # 관리자 전용
│   │   └── api/            # API 라우트
│   ├── components/         # 재사용 컴포넌트
│   ├── lib/                # 유틸리티
│   ├── store/              # 상태 관리
│   └── types/              # TypeScript 타입
├── public/
│   ├── manifest.json       # PWA 설정
│   └── icons/              # 앱 아이콘
└── .env.local              # 환경변수
```

## 주요 기능

| 기능 | 설명 |
|------|------|
| 거래처 관리 | CRUD, 태그, custom_fields |
| Kanban 보드 | 드래그앤드롭 영업 상태 관리 |
| 통화 AI | 녹음 → Whisper → GPT 분석 |
| 방문 AI | 위치 기록 + 음성 요약 |
| 캘린더 | AI 자동 일정 생성 |
| 지도 | 카카오맵 기반 거래처 핀 |
| AI 추천 | 재방문 가치 분석 |
| 클레임 | 불만 처리 시스템 |
| 관리자 | 팀 현황 + 차트 분석 |
| PWA | 홈 화면 추가, 오프라인 지원 |
| Shake | 흔들기로 Quick Capture |
