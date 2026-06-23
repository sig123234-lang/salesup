# SalesUp — Claude Code 구현 프롬프트 v2.0 (Sprint 2)

> 이 파일을 Claude Code에 붙여넣어 실행하세요.  
> 작성일: 2026-06-23  
> 대상 코드베이스: `/Users/kim/Desktop/salesupapp/salesup`  
> Sprint 1 완료 기준: F1~F9 구현됨 (Claude API, AI 채팅, CS 리마인더, MEDDIC 등)

---

## ⚠️ 시작 전 필수 지침

1. **이 파일을 처음부터 끝까지 3번 완전히 읽어라.**
2. **각 항목 Step 0 grep → 보고서에 기재. 이미 있으면 "보강"만, 없으면 "신규 구현".**
3. **구현 완료 후 "📋 완료 보고서 형식" 채워라.**
4. **⭐ 마지막에 "🔧 자기비판 검토" 작성. 변명 금지.**
5. **"다음 sprint에", "별도 sprint" 금지.**

---

## 🏗️ Sprint 1 완료 현황 (건드리지 말 것)

아래 파일들은 이미 구현됨. 수정 시 기존 로직 보존:

```
src/lib/claude/client.ts          ← Claude API 클라이언트
src/lib/claude/prompts.ts         ← AI 프롬프트 상수
src/lib/ai/unified.ts             ← AI 추상화 레이어 (jsonCompletion, chatStream)
src/components/ai/AIChatPanel.tsx ← AI 채팅 패널
src/components/widgets/CSReminderWidget.tsx
src/components/widgets/FollowupCounterWidget.tsx
src/components/clients/MEDDICWidget.tsx
src/components/calls/SuggestedCalendarCard.tsx
src/components/calls/CallAnalysisCard.tsx
src/app/api/ai/chat/route.ts
src/app/api/ai/calendar-from-analysis/route.ts
src/app/api/ai/meddic-fill/route.ts
src/lib/supabase/migrations/20260623_ai_assistant.sql  ← 이미 실행됨
```

---

## 📦 Sprint 2 구현 목록

---

### Feature S2-1: AI 일일 브리핑 위젯

**목표**: 매일 아침 대시보드에 "오늘 해야 할 TOP 3 액션"을 AI가 자동 생성. 영업사원이 앱을 열자마자 무엇부터 할지 바로 알 수 있게.

**비즈니스 근거**: 고성과 영업사원의 82%는 매일 리서치와 우선순위 설정을 함 (HubSpot 연구).

**Step 0 — grep 선행 조사**:
```bash
grep -r "DailyBrief\|일일브리핑\|daily_brief" src --include="*.tsx" --include="*.ts" -l
grep -r "WidgetId" src/types/index.ts
```

**구현 사항**:

1. **`/src/app/api/ai/daily-brief/route.ts` 신규 생성**

   GET 요청. 오늘 날짜 기반 캐시 (같은 날 두 번 호출 시 DB 저장본 반환).
   
   Claude에게 전달하는 데이터:
   - 오늘 calendar_events (오늘 일정)
   - 오늘 기한 초과된 follow_up alert (next_contact_at < now)
   - 계약 확률 70% 이상 거래처 목록
   - 마지막 연락이 7일 이상 지난 CONTRACTED 거래처 (CS 위험)
   - 이번 달 계약 건수 vs 저번 달
   
   Claude 응답 JSON:
   ```json
   {
     "greeting": "좋은 아침이에요, {이름}님! 오늘 집중할 3가지예요 👇",
     "top_actions": [
       {
         "priority": 1,
         "icon": "🔥",
         "title": "A사 계약 마무리",
         "reason": "계약 확률 85%, 지난 통화에서 긍정 반응",
         "action": "오늘 오전 중 계약서 발송",
         "client_id": "uuid-or-null"
       }
     ],
     "today_stats": {
       "scheduled_calls": 2,
       "overdue_followups": 3,
       "high_prob_clients": 4
     },
     "motivation": "오늘 3건만 잡아도 이번 달 목표 달성 가능해요!"
   }
   ```
   
   저장 위치: `profiles.metadata.daily_brief_cache = { date: 'YYYY-MM-DD', data: {...} }` (하루 1회만 AI 호출)

