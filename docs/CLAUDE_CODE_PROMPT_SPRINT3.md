# SalesUp — Claude Code 구현 프롬프트 v3.0 (Sprint 3)

> 이 파일을 Claude Code에 붙여넣어 실행하세요.  
> 작성일: 2026-06-23  
> 대상 코드베이스: `/Users/kim/Desktop/salesupapp/salesup`

---

## 🔴 [필독] 이 프롬프트를 시작하기 전 반드시 해야 할 일

### 1단계 — 전체 파일을 3번 읽어라
지금 이 파일을 처음부터 끝까지 **3번 완전히** 읽어라.
읽으면서 각 Feature가 요구하는 것을 이해해라.
절대 "대충 읽고 시작"하지 마라. 3번을 읽지 않으면 반드시 실수가 나온다.

✅ 1번 읽음  
✅ 2번 읽음  
✅ 3번 읽음  
← 이 3줄이 머릿속에서 체크되어야 코딩을 시작해라.

### 2단계 — 각 Feature 착수 전 grep 먼저
각 Feature를 시작하기 **전에** 반드시 Step 0의 grep 명령을 실행해라.
결과를 완료 보고서에 기재해라. 이미 있으면 "보강", 없으면 "신규 구현".
grep 없이 코딩 시작 = 중복 구현 = 시간 낭비.

### 3단계 — 구현하면서 바로 메모
Feature 하나 완료할 때마다 보고서 섹션을 **즉시** 채워라.
"나중에 한꺼번에 쓸게" → 반드시 빠뜨리거나 허술해진다.

### 4단계 — 자기비판은 채팅 응답에 출력 + 파일에 작성 모두 해라
자기비판 검토는 **파일에만 쓰지 말고**, 반드시 **채팅 응답에도 출력**해라.
형식: 아래 "자기비판 출력 형식" 참고.
변명 금지. 못 한 것은 못 했다고 명확히 써라.

### 5단계 — "다음에", "별도로" 금지
"다음 sprint에서", "추후 개선" 금지.
이번에 요구된 것은 이번에 전부 완료해라.

---

## 📢 자기비판 채팅 출력 형식 (반드시 이 형식으로 채팅에 출력)

구현 완료 후 채팅 응답 **마지막에** 아래 형식을 그대로 출력해라:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 자기비판 검토 보고서
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 완벽하게 구현된 것:
- [Feature명]: [구체적으로 무엇을 어떻게 했는지]
- [Feature명]: ...

⚠️ 부족하거나 개선이 필요한 것:
- [Feature명]: [어떤 부분이 부족한지, 왜 부족한지, 어떻게 고쳐야 하는지]
- [Feature명]: ...

❌ 테스트하지 못한 부분:
- [기능명]: [왜 테스트 못 했는지, 무엇을 확인해야 하는지]
- ...

📋 사용자가 직접 확인해야 할 사항:
1. [구체적인 확인 항목 + 방법]
2. ...

🐛 발견한 기존 버그 (이번에 고쳤는지 여부):
- [버그 설명]: [고쳤음 / 못 고쳤음 + 이유]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🏗️ Sprint 1 & 2 완료 현황

아래 파일 수정 시 기존 로직 반드시 보존:

```
src/lib/claude/client.ts
src/lib/claude/prompts.ts
src/lib/ai/unified.ts             ← jsonCompletion, chatStream
src/components/ai/AIChatPanel.tsx ← AI 채팅 패널
src/components/widgets/CSReminderWidget.tsx
src/components/widgets/FollowupCounterWidget.tsx
src/components/widgets/DailyBriefWidget.tsx
src/components/widgets/GoalTrackerWidget.tsx
src/components/widgets/CompetitorWidget.tsx
src/components/widgets/DailyReportWidget.tsx
src/components/clients/MEDDICWidget.tsx
src/components/calls/SuggestedCalendarCard.tsx
src/components/calls/CallAnalysisCard.tsx
src/components/calls/FollowupSequenceCard.tsx
src/components/calendar/WeeklyCalendarView.tsx
src/components/calendar/EventDetailPanel.tsx
src/app/api/ai/chat/route.ts
src/app/api/ai/calendar-from-analysis/route.ts
src/app/api/ai/meddic-fill/route.ts
src/app/api/ai/daily-brief/route.ts
src/app/api/ai/followup-sequence/route.ts
src/app/api/ai/daily-report/route.ts
src/app/api/ai/ocr-card/route.ts
src/app/api/stats/monthly/route.ts
src/app/api/stats/competitors/route.ts
```