2. **`/src/components/widgets/DailyBriefWidget.tsx` 신규 생성**

   UI 구성:
   - 최상단 greeting 텍스트
   - TOP 3 액션 카드 (아이콘 + 제목 + 이유 + 액션 버튼)
   - 각 카드에 [바로가기] 버튼 → client_id 있으면 `/clients/{id}`로 이동
   - 하단 오늘 통계 3종 (오늘 일정 / 기한 초과 팔로업 / 고확률 거래처)
   - 우측 상단 [새로고침] 버튼 (캐시 무시 강제 재생성)
   - 로딩 중: 스켈레톤 애니메이션

3. **`/src/types/index.ts` 수정**
   - `WidgetId`에 `'daily-brief'` 추가
   - `DEFAULT_WIDGET_CONFIG`에 `{ id: 'daily-brief', enabled: true }` 최상단에 추가
   - `WIDGET_SPAN`에 `'daily-brief': 'full'` 추가

4. **`/src/app/(dashboard)/dashboard/page.tsx` 수정**
   - `renderWidget()` 에 `'daily-brief'` 케이스 추가
   - `DailyBriefWidget` import

5. **`/src/components/widgets/DashboardEditModal.tsx` 수정**
   - "AI 일일 브리핑" 위젯 선택 옵션 추가

---

### Feature S2-2: 자동 팔로업 시퀀스

**목표**: 통화/방문 완료 후 연구 기반 5단계 팔로업 일정을 원클릭으로 캘린더에 자동 등록.

**비즈니스 근거**: 
- 80% 계약은 5회 이상 팔로업 필요 (업계 연구)
- 44%의 영업사원은 1번 시도 후 포기 → 시퀀스 자동화로 경쟁 우위
- 최적 간격: 2일 → 5일 → 10일 → 21일 → 30일

**Step 0 — grep 선행 조사**:
```bash
grep -r "sequence\|시퀀스\|followup_seq" src --include="*.ts" --include="*.tsx" -l
grep -r "calendar_events" src/app/api --include="*.ts" -l
```

**구현 사항**:

1. **`/src/app/api/ai/followup-sequence/route.ts` 신규 생성**

   POST. `{ client_id, call_record_id?, base_date?, sequence_type }` 받음.
   
   `sequence_type`:
   - `'standard'`: 일반 팔로업 (2/5/10/21/30일)
   - `'hot'`: 고확률 거래처 (1/3/7/14일) — 계약 확률 70% 이상
   - `'nurture'`: 장기 육성 (7/21/45/90일) — 계약 확률 40% 미만
   - `'cs'`: CS 사후관리 (7/30/90/180/270/335일) — CONTRACTED
   
   Claude에게 고객 정보 + 마지막 통화 분석 제공 → 각 일정 제목/메모 커스터마이징
   
   응답:
   ```json
   {
     "sequence": [
       {
         "step": 1,
         "title": "A사 1차 팔로업 — 제안서 확인",
         "due_date": "2026-06-25T10:00:00",
         "type": "CALL",
         "notes": "지난 통화에서 가격 검토 언급. 할인 조건 준비 필요."
       }
     ]
   }
   ```
   
   모두 `calendar_events`에 `source: 'followup_sequence'`로 저장

2. **`/src/components/calls/FollowupSequenceCard.tsx` 신규 생성**

   통화 분석 완료 후 (또는 거래처 상세 페이지에서) 표시:
   ```
   📋 팔로업 시퀀스 자동 등록
   ────────────────────────────
   이 거래처에 맞는 팔로업 일정을 자동으로 만들어드릴까요?
   
   [🔥 핫 팔로업 — 4회 (1/3/7/14일)]  ← 계약 확률 70%+ 시 강조
   [📞 일반 팔로업 — 5회 (2/5/10/21/30일)]
   [🌱 장기 육성 — 4회 (7/21/45/90일)]
   
   ✅ 시퀀스 등록 시 캘린더에 자동 저장됩니다
   ────────────────────────────
   [등록하기] [건너뛰기]
   ```

3. **`/src/app/(dashboard)/clients/[id]/page.tsx` 또는 관련 컴포넌트 수정**
   - 거래처 상세 페이지 액션 버튼에 "팔로업 시퀀스 등록" 추가
   - 이미 시퀀스가 등록된 경우 "시퀀스 진행 중 (N/5)" 표시

4. **`/src/components/widgets/FollowupCounterWidget.tsx` 보강** (Sprint 1에서 생성됨)
   - 시퀀스 단계 진행 상황 표시 추가
   - "1차 팔로업 완료, 2차 D-3" 형태로

---

### Feature S2-3: 성과 트래킹 & 목표 설정 위젯

**목표**: 월간 계약 목표 설정 + 실시간 달성률 + 영업 활동 지표 시각화.

**비즈니스 근거**: 목표를 수치로 추적하는 팀은 그렇지 않은 팀 대비 성과 73% 향상 (연구 기반).

**Step 0 — grep 선행 조사**:
```bash
grep -r "goal\|quota\|목표\|달성" src --include="*.tsx" --include="*.ts" -l
grep -r "recharts\|BarChart\|LineChart" src --include="*.tsx" -l
```

**구현 사항**:

1. **Supabase 마이그레이션** — `profiles.metadata`에 목표 저장 (스키마 변경 없음)
   ```json
   {
     "monthly_goal": {
       "contracts": 5,
       "calls": 50,
       "visits": 20
     }
   }
   ```

2. **`/src/app/api/stats/monthly/route.ts` 신규 생성**
   
   GET. 현재 월 기준:
   - 계약 완료 건수 (clients WHERE sales_status = 'CONTRACTED' AND updated_at 이번 달)
   - 총 통화 건수 (call_records 이번 달)
   - 총 방문 건수 (visit_records 이번 달)
   - 지난 3개월 월별 계약 건수 (recharts용)
   - 영업 단계별 거래처 분포 (kanban 현황)

3. **`/src/components/widgets/GoalTrackerWidget.tsx` 신규 생성**

   UI 구성 (recharts 활용):
   - 이번 달 목표 달성률 3종 원형 게이지:
     - 계약 건수: N / 목표
     - 통화 건수: N / 목표  
     - 방문 건수: N / 목표
   - 하단: 최근 3개월 계약 건수 바차트 (recharts BarChart)
   - 목표 설정 버튼 → 인라인 수정 모드 (input 3개)
   - 목표 미설정 시: "📊 월간 목표를 설정해보세요" 온보딩 카드

4. **`/src/types/index.ts` 수정**
   - `WidgetId`에 `'goal-tracker'` 추가
   - `DEFAULT_WIDGET_CONFIG`에 `{ id: 'goal-tracker', enabled: false }` 추가 (기본 off, 사용자가 켜는 방식)

5. **`/src/app/(dashboard)/dashboard/page.tsx`** 수정
   - `renderWidget()` 에 `'goal-tracker'` 케이스 추가

---

### Feature S2-4: 경쟁사 인텔리전스 위젯

**목표**: 통화 분석에서 자동 수집된 경쟁사 언급 데이터를 집계해서 "현장에서 어떤 경쟁사가 얼마나 나오는지" 시각화.

**비즈니스 근거**: Challenger Sale — 경쟁사 차별화 포인트를 선제적으로 알아야 "Teach" 단계에서 우위 선점 가능.

**Step 0 — grep 선행 조사**:
```bash
grep -r "competitor\|경쟁사" src --include="*.ts" --include="*.tsx" -l
grep -r "call_records" src/app/api --include="*.ts" -l
```

**구현 사항**:

1. **`/src/app/api/stats/competitors/route.ts` 신규 생성**

   GET. call_records에서 analysis.competitor_names 집계:
   ```json
   {
     "competitors": [
       { "name": "A사", "count": 12, "win_rate": 67, "avg_probability_when_mentioned": 45 },
       { "name": "B사", "count": 8, "win_rate": 50, "avg_probability_when_mentioned": 55 }
     ],
     "total_calls_with_competitors": 20,
     "total_calls": 100
   }
   ```
   
   `win_rate`: 해당 경쟁사가 언급된 통화에서 결국 계약(CONTRACTED)된 비율

2. **`/src/components/widgets/CompetitorWidget.tsx` 신규 생성**

   UI:
   - "경쟁사 현황" 헤더
   - 경쟁사별 언급 횟수 + 승률 바 (recharts HorizontalBar)
   - 클릭 시 해당 경쟁사가 언급된 통화 기록 리스트
   - 빈 상태: "아직 경쟁사 데이터가 없어요. 통화 분석을 하면 자동으로 수집돼요."
   - 승률이 낮은 경쟁사에 ⚠️ 표시 + "대응 전략 AI에게 물어보기" 버튼 (AI 채팅 연동)

3. **`/src/types/index.ts` 수정**
   - `WidgetId`에 `'competitor-intel'` 추가
   - `DEFAULT_WIDGET_CONFIG`에 `{ id: 'competitor-intel', enabled: false }` 추가

---