---

## 🐛 Sprint 1 & 2 자기비판에서 나온 버그 — 이번에 전부 고쳐라

Sprint 1과 2 자기비판에서 명시된 미완성/버그 목록이다.
**Feature S3-0으로 가장 먼저 처리해라.**

### Feature S3-0: 기존 버그 & 미완성 전부 수정

**Step 0 — grep 선행 조사**:
```bash
grep -r "set-state-in-effect\|setState.*useEffect" src/lib/hooks --include="*.ts"
grep -r "trim\|slice(0.*600\|600\)" src/app/api/ai/daily-report --include="*.ts"
grep -r "chatHistory\|messages.*persist" src/store --include="*.ts"
grep -r "business-cards\|ocr.*upload\|uploadError" src/app/api/ai/ocr-card --include="*.ts"
grep -r "win_rate\|CONTRACTED.*competitor" src/app/api/stats/competitors --include="*.ts"
grep -r "daily_brief_cache\|fallback\|retry" src/app/api/ai/daily-brief --include="*.ts"
```

**수정 사항 (6개 버그)**:

**[버그1] useDashboardConfig.ts & useKanbanConfig.ts lint 에러**
- 파일: `src/lib/hooks/useDashboardConfig.ts`, `src/lib/hooks/useKanbanConfig.ts`
- 문제: `useEffect` 안에서 `setState` 직접 호출 → set-state-in-effect 패턴
- 수정: `useEffect` 제거, `useMemo`로 derived state로 변환
- 단, 기존 merge 로직(새 위젯 자동 추가) 반드시 동일하게 동작하도록 유지

**[버그2] AI 채팅 토큰 무제한 누적**
- 파일: `src/store/index.ts`, `src/app/api/ai/chat/route.ts`
- 문제: 메시지 히스토리가 무한 쌓여서 API 토큰 비용 과다
- 수정: API 호출 시 최근 **20개 메시지만** 서버에 전달 (전체는 로컬에 보존)
- UI에서는 전체 히스토리 표시, API에는 슬라이싱한 것만 전달

**[버그3] 명함 OCR — Storage 버킷 없을 때 사용자 피드백 없음**
- 파일: `src/app/api/ocr-card/route.ts`
- 문제: `business-cards` 버킷 없으면 upload 실패하고 OCR은 진행, `business_card_url = null` 저장, 사용자는 모름
- 수정: upload 실패 시 응답에 `storage_warning: "명함 이미지 저장 실패. 텍스트 정보만 추출됩니다."` 포함
- 클라이언트(QuickCapture)에서 이 경고 메시지 표시

**[버그4] 경쟁사 win_rate 시점 정보 손실**
- 파일: `src/app/api/stats/competitors/route.ts`
- 문제: 통화 당시가 아닌 "현재 CONTRACTED 상태"로 계산 → 나중에 계약해도, 먼저 계약했다가 해지해도 왜곡
- 수정: win_rate 계산 로직 수정
  - 경쟁사 언급된 call_records의 `client_id` 추출
  - 해당 통화의 `created_at` **이후** 90일 이내에 status가 CONTRACTED가 된 거래처만 카운트
  - `activities` 테이블에서 STATUS_CHANGE 타입 + CONTRACTED 전환 기록 조회
  - 불가능한 경우 `win_rate_note: "데이터 부족, 참고용"` 필드 추가

**[버그5] 일일 브리핑 AI 실패 시 fallback 없음**
- 파일: `src/app/api/ai/daily-brief/route.ts`, `src/components/widgets/DailyBriefWidget.tsx`
- 문제: Claude API 실패 시 위젯이 빈 화면만 표시, 사용자가 수동 새로고침해야 함
- 수정:
  - API에서 Claude 실패 시 DB에서 직전 캐시 반환 (날짜 달라도 OK, 오래된 것임을 표시)
  - 캐시도 없으면 rule-based fallback: Supabase 데이터로 직접 계산한 TOP 3 반환 (AI 없이)
  - 위젯에 "⚠️ AI 연결 불안정 — 캐시된 데이터" 배지 표시

**[버그6] 영업 일지 transcript 600자 제한**
- 파일: `src/app/api/ai/daily-report/route.ts`
- 문제: 긴 통화의 후반부 내용이 잘려 일지 품질 저하
- 수정: 2000자로 상향. 단, 하루 통화가 5건 이상이면 1000자로 자동 조정 (컨텍스트 초과 방지)

---

### Feature S3-1: 팀 관리자 대시보드 (COMPANY_ADMIN용)

**목표**: COMPANY_ADMIN 역할인 관리자가 팀원들의 영업 실적을 한 화면에서 확인.

**비즈니스 근거**: 관리자가 팀원 중 누가 팔로업을 안 하고 있는지, 누가 고확률 거래처를 방치하고 있는지 즉시 파악 → 코칭 포인트 제공.

**Step 0 — grep 선행 조사**:
```bash
grep -r "COMPANY_ADMIN\|admin" src/app/admin --include="*.tsx" -l
grep -r "company_id\|owner_id" src/app/api/admin --include="*.ts" -l
grep -r "member.*activity\|AdminDashboard" src/components/admin --include="*.tsx"
```

**구현 사항**:

1. **`/src/app/api/admin/team-stats/route.ts` 신규 생성**

   GET. COMPANY_ADMIN만 접근 가능.
   
   응답:
   ```json
   {
     "members": [
       {
         "id": "uuid",
         "full_name": "김영업",
         "avatar_url": null,
         "stats": {
           "total_clients": 45,
           "contracted_this_month": 3,
           "calls_this_week": 12,
           "overdue_followups": 5,
           "high_prob_clients": 8,
           "avg_contract_probability": 52,
           "days_since_last_activity": 1,
           "spin_avg_score": 2.3
         },
         "risk_flags": ["followup_overdue", "low_activity"]
       }
     ],
     "team_totals": { ... }
   }
   ```
   
   `spin_avg_score`: 최근 통화들의 `spin_feedback`에서 true 개수 평균 (0~4)
   `risk_flags`: `followup_overdue` (기한초과 3건 이상), `low_activity` (3일 이상 활동 없음), `high_prob_neglected` (확률 70%+ 거래처 7일 이상 미연락)

2. **`/src/app/admin/dashboard/page.tsx` 수정** (기존 파일에 팀 현황 섹션 추가)

   팀원 카드 그리드:
   ```
   👤 김영업
   거래처 45개 | 이번달 계약 3건
   통화 12회/주 | 기한초과 팔로업 ⚠️5건
   SPIN 평균: 2.3/4 | 고확률 거래처: 8개
   [⚠️ 팔로업 지연] [⚠️ 고확률 방치]
   [상세 보기 →]
   ```

3. **`/src/app/api/admin/member-detail/[id]/route.ts` 신규 생성**
   - 특정 팀원의 최근 30일 활동 타임라인
   - 팀원 거래처 중 위험 거래처 목록
   - AI: 이 팀원에게 줄 코칭 포인트 1가지 (Claude 호출)

4. **권한 체크**: 모든 admin API에서 `profile.role === 'COMPANY_ADMIN' || profile.role === 'SUPER_ADMIN'` 확인. 없으면 403.

---

### Feature S3-2: 거래처 고급 검색 & 필터

**목표**: 현재 거래처 목록은 단순 이름 검색만 가능. 산업/태그/영업단계/계약확률/마지막연락일 복합 필터 추가.

**Step 0 — grep 선행 조사**:
```bash
grep -r "clients/page\|ClientList\|거래처 목록" src/app/'(dashboard)'/clients --include="*.tsx"
grep -r "industry\|tags\|sales_status.*filter" src/app/'(dashboard)'/clients --include="*.tsx"
```

**구현 사항**:

1. **`/src/app/(dashboard)/clients/page.tsx` 수정**

   필터 패널 추가 (모바일: 토글, 데스크탑: 사이드):
   - 영업 단계 다중 선택 체크박스 (NEW_LEAD, FIRST_VISIT, ...)
   - 계약 확률 범위 슬라이더 (0~100%)
   - 마지막 연락일 필터 (오늘/이번주/이번달/30일 이상 연락 없음)
   - 산업 필터 (industry 컬럼 값들 동적 추출)
   - 태그 필터 (tags[] 배열에서 유니크 값 추출)
   - 정렬: 최근 수정순 / 계약확률 높은순 / 마지막연락 오래된순 / 이름순
   - [필터 초기화] 버튼