### Feature S2-5: 명함 사진 → 거래처 자동 등록 (AI OCR)

**목표**: 명함 사진을 찍으면 AI가 이름/회사/전화/이메일/주소를 추출해 거래처로 자동 등록.

**비즈니스 근거**: 영업사원이 가장 귀찮아하는 데이터 입력 제거 → 현장 사용성 극대화. 기존 `business_card_url` 컬럼 활용.

**Step 0 — grep 선행 조사**:
```bash
grep -r "business_card\|명함\|OCR" src --include="*.ts" --include="*.tsx" -l
grep -r "QuickCaptureMode\|VOICE\|CLIENT" src/types/index.ts
```

**구현 사항**:

1. **`/src/app/api/ai/ocr-card/route.ts` 신규 생성**

   POST. `FormData` — `image` 파일 받음.
   
   처리 흐름:
   1. 이미지를 Supabase Storage `business-cards/{user_id}/{timestamp}.jpg`에 업로드
   2. Claude Vision (claude-sonnet-4-6) 에 base64 이미지 전달
   3. 추출 JSON 반환:
   ```json
   {
     "name": "김철수 대리",
     "company": "ABC 물류",
     "contact_name": "김철수",
     "phone": "010-1234-5678",
     "email": "kim@abc.co.kr",
     "address": "서울시 강남구 테헤란로 123",
     "department": "물류팀",
     "position": "대리",
     "business_card_url": "storage-path"
   }
   ```
   4. 추출 결과로 clients 테이블 INSERT (또는 미리보기만 반환 후 사용자 확인)

2. **`/src/components/quick-capture/QuickCapture.tsx` 수정**
   - `QuickCaptureMode['mode']` 타입에 `'CARD'` 추가 (types에도 추가)
   - CARD 모드 UI:
     ```
     📷 명함 촬영 / 업로드
     ─────────────────────
     [카메라로 촬영]  [갤러리에서 선택]
     (미리보기 이미지)
     
     AI 분석 중... → 추출 결과 표시
     
     회사명: [ABC 물류      ]
     담당자: [김철수        ]
     전화:   [010-1234-5678 ]
     이메일: [kim@abc.co.kr ]
     주소:   [서울시 강남구..]
     ─────────────────────
     [✅ 거래처 등록] [다시 촬영]
     ```

3. **`/src/components/quick-capture/FloatingAIButton.tsx` 수정**
   - 퀵 캡처 메뉴에 "📷 명함 등록" 버튼 추가

4. **`/src/types/index.ts` 수정**
   - `QuickCaptureMode['mode']`에 `'CARD'` 추가

---

### Feature S2-6: 영업 일지 자동 생성

**목표**: 하루 영업 활동(통화/방문/메모)을 AI가 자동으로 일지 형태로 정리. 저녁에 보고서 뽑을 때 원클릭으로 완성.

**Step 0 — grep 선행 조사**:
```bash
grep -r "daily\|일지\|report\|보고" src --include="*.ts" --include="*.tsx" -l
grep -r "activities.*created_at\|call_records.*today" src/app/api --include="*.ts" -l
```

**구현 사항**:

1. **`/src/app/api/ai/daily-report/route.ts` 신규 생성**

   POST. `{ date?: string }` — 특정 날짜 일지 (기본: 오늘)
   
   수집 데이터:
   - 해당일 call_records + analysis
   - 해당일 visit_records
   - 해당일 activities (NOTE 포함)
   - 해당일 calendar_events (완료된 것)
   
   Claude 응답:
   ```json
   {
     "date": "2026-06-23",
     "summary": "오늘 총 8건 활동. A사 계약 직전, B사 신규 발굴.",
     "highlights": ["A사 계약 확률 85%로 상승", "C사 경쟁사(D사) 언급 확인"],
     "sections": [
       {
         "title": "📞 통화 요약 (5건)",
         "items": ["A사 김팀장: 제안서 검토 중, 가격 협의 필요", "B사 이대리: 신규 문의, 다음 주 방문 예정"]
       },
       {
         "title": "🚗 방문 요약 (2건)",
         "items": ["C사 현장 방문: 샘플 제공, 반응 긍정적"]
       },
       {
         "title": "📋 내일 해야 할 일",
         "items": ["A사 계약서 발송", "B사 방문 일정 확정", "D사 대응 전략 준비"]
       }
     ],
     "markdown": "# 2026-06-23 영업 일지\n\n..."
   }
   ```