2. **URL 쿼리스트링 동기화**: 필터 상태를 URL에 반영 (`?status=NEW_LEAD,FOLLOW_UP&min_prob=50`) → 새로고침해도 필터 유지, 공유 가능

3. **`/src/app/api/clients/search/route.ts` 신규 생성** (복잡한 필터는 API로)
   - Supabase에서 필터 조합 쿼리 실행
   - 결과 페이지네이션 (20개씩)

---

### Feature S3-3: 스크립트 라이브러리 (자주 쓰는 멘트 저장/불러오기)

**목표**: AI가 생성한 팔로업 멘트, 영업사원이 직접 쓴 멘트를 저장해두고 통화 전 불러서 사용.

**비즈니스 근거**: SPIN Selling 연구 — 사전 준비된 스크립트를 사용한 영업사원의 성공률이 55% 높음.

**Step 0 — grep 선행 조사**:
```bash
grep -r "script\|스크립트\|라이브러리\|follow_up_message" src --include="*.tsx" --include="*.ts" -l
grep -r "profiles.metadata" src/app/api --include="*.ts" -l
```

**구현 사항**:

1. **Supabase — `scripts` 테이블 신규 생성** (마이그레이션)
   ```sql
   CREATE TABLE scripts (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
     company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
     title TEXT NOT NULL,
     content TEXT NOT NULL,
     category TEXT NOT NULL DEFAULT 'general',
     -- category: 'followup_call' | 'followup_text' | 'intro' | 'objection' | 'closing' | 'cs'
     tags TEXT[] DEFAULT '{}',
     use_count INTEGER DEFAULT 0,
     is_shared BOOLEAN DEFAULT FALSE,
     -- is_shared=true: 같은 회사 팀원도 열람 가능
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   
   ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "scripts_own" ON scripts
     FOR ALL USING (user_id = auth.uid() OR (is_shared = true AND company_id IN (
       SELECT company_id FROM profiles WHERE id = auth.uid()
     )));
   ```

2. **`/src/app/api/scripts/route.ts` 신규 생성** (GET 목록, POST 저장)

3. **`/src/app/api/scripts/[id]/route.ts` 신규 생성** (PATCH 수정, DELETE 삭제, POST use_count++)

4. **`/src/app/(dashboard)/scripts/page.tsx` 신규 생성**
   - 카테고리 탭 (팔로업 전화 / 팔로업 문자 / 소개 / 반론 처리 / 클로징 / CS)
   - 스크립트 카드 목록 (제목, 미리보기, 사용 횟수, 즐겨찾기)
   - [새 스크립트 추가], [AI에게 작성 요청] 버튼
   - [복사], [수정], [삭제] 액션
   - 팀 공유 스크립트는 🤝 배지

5. **`/src/components/layout/navItems.ts` 수정** — "스크립트" 메뉴 추가

6. **통화 분석 결과에서 스크립트 저장 연동**
   - `CallAnalysisCard.tsx`의 "팔로업 멘트" 섹션에 [📌 스크립트에 저장] 버튼 추가

7. **AI 채팅에서 스크립트 불러오기**
   - `AIChatPanel.tsx` 퀵 프롬프트에 "📋 스크립트 라이브러리" 버튼 추가
   - 클릭 시 최근 사용 스크립트 5개 표시 → 선택하면 채팅 input에 자동 입력

---

### Feature S3-4: PWA 푸시 알림 (팔로업 & CS 리마인더)

**목표**: 캘린더에 등록된 팔로업/CS 리마인더 일정이 되면 푸시 알림으로 영업사원에게 알림.

**Step 0 — grep 선행 조사**:
```bash
grep -r "next-pwa\|ServiceWorker\|push\|notification" src --include="*.ts" --include="*.tsx" -l
cat next.config.ts | head -30
```

**구현 사항**:

1. **`/src/app/api/notifications/subscribe/route.ts` 신규 생성**
   - POST. 브라우저에서 받은 PushSubscription 객체를 `profiles.metadata.push_subscription`에 저장

2. **`/src/app/api/notifications/send/route.ts` 신규 생성**
   - POST. `{ user_id, title, body, url }` → Web Push API로 발송
   - `web-push` npm 패키지 사용 (`npm install web-push`)
   - VAPID 키 환경변수: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`

3. **`/public/sw-custom.js` 신규 생성** — Service Worker 커스텀 이벤트 핸들러
   - `push` 이벤트 수신 → `showNotification()`
   - `notificationclick` 이벤트 → 앱의 해당 거래처 페이지로 이동

4. **`/src/app/(dashboard)/settings/page.tsx` 수정** — 알림 설정 섹션 추가
   - "🔔 팔로업 알림 켜기/끄기" 토글
   - 알림 시간 설정 (예: 일정 30분 전 / 당일 오전 9시)
   - VAPID 키 설정 안내 (관리자용)

5. **`/src/app/api/cron/notify/route.ts` 신규 생성** — 크론 트리거용 엔드포인트
   - GET. 오늘 알림 대상 calendar_events 조회 → 각 사용자에게 push 발송
   - Vercel Cron 또는 외부 cron으로 매일 오전 8시 호출 가능하게 설계

6. **환경변수 추가** (`.env.local`에 추가 안내):
   ```
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   VAPID_EMAIL=mailto:your@email.com
   ```
   - VAPID 키 생성: `npx web-push generate-vapid-keys` 실행 후 결과 `.env.local`에 기재

---

### Feature S3-5: 거래처 상세 페이지 — 활동 타임라인 개선

**목표**: 현재 거래처 상세의 활동 탭이 텍스트 나열만 있음. 시각적 타임라인 + 통화 분석 결과 인라인 표시 + AI 인사이트 카드 추가.

**Step 0 — grep 선행 조사**:
```bash
grep -r "activities\|타임라인\|timeline" src/app/'(dashboard)'/clients --include="*.tsx" -l
grep -r "CallRecord\|call_records" src/app/'(dashboard)'/clients --include="*.tsx" -l
```

**구현 사항**:

1. **`/src/components/clients/ActivityTimeline.tsx` 신규 생성**

   세로 타임라인 UI:
   - 날짜별 그룹핑 (오늘 / 어제 / 이번 주 / 이전)
   - 활동 유형별 아이콘:
     - 📞 CALL → 클릭 시 분석 결과 인라인 펼치기 (SPIN 체크리스트, 계약확률, 팔로업 멘트)
     - 🚗 VISIT → 방문 분석 인라인
     - 📝 NOTE → 메모 내용
     - 🤖 AI_INSIGHT → AI 추천 내용
     - 📋 STATUS_CHANGE → "NEW_LEAD → FIRST_VISIT" 시각화
   - 각 항목에 [삭제], [AI 재분석] 액션 (CALL/VISIT 타입만)
   - 하단에 [메모 추가] 인라인 폼

2. **기존 clients/[id]/page.tsx의 활동 탭** → `ActivityTimeline` 컴포넌트로 교체

3. **`/src/app/api/clients/[id]/activities/route.ts` 신규 생성**
   - GET: 활동 목록 + 연관 call_records/visit_records 조인
   - POST: 새 활동(메모) 추가
   - DELETE: 활동 삭제

---

## 🗄️ Sprint 3 Supabase 마이그레이션

```sql
-- 파일: src/lib/supabase/migrations/20260623_sprint3.sql

-- 1. scripts 테이블
CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  use_count INTEGER DEFAULT 0,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scripts_user ON scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_company_shared ON scripts(company_id, is_shared);

ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "scripts_access" ON scripts
  FOR ALL USING (
    user_id = auth.uid() OR (
      is_shared = true AND company_id IN (
        SELECT company_id FROM profiles WHERE id = auth.uid() AND company_id IS NOT NULL
      )
    )
  );

-- 2. activities에 STATUS_CHANGE 데이터 개선용 인덱스
CREATE INDEX IF NOT EXISTS idx_activities_type_client
ON activities(client_id, type, created_at DESC);

-- 3. push subscription용 인덱스 (metadata JSONB 검색)
CREATE INDEX IF NOT EXISTS idx_profiles_push_sub
ON profiles((metadata->>'push_subscription'))
WHERE metadata->>'push_subscription' IS NOT NULL;

-- 4. scripts updated_at 트리거
CREATE TRIGGER IF NOT EXISTS update_scripts_updated_at
  BEFORE UPDATE ON scripts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 🔧 환경변수 추가