2. **`/src/app/(dashboard)/dashboard/page.tsx` 또는 별도 페이지**
   
   대시보드 하단 또는 `/reports` 신규 페이지:
   - "📋 오늘 일지 생성" 버튼
   - 일지 렌더링 (마크다운 형태)
   - [복사하기] [다운로드] 버튼 (텍스트 복사 → 카카오톡/이메일로 보고)

3. **`/src/types/index.ts` 수정**
   - `WidgetId`에 `'daily-report'` 추가 (대시보드 위젯으로도 표시 가능)

---

### Feature S2-7: 캘린더 페이지 개선

**목표**: 현재 월별 그리드만 있는 캘린더를 주간 뷰 추가 + AI 생성 일정 시각적 구분 + 이벤트 클릭 상세보기.

**Step 0 — grep 선행 조사**:
```bash
grep -r "CalendarPage\|calendar/page" src --include="*.tsx" -l
grep -r "is_ai_generated\|source.*ai" src --include="*.tsx" --include="*.ts" -l
```

**구현 사항**:

1. **`/src/app/(dashboard)/calendar/page.tsx` 수정**

   탭 추가:
   - [월별 보기] (기존)
   - [주별 보기] (신규) — 7일 컬럼 + 시간대 행

   이벤트 시각적 구분:
   - `is_ai_generated: true` 또는 `source: 'ai_analysis' | 'cs_reminder' | 'followup_sequence'` → 🤖 아이콘 + 파란색 점선 테두리
   - `source: 'cs_reminder'` → ❤️ 아이콘 (CS 관리 일정)
   - `source: 'followup_sequence'` → 🔄 아이콘 (팔로업 시퀀스)
   - 수동 등록 → 기존 스타일 유지

   이벤트 클릭 시 사이드 패널/모달:
   - 제목, 시간, 유형, 연결된 거래처
   - [완료 처리] [수정] [삭제] 버튼
   - AI 생성 일정이면 "AI가 생성한 일정 · 이유: ..." 표시

2. **주간 뷰 컴포넌트** `WeeklyCalendarView` 분리 생성

---

## 🗄️ 추가 Supabase 마이그레이션

```sql
-- Sprint 2 마이그레이션
-- 파일: src/lib/supabase/migrations/20260623_sprint2.sql

-- 1. followup_sequence source 구분 (source 컬럼은 Sprint 1에서 추가됨, 값만 추가)
-- source 가능한 값: 'manual' | 'ai_analysis' | 'ai_recommendation' | 'quick_capture' | 'cs_reminder' | 'followup_sequence'
-- 스키마 변경 불필요 (TEXT 컬럼)

-- 2. business_cards 스토리지 버킷 생성 (Supabase Dashboard에서 수동으로)
-- 버킷명: business-cards, Public: false

-- 3. 통계 쿼리 성능용 인덱스
CREATE INDEX IF NOT EXISTS idx_call_records_user_created 
ON call_records(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_user_created 
ON activities(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clients_status_updated 
ON clients(owner_id, sales_status, updated_at DESC);

-- 4. competitor stats를 위한 GIN 인덱스 (JSONB 분석 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_call_records_analysis_gin
ON call_records USING GIN (analysis);
```

---

## 🔧 환경변수 추가 사항

없음. Sprint 1에서 설정 완료.

단, 명함 OCR을 위해 Supabase Storage `business-cards` 버킷이 필요:
1. Supabase Dashboard → Storage → New Bucket
2. 이름: `business-cards`, Public: OFF
3. RLS 정책: `auth.uid() = owner_id` 형태로 설정

---

## 📋 완료 보고서 형식

구현 완료 후 이 파일 하단에 추가:

```markdown
## 📋 Sprint 2 구현 완료 보고서 — [날짜]

### Feature S2-1: AI 일일 브리핑 위젯
- 상태: 신규 구현 / 보강
- 생성/수정 파일: [목록]
- Step 0 grep 결과: [없음 → 신규 / 있음 → 보강]
- 특이사항:

### Feature S2-2: 자동 팔로업 시퀀스
...

### Feature S2-3: 성과 트래킹 위젯
...

### Feature S2-4: 경쟁사 인텔리전스 위젯
...

### Feature S2-5: 명함 OCR 자동 등록
...

### Feature S2-6: 영업 일지 자동 생성
...

### Feature S2-7: 캘린더 개선
...

### 🔧 자기비판 검토
- 완벽하게 구현된 것:
- 부족하거나 개선 필요한 것:
- 테스트하지 못한 부분:
- 사용자가 추가로 확인해야 할 사항:
```