```bash
# Web Push (S3-4)
VAPID_PUBLIC_KEY=BExamplePublicKey...
VAPID_PRIVATE_KEY=ExamplePrivateKey...
VAPID_EMAIL=mailto:admin@yourcompany.com

# VAPID 키 생성 방법:
# npx web-push generate-vapid-keys
# 결과를 위 세 변수에 넣으면 됨
```

---

## 📋 완료 보고서 형식 (파일 하단에 추가 + 채팅에도 출력)

```markdown
## 📋 Sprint 3 구현 완료 보고서 — [날짜]

### Feature S3-0: 기존 버그 수정
- [버그1] useDashboardConfig lint 에러:
  - 상태: 수정 / 미수정
  - 방법: [구체적 설명]
- [버그2] AI 채팅 토큰 트리밍:
  - 상태: 수정 / 미수정
  - 방법:
- [버그3] OCR Storage 피드백:
- [버그4] 경쟁사 win_rate 개선:
- [버그5] 일일 브리핑 fallback:
- [버그6] 일지 transcript 상향:

### Feature S3-1: 팀 관리자 대시보드
- Step 0 grep 결과: [있음/없음]
- 상태: 신규 구현 / 보강
- 생성/수정 파일: [목록]
- 특이사항:

### Feature S3-2: 거래처 고급 검색 & 필터
- Step 0 grep 결과:
- 상태:
- 생성/수정 파일:
- 특이사항:

### Feature S3-3: 스크립트 라이브러리
- Step 0 grep 결과:
- 상태:
- 생성/수정 파일:
- 특이사항:

### Feature S3-4: PWA 푸시 알림
- Step 0 grep 결과:
- 상태:
- 생성/수정 파일:
- 특이사항:

### Feature S3-5: 활동 타임라인 개선
- Step 0 grep 결과:
- 상태:
- 생성/수정 파일:
- 특이사항:
```

---

## ⚡ 실행 순서

1. **S3-0** (버그 수정) — 반드시 가장 먼저
2. **SQL 마이그레이션** (`20260623_sprint3.sql`)
3. **S3-3** (스크립트 라이브러리) — DB 의존, 독립적
4. **S3-2** (거래처 필터) — 독립적, 빠른 가치
5. **S3-5** (활동 타임라인) — clients 페이지 의존
6. **S3-1** (팀 관리자) — admin API 의존
7. **S3-4** (푸시 알림) — 환경변수 필요, 마지막

---

## 🚨 주의사항

1. **S3-0 버그 수정 우선**: 기존 버그를 고치지 않으면 Sprint 3 기능 위에 새 버그가 쌓인다
2. **S3-1 권한 체크**: admin API는 반드시 `COMPANY_ADMIN` 또는 `SUPER_ADMIN` 확인 후 진행. 미확인 시 보안 구멍
3. **S3-3 RLS**: `scripts` 테이블 RLS 정책 반드시 적용. `is_shared=true`인 스크립트는 같은 company_id 사용자만
4. **S3-4 VAPID 키**: 환경변수 없으면 `web-push` 패키지 초기화 실패 → 에러 핸들링으로 명확한 메시지
5. **S3-5 성능**: 활동 타임라인은 데이터 많을 수 있음 → 처음 20개만 로드, 무한스크롤 또는 [더 보기] 버튼
6. **채팅 자기비판 출력**: 구현 완료 후 채팅 응답 마지막에 반드시 위의 "자기비판 채팅 출력 형식" 형태로 출력

---

## 📋 Sprint 3 구현 완료 보고서 — 2026-06-24

### Feature S3-0: 기존 버그 수정 (6/6 완료)
- **[버그1] useDashboardConfig / useKanbanConfig lint 에러**
  - 상태: 수정
  - 방법: `useEffect + setState` 패턴 제거. `useMemo`로 `profile.metadata`에서 derived state 계산. `saveWidgets/saveColumns`는 zustand `useAuthStore.setProfile`로 optimistic update + DB write. merge 로직(기본 항목 자동 추가) 동일 유지.
- **[버그2] AI 채팅 토큰 무제한 누적**
  - 상태: 수정
  - 방법: `/api/ai/chat/route.ts`에서 `MAX_TURNS = 20`으로 슬라이싱 → 모델에 전달. 클라이언트는 zustand persist로 전체 히스토리 유지.