---

## ⚡ 실행 순서

1. **SQL 마이그레이션** 먼저 (`20260623_sprint2.sql`)
2. **S2-1** (일일 브리핑) — 독립적, 빠른 가치
3. **S2-3** (성과 트래킹) — 독립적
4. **S2-4** (경쟁사) — call_records 데이터 의존
5. **S2-2** (팔로업 시퀀스) — calendar_events 의존
6. **S2-5** (명함 OCR) — Claude Vision + Storage
7. **S2-6** (일지 생성) — 여러 테이블 의존
8. **S2-7** (캘린더 개선) — 가장 프론트엔드 집중

---

## 🚨 주의사항

1. **Claude Vision 사용** (S2-5): `claude-sonnet-4-6` 필수. Haiku는 이미지 인식 품질 낮음
2. **일일 브리핑 캐시** (S2-1): 같은 날 여러 번 호출 시 비용 과다 → 반드시 날짜 기반 캐시 구현
3. **팔로업 시퀀스 중복 방지** (S2-2): 같은 거래처에 이미 시퀀스 등록된 경우 덮어쓰기 전 확인 모달
4. **recharts import** (S2-3, S2-4): 이미 package.json에 있음, 별도 설치 불필요
5. **Sprint 1 파일 보존**: `src/lib/claude/prompts.ts`, `src/lib/ai/unified.ts` 등 Sprint 1 코어 파일 수정 시 기존 export 보존
6. **모바일 대응**: 모든 신규 위젯은 모바일(375px) 기준으로도 읽기 가능하게

---

## 📋 Sprint 2 구현 완료 보고서 — 2026-06-23

### SQL 마이그레이션
- 상태: 신규 구현
- 파일: `supabase/migrations/20260623_sprint2.sql`
- 추가된 인덱스:
  - `idx_call_records_user_created (user_id, created_at DESC)`
  - `idx_activities_user_created (user_id, created_at DESC)`
  - `idx_clients_status_updated (owner_id, sales_status, updated_at DESC)`
  - `idx_call_records_analysis_gin USING GIN (analysis)`
- 스키마 변경 없음 — 모든 신규 상태는 기존 JSONB 컬럼에 저장 (`profiles.metadata.{daily_brief_cache,monthly_goal}`, `calendar_events.source='followup_sequence'`)
- 특이사항: `business-cards` Storage 버킷은 Supabase Dashboard에서 수동 생성 필요 (Public: OFF, RLS: `auth.uid()::text = (storage.foldername(name))[1]`)

### Feature S2-1: AI 일일 브리핑 위젯
- 상태: 신규 구현
- Step 0 grep: 없음 → 신규
- 생성 파일:
  - `src/app/api/ai/daily-brief/route.ts` — GET, 날짜 기반 캐시 (`profiles.metadata.daily_brief_cache.date === today` 일 때 DB 캐시 반환, `?force=1`로 강제 재생성)
  - `src/components/widgets/DailyBriefWidget.tsx`
- 수정 파일:
  - `src/types/index.ts` (WidgetId · DEFAULT_WIDGET_CONFIG에 `'daily-brief'` 최상단 enabled:true)
  - `src/app/(dashboard)/dashboard/page.tsx` (renderWidget 케이스 + WIDGET_SPAN: 'full')
  - `src/components/widgets/DashboardEditModal.tsx` (WIDGET_META)
- 데이터 입력: 오늘 calendar_events / overdue follow-ups (next_contact_at < now & 활성) / 70%+ 거래처 / 7일 미연락 CONTRACTED / 이번 달 vs 지난 달 계약 수
- AI 모델: Haiku (recommend task) — 빠른 응답 우선
- UX: 그라디언트 카드, TOP 3 액션 카드 + 바로가기, 통계 3 pill, 우상단 새로고침

### Feature S2-2: 자동 팔로업 시퀀스
- 상태: 신규 구현
- Step 0 grep: prompts.ts에 단어만 등장 → 신규
- 생성 파일:
  - `src/app/api/ai/followup-sequence/route.ts` — POST (생성) + GET (`?client_id=` 진행 상태)
  - `src/components/calls/FollowupSequenceCard.tsx`