- **[버그3] 명함 OCR Storage 피드백**
  - 상태: 수정
  - 방법: `/api/ai/ocr-card/route.ts`에서 upload 실패 시 `storage_warning: "명함 이미지 저장 실패. 텍스트 정보만 추출됩니다."` 응답 필드 추가. `QuickCapture.tsx`의 CARD review 단계 상단에 amber 알림 박스 표시.
- **[버그4] 경쟁사 win_rate 시점 정보 손실**
  - 상태: 수정
  - 방법: `/api/stats/competitors/route.ts` 전면 재작성. 경쟁사 언급 통화별 `client_id + created_at` 기록 → `activities` 테이블에서 같은 client의 STATUS_CHANGE 활동 조회 → 통화 이후 90일 이내 CONTRACTED 전환 카운트. STATUS_CHANGE 활동이 부족하면 현재 status snapshot으로 fallback + `win_rate_note: '데이터 부족, 참고용'`. 위젯에 amber note 표시.
- **[버그5] 일일 브리핑 AI 실패 fallback**
  - 상태: 수정
  - 방법: API 응답에 `fallback: 'none' | 'stale_cache' | 'rule_based'` 필드 추가. Claude 실패 시 ① 직전 일자 캐시 ② 규칙 기반 TOP 3 (overdue → high_prob → CS risk) 순서로 fallback. 위젯에 "⚠️ AI 연결 불안정 — {날짜} 캐시" / "규칙 기반 추천" 배지 표시. 캐시 저장은 성공 케이스에만.
- **[버그6] 일지 transcript 600자 제한**
  - 상태: 수정
  - 방법: 통화 수 < 5면 2000자, ≥5면 1000자로 동적 조정. call/visit 모두 동일 cap 적용.

### Sprint 3 SQL 마이그레이션
- 파일: `supabase/migrations/20260624_sprint3.sql`
- 내용: `scripts` 테이블 + RLS 정책 (자기 소유 OR 같은 회사 공유) + updated_at 트리거 + 3개 인덱스 (`idx_scripts_user`, `idx_scripts_company_shared`, `idx_scripts_category_use_count`), `activities` 타임라인 + win_rate 쿼리용 `idx_activities_type_client`, push subscription 조회용 `idx_profiles_push_sub` (부분 인덱스).
- 헬퍼: 기존 schema.sql의 `update_updated_at()` 함수 재사용.

### Feature S3-3: 스크립트 라이브러리
- Step 0 grep 결과: prompts.ts에 단어만 등장, 기능 부재 → 신규 구현
- 상태: 신규
- 생성 파일:
  - `src/app/api/scripts/route.ts` — GET (category/q 필터) + POST
  - `src/app/api/scripts/[id]/route.ts` — PATCH/DELETE/POST(use_count++)
  - `src/app/(dashboard)/scripts/page.tsx` — 카테고리 탭(7종) + 검색 + 카드 그리드 + 에디터 모달
- 수정 파일:
  - `src/components/layout/navItems.ts` — `/scripts` 메뉴 추가 (BookText 아이콘)
  - `src/components/calls/CallAnalysisCard.tsx` — 팔로업 멘트 섹션에 `📌 스크립트에 저장` 버튼 (followup_text 카테고리, ai_generated 태그)
  - `src/components/ai/AIChatPanel.tsx` — 빈 상태 빠른 프롬프트 + 입력창 상단에 `📋 스크립트` 버튼 → 바텀 시트로 최근 사용 5개 표시 → 클릭 시 input에 삽입 + use_count++
- ownership 필드로 본인/공유받음 구분, 🤝 배지 표시. RLS 정책으로 보안 보장.

### Feature S3-2: 거래처 고급 검색 & 필터
- Step 0 grep 결과: 기존 페이지에 status chip + 이름 검색만 있음 → 보강
- 상태: 보강 (페이지 재작성)
- 생성 파일:
  - `src/app/api/clients/search/route.ts` — 단계 다중 선택 + 확률 범위 + 산업/태그 + 마지막 연락 윈도우 + 4종 정렬 + 페이지네이션 (20/페이지)
- 수정 파일:
  - `src/app/(dashboard)/clients/page.tsx` — FilterPanel 컴포넌트 (모바일 우측 슬라이드, 데스크탑 좌측 사이드), 산업/태그 옵션은 한 번 로드해 동적 추출, URL 쿼리스트링 동기화 (`?status=A,B&min_prob=50` 등), [더 보기] 버튼으로 페이지 추가 로드