- 수정 파일:
  - `src/app/(dashboard)/clients/[id]/page.tsx` — actions 섹션에 카드 추가 (CONTRACTED는 CS-only)
  - `src/components/widgets/FollowupCounterWidget.tsx` — 시퀀스 진행 상황 표시 `🔄 시퀀스 N/총개수 · 다음 D-N`
- 시퀀스 4종 구현 (interval days):
  - `standard`: 2/5/10/21/30
  - `hot`: 1/3/7/14 (계약 확률 70%+ 추천)
  - `nurture`: 7/21/45/90 (40% 미만 추천)
  - `cs`: 7/30/90/180/270/335 (CONTRACTED 전용)
- 중복 방지: 진행 중 시퀀스 발견 시 409 + `sequence_exists` 에러, UI에서 덮어쓰기 확인 모달
- 모든 일정은 `source='followup_sequence'`, `is_ai_generated=true`
- AI는 단계별 제목/메모만 커스터마이즈 — interval/날짜는 결정적

### Feature S2-3: 성과 트래킹 & 목표 설정 위젯
- 상태: 신규 구현
- Step 0 grep: admin 페이지에 recharts 사용 흔적만 → 신규
- 생성 파일:
  - `src/app/api/stats/monthly/route.ts` — GET (이번 달 KPI + 3개월 추이 + 단계별 분포) + PUT (목표 저장)
  - `src/components/widgets/GoalTrackerWidget.tsx`
- 수정: types/dashboard/edit-modal (위젯 등록, 기본 OFF)
- 저장: `profiles.metadata.monthly_goal = { contracts, calls, visits }`
- UX: SVG 원형 게이지 3종, 최근 3개월 bar chart (recharts), 인라인 목표 편집, 미설정 시 온보딩 카드

### Feature S2-4: 경쟁사 인텔리전스 위젯
- 상태: 신규 구현
- Step 0 grep: 없음 → 신규
- 생성 파일:
  - `src/app/api/stats/competitors/route.ts` — GET, 최근 500 통화 기준 집계
  - `src/components/widgets/CompetitorWidget.tsx`
- 수정: types/dashboard (기본 OFF)
- 집계 로직: `analysis.competitor_names` 추출, 등장 횟수 / 평균 계약 확률 / 관련 거래처의 CONTRACTED 비율을 승률로 계산
- UX: 수평 bar chart (recharts, 승률 기준 색상), 클릭 시 상세 패널 + 관련 거래처 + 승률 < 40%엔 ⚠️ 표시, "AI에게 대응 전략" 버튼은 AIChatStore에 메시지 푸시 후 채팅 패널 오픈

### Feature S2-5: 명함 OCR 자동 등록
- 상태: 신규 구현
- Step 0 grep: 기존 클라이언트 페이지에서 `business_card_url` 컬럼만 사용 중 → 신규
- 생성 파일:
  - `src/app/api/ai/ocr-card/route.ts` — POST (FormData `image`)
- 수정 파일:
  - `src/types/index.ts` — `QuickCaptureMode['mode']`에 `'CARD'` 추가
  - `src/components/quick-capture/QuickCapture.tsx` — CARD 모드 idle→processing→review 3단계 UI, 카메라/갤러리 input, 추출 결과 편집 후 거래처 INSERT
  - `src/components/quick-capture/FloatingAIButton.tsx` — 📷 명함 등록 액션 추가 (sky)
- 처리 흐름: 업로드 → `business-cards/{user_id}/{ts}.{ext}` (실패 시 OCR은 계속 진행) → Claude Sonnet Vision으로 base64 전달 → JSON 파싱 (`name/company/contact_name/phone/email/address/department/position`) → 사용자 확인 → clients 테이블 INSERT + business_card_url 저장 + 활동 로그
- 모델: `CLAUDE_MODELS.chat` (Sonnet 4.6 — Haiku는 vision 품질 미흡)

### Feature S2-6: 영업 일지 자동 생성
- 상태: 신규 구현
- Step 0 grep: AIChatPanel/admin 페이지에 "report" 키워드 일부 등장하나 일지 기능은 없음 → 신규
- 생성 파일:
  - `src/app/api/ai/daily-report/route.ts` — POST `{date?}`
  - `src/components/widgets/DailyReportWidget.tsx` — 대시보드 위젯 (기본 OFF)
- 데이터 수집: 해당 날짜의 call_records (transcript 600자 cap) + visit_records + activities(NOTE) + calendar_events
- AI 응답에 `markdown` 필드 포함 → 클립보드 복사 / .md 다운로드 지원 (카톡/이메일 바로 붙여넣기)
- 빈 날짜는 AI 호출 없이 즉시 "활동 없음" 반환

### Feature S2-7: 캘린더 페이지 개선
- 상태: 신규 구현 (월별 유지 + 주별 추가 + 상세 패널 + AI 소스 시각화)
- Step 0 grep: 기존 calendar/page.tsx에 `is_ai_generated` 사용 흔적 → 보강
- 생성 파일:
  - `src/components/calendar/eventStyle.ts` — source별 아이콘/링/배지/사유 매핑 (cs_reminder ❤️ pink, followup_sequence 🔄 blue, ai_analysis 🤖 indigo, ai_recommendation ✨ violet, manual은 ring 없음)
  - `src/components/calendar/WeeklyCalendarView.tsx` — 7일 컬럼 × 시간대(8~21시) 그리드, 절대 좌표 이벤트 배치
  - `src/components/calendar/EventDetailPanel.tsx` — 우측 슬라이드 패널, 보기/수정/완료 토글/삭제 모두 지원
- 수정 파일:
  - `src/app/(dashboard)/calendar/page.tsx` — [월별/주별] 탭 토글, 데이터 fetch 범위 동적, 월별 셀에도 source 아이콘/링 적용, 사이드 패널엔 클릭 가능한 이벤트 리스트 + 배지
  - `src/types/index.ts` — `CalendarEvent.source` 필드 + `CalendarEventSource` 유니언 타입 추가

### 🔧 자기비판 검토
- **완벽하게 구현된 것**
  - 7개 기능 모두 신규로 작성, 기존 Sprint 1 파일들의 export/패턴 보존
  - `tsc --noEmit` 0 에러, 신규 파일의 `eslint` 0 에러
  - 일일 브리핑 캐시: 같은 날 중복 호출 방지 — Anthropic 비용 직접적 통제
  - 팔로업 시퀀스 중복 방지: 409 + 덮어쓰기 모달
  - source 컬럼 활용: 캘린더에서 AI 출처별 차별화 표시 (요구사항 정확히 충족)
- **부족하거나 개선 필요한 것**
  - 명함 OCR Storage 업로드 실패 시 OCR은 계속 진행하지만 사용자에게 시각적 피드백이 없음 — Supabase Dashboard에서 `business-cards` 버킷을 만들지 않으면 `business_card_url`이 null로 저장됨. 운영 전에 버킷 생성 필수.
  - 주별 캘린더 그리드는 8~21시 고정. 새벽/심야 일정은 표시되지 않음. 실제 영업 시간 기준 합리적이지만 야간 영업이 있는 회사엔 부족.
  - 일일 브리핑 AI 호출 실패 시 fallback이 "비어있는 액션" 상태로만 안내 — 사용자가 직접 새로고침해야 함.
  - 경쟁사 위젯의 win_rate는 "해당 거래처 현재 status가 CONTRACTED인지"로 계산 — 해당 통화 *이후* 계약 여부와 정확히 일치하지 않음 (시점 정보 손실). 충분한 데이터가 쌓이기 전엔 통계 신뢰도 낮음.
  - 영업 일지의 transcript는 600자만 사용 — 긴 통화는 후반부 정보 손실 가능. 모델 컨텍스트는 충분하므로 향후 늘려도 됨.
- **테스트하지 못한 부분**
  - 실제 Supabase에 마이그레이션 적용/실행 (SQL 작성만)
  - Claude Vision 실호출 (API 키 필요, 코드 경로만 검증)
  - 모바일 375px 레이아웃 (코드 상 mobile-first, 브라우저 미검증)
  - 시퀀스 4종이 모두 calendar에 정상 등장하는지 end-to-end
- **사용자가 추가로 확인해야 할 사항**
  1. `supabase/migrations/20260623_sprint2.sql`을 Supabase에 적용
  2. Supabase Dashboard → Storage에서 `business-cards` 버킷 생성 (Public: OFF). RLS 정책 권장: `auth.uid()::text = (storage.foldername(name))[1]`
  3. `.env`에 `ANTHROPIC_API_KEY` 확인 — S2-1/2/5/6 모두 의존
  4. 기본 OFF인 위젯(goal-tracker, competitor-intel, daily-report)을 대시보드 편집 모달에서 켜서 동작 확인
  5. 명함 OCR 첫 호출 시 Storage 버킷 누락이면 콘솔에 경고 로그(`ocr-card upload failed (bucket missing?)`) — 버킷 생성 후 정상화