- 정렬 4종: 최근수정 / 확률높은순 / 마지막연락오래된순 / 이름순

### Feature S3-5: 활동 타임라인 개선
- Step 0 grep 결과: clients/[id]/page에 단순 텍스트 리스트만 있음 → 신규 컴포넌트로 교체
- 상태: 신규
- 생성 파일:
  - `src/components/clients/ActivityTimeline.tsx` — 오늘/어제/이번주/이전 그룹핑, 활동별 아이콘, CALL/VISIT 펼치기로 분석 인라인 표시(CallAnalysisCard 재사용), STATUS_CHANGE는 from→to 배지 시각화, 메모 인라인 추가, 삭제·AI 재분석 액션, [더 보기] 페이지네이션
  - `src/app/api/clients/[id]/activities/route.ts` — GET (call/visit 자동 연결: metadata.call_id 우선, 시간 근접도로 fallback) + POST (NOTE) + DELETE. 거래처 소유자 OR 같은 회사 멤버만 접근 허용
- 수정: `src/app/(dashboard)/clients/[id]/page.tsx` — timeline 탭 → `<ActivityTimeline />`, 사용 안 하던 `activities` state/임포트 제거

### Feature S3-1: 팀 관리자 대시보드
- Step 0 grep 결과: admin/dashboard 존재하지만 팀원 현황 위젯 없음 → 보강
- 상태: 보강 (신규 위젯 + 신규 API 2개)
- 생성 파일:
  - `src/app/api/admin/team-stats/route.ts` — `COMPANY_ADMIN/SUPER_ADMIN`만 접근, 팀원별 stats(거래처, 이번달 계약, 이번주 통화, 기한초과, 고확률, 평균 확률, 마지막 활동, SPIN 평균) + risk_flags(`followup_overdue` 3건+, `low_activity` 3일+, `high_prob_neglected` 7일+ 미연락 70%+) + team_totals
  - `src/app/api/admin/member-detail/[id]/route.ts` — 30일 활동, 위험 거래처, Claude로 코칭 포인트 1개(praise/improvement/action) JSON 응답. 데이터 부족 시 fallback 메시지
  - `src/components/admin/TeamMembersPanel.tsx` — 팀원 카드 그리드 + 위험 플래그 칩 + 우측 슬라이드 상세 패널(AI 코칭, 위험 거래처, 30일 활동)
- 수정:
  - `src/types/index.ts` — `AdminDashboardWidgetId`에 `'team-members'` 추가, 기본 활성
  - `src/app/admin/dashboard/page.tsx` — renderWidget 케이스, WIDGET_SPAN: 'full'
  - `src/components/admin/AdminDashboardEditModal.tsx` — WIDGET_META 항목 추가

### Feature S3-4: PWA 푸시 알림
- Step 0 grep 결과: next-pwa 의존성 존재하나 SW 등록/구독 없음 → 신규
- 상태: 신규
- 생성 파일:
  - `public/sw-custom.js` — `push` 이벤트 핸들러, `notificationclick` 시 해당 URL로 포커스/이동
  - `src/lib/notifications/webPush.ts` — `web-push` 동적 import, 미설치/미설정 시 graceful degrade (`pushReadinessError()` 반환)
  - `src/app/api/notifications/subscribe/route.ts` — POST(저장) / PATCH(설정만) / DELETE(구독 해제), `profiles.metadata.push_subscription` + `notification_settings`
  - `src/app/api/notifications/send/route.ts` — 본인 또는 admin만 발송 허용
  - `src/app/api/cron/notify/route.ts` — 24시간 이내 미완료 일정 조회 → 각 사용자 설정에 맞춰 알림 발송. `CRON_SECRET` 헤더 옵션
  - `src/components/settings/NotificationSettings.tsx` — 권한 체크 + SW 등록 + Push 구독 + 설정 폼(N분 전 / 당일 시간)
- 수정:
  - `package.json` — `web-push@^3.6.7`, `@types/web-push@^3.6.4` 추가 (사용자 `npm install` 필요)
  - `src/app/(dashboard)/settings/page.tsx` — NotificationSettings 섹션 (회사와 테마 사이)
- 환경변수 필요: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`, 옵션 `CRON_SECRET`. 생성 명령: `npx web-push generate-vapid-keys`.
- 미설정 시 settings UI에 amber 안내 + send/cron 라우트는 500 + hint 반환.

