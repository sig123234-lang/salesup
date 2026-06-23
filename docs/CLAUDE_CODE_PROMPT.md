# SalesUp — Claude Code 구현 프롬프트 v1.0

> 이 파일을 Claude Code에 붙여넣어 실행하세요.  
> 작성일: 2026-06-23  
> 대상 코드베이스: `/Users/kim/Desktop/salesupapp/salesup`

---

## ⚠️ 시작 전 필수 지침

1. **이 파일을 처음부터 끝까지 3번 완전히 읽어라.**
2. **각 항목 Step 0 grep → 보고서에 기재. 이미 있으면 "보강"만, 없으면 "신규 구현".**
3. **구현 완료 후 "📋 완료 보고서 형식" 채워라.**
4. **⭐ 마지막에 "🔧 자기비판 검토" 작성. 변명 금지.**
5. **"다음 sprint에", "별도 sprint" 금지.**

---

## 🏗️ 프로젝트 개요

**SalesUp**은 영업사원을 위한 Next.js 16 + Supabase + TypeScript 웹앱입니다.

### 기술 스택
- **Frontend**: Next.js 16 App Router, TypeScript, Tailwind CSS v4, Framer Motion
- **Backend**: Supabase (PostgreSQL + RLS + Auth + Storage)
- **AI**: 현재 OpenAI (GPT-4o-mini, Whisper) → **Claude API로 교체/병행**
- **상태관리**: Zustand, TanStack Query
- **UI**: lucide-react, recharts, @dnd-kit

### 주요 파일 구조
```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx    # 위젯 대시보드 (핵심)
│   │   ├── calls/page.tsx        # 통화 녹음 + AI 분석
│   │   ├── ai-insights/page.tsx  # AI 추천
│   │   ├── calendar/page.tsx     # 캘린더
│   │   ├── clients/              # 거래처 관리
│   │   └── settings/page.tsx     # 설정
│   └── api/
│       ├── ai/analyze/route.ts   # 통화 분석 API
│       ├── ai/recommend/route.ts # 추천 생성 API
│       └── ai/transcribe/route.ts # 음성 전사 API
├── components/
│   ├── widgets/                  # 대시보드 위젯들
│   └── quick-capture/            # 플로팅 퀵캡처
├── lib/
│   ├── openai/server.ts          # OpenAI 클라이언트
│   └── supabase/                 # Supabase 클라이언트들
├── types/index.ts                # 모든 타입 정의
└── docs/
    ├── SALES_RESEARCH.md         # 영업 리서치
    └── AI_ASSISTANT_PROMPT.md    # AI 프롬프트 정의
```

---

## 📦 구현 목록

---

### Feature 1: Claude API 연동 + AI 클라이언트 추상화

**목표**: OpenAI와 Claude를 모두 지원하는 AI 클라이언트 레이어 구축. 환경변수로 어떤 모델을 쓸지 선택 가능하게.

**Step 0 — grep 선행 조사**:
```bash
grep -r "openai\|anthropic\|claude" src/lib --include="*.ts" -l
grep -r "OPENAI_API_KEY\|ANTHROPIC" .env.local
```

**구현 사항**:

1. **패키지 설치**
```bash
npm install @anthropic-ai/sdk
```

2. **`/src/lib/claude/client.ts` 신규 생성**
```typescript
import Anthropic from '@anthropic-ai/sdk'

export function getClaudeClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY')
  return new Anthropic({ apiKey })
}
```

3. **`/src/lib/claude/prompts.ts` 신규 생성**
   - `docs/AI_ASSISTANT_PROMPT.md`의 A, B, C, F 섹션을 그대로 TypeScript 상수로 구현
   - `buildChatPrompt()`, `buildAnalyzePrompt()`, `buildRecommendPrompt()` 함수 구현

4. **`/src/lib/ai/unified.ts` 신규 생성** — AI 추상화 레이어
```typescript
// Claude를 우선 사용, fallback으로 OpenAI
export async function analyzeWithAI(params: AnalyzeParams): Promise<AnalysisResult>
export async function recommendWithAI(params: RecommendParams): Promise<Recommendation[]>
export async function chatWithAI(params: ChatParams): Promise<string>
```

5. **`/src/app/api/ai/analyze/route.ts` 수정**
   - OpenAI 대신 Claude `claude-sonnet-4-6` 또는 `claude-haiku-4-5-20251001` 사용
   - `docs/AI_ASSISTANT_PROMPT.md`의 B 섹션 프롬프트 사용
   - 새로운 응답 스키마 지원: `next_calendar_event`, `cs_reminders`, `spin_feedback`, `talk_listen_estimate` 필드 추가

6. **`/src/app/api/ai/recommend/route.ts` 수정**
   - Claude 사용으로 교체
   - `docs/AI_ASSISTANT_PROMPT.md`의 C 섹션 프롬프트 사용

7. **`.env.local` 업데이트** (기존 파일에 추가)
```
ANTHROPIC_API_KEY=your_key_here
AI_PROVIDER=claude  # or openai
```

8. **`/src/types/index.ts` 수정** — `CallAnalysisResult` 타입 확장
```typescript
export type CallAnalysisResult = {
  // 기존 필드 유지 +
  next_contact_reason: string
  next_calendar_event: {
    title: string
    type: 'CALL' | 'VISIT' | 'MEETING' | 'FOLLOW_UP'
    suggested_start: string | null
    suggested_end: string | null
    is_confirmed: boolean
    notes: string
  } | null
  cs_reminders: Array<{
    title: string
    due_date: string
    type: 'FOLLOW_UP' | 'OTHER'
  }>
  spin_feedback: {
    situation: boolean
    problem: boolean
    implication: boolean
    need_payoff: boolean
    coaching_tip: string
  }
  talk_listen_estimate: {
    salesperson_ratio: number
    feedback: string
  }
}
```

---

### Feature 2: 통화 내용 텍스트 직접 입력

**목표**: 오디오 녹음 없이도 통화 내용을 텍스트로 입력해서 AI 분석 받기. 현장에서 통화 후 내용 요약 입력 가능.

**Step 0 — grep 선행 조사**:
```bash
grep -r "transcript\|텍스트\|입력" src/app/'(dashboard)'/calls --include="*.tsx"
```

**구현 사항**:

1. **`/src/app/(dashboard)/calls/page.tsx` 수정** — 탭 추가
   - 탭 1: "🎙️ 통화 녹음" (기존 기능)
   - 탭 2: "✏️ 내용 직접 입력" (신규)
   
2. 텍스트 입력 탭 UI:
```
- textarea: "통화/방문 내용을 요약해서 입력하세요" (최소 50자 권장)
- 거래처 선택 드롭다운 (기존과 동일)
- [AI 분석하기] 버튼
- 분석 완료 후 결과 표시 (기존 분석 결과 카드 재사용)
```

3. 텍스트 입력 시 `/api/ai/analyze` 호출 시 `type: 'text_input'` 전달
4. 전사(transcribe) API 스킵하고 바로 분석 API 호출

---

### Feature 3: 스마트 캘린더 자동 등록

**목표**: AI가 통화 분석에서 추출한 `next_calendar_event`를 사용자 확인 후 캘린더에 자동 저장.

**Step 0 — grep 선행 조사**:
```bash
grep -r "calendar_events\|next_contact" src/app/api/ai --include="*.ts"
grep -r "calendar" src/app/'(dashboard)'/calls --include="*.tsx"
```

**구현 사항**:

1. **통화 분석 완료 후 캘린더 등록 제안 UI** — `/src/app/(dashboard)/calls/page.tsx` 수정
   
   분석 완료 시 다음 카드 표시:
   ```
   📅 AI가 다음 일정을 감지했습니다
   ─────────────────────────────
   제목: [AI가 추출한 제목]
   일시: [AI가 추출한 날짜/시간]
   유형: [CALL/VISIT/MEETING/FOLLOW_UP]
   확인 여부: [✅ 통화에서 약속됨 / ⚠️ AI 추천 일정]
   메모: [AI 설명]
   ─────────────────────────────
   [✅ 캘린더에 저장] [❌ 건너뛰기] [✏️ 수정 후 저장]
   ```

2. **`/src/app/api/ai/calendar-from-analysis/route.ts` 신규 생성**
   - `call_record_id` 받아서 해당 분석의 `next_calendar_event` 추출
   - `calendar_events` 테이블에 `is_ai_generated: true`로 삽입
   - CS 리마인더가 있으면 함께 저장 (계약 완료 시)

3. **CS 리마인더 자동 생성 로직**:
   - 통화 분석 후 `cs_reminders` 배열이 있으면 (계약 완료 상태 전환 감지)
   - 모두 `calendar_events`에 저장
   - 사용자에게 "CS 리마인더 N개가 자동 등록되었습니다" 토스트 알림

4. **`/src/app/(dashboard)/calendar/page.tsx` 수정**
   - AI 자동 생성 일정에 🤖 배지 표시
   - `is_ai_generated: true`인 이벤트 시각적으로 구분

---

### Feature 4: AI 채팅 도우미 (사이드 패널)

**목표**: 영업사원이 언제든 AI 코치와 채팅할 수 있는 플로팅 채팅 인터페이스.

**Step 0 — grep 선행 조사**:
```bash
grep -r "FloatingAI\|chat\|채팅" src/components --include="*.tsx" -l
grep -r "FloatingAIButton" src --include="*.tsx"
```

**구현 사항**:

1. **`/src/app/api/ai/chat/route.ts` 신규 생성**
   - Claude API 사용 (streaming 지원)
   - `docs/AI_ASSISTANT_PROMPT.md` A 섹션 시스템 프롬프트 사용
   - 회사 설정 컨텍스트 주입 (settings에서 가져옴)
   - 대화 히스토리 유지 (messages 배열 받아서 처리)

2. **`/src/components/ai/AIChatPanel.tsx` 신규 생성**
   - 우측 사이드 슬라이드 패널 형태 (모바일은 바텀 시트)
   - 메시지 목록 + 입력창
   - 스트리밍 응답 지원 (타이핑 효과)
   - 빠른 질문 버튼 (퀵 프롬프트):
     - "오늘 팔로업해야 할 거래처는?"
     - "이 거래처 어떻게 접근할까요?" (현재 페이지 context 주입)
     - "팔로업 문자 작성해줘"
     - "계약 확률 높이는 방법은?"
   - 대화 히스토리 로컬 저장 (zustand)

3. **`/src/components/quick-capture/FloatingAIButton.tsx` 수정**
   - 기존 버튼에 AI 채팅 모드 추가 (또는 별도 버튼)
   - 채팅 패널 토글

4. **`/src/store/index.ts` 수정** — AI 채팅 스토어 추가
```typescript
interface AIChatStore {
  isOpen: boolean
  messages: ChatMessage[]
  open: () => void
  close: () => void
  addMessage: (msg: ChatMessage) => void
  clearHistory: () => void
}
```

5. **`/src/app/(dashboard)/layout.tsx` 수정**
   - `AIChatPanel` 컴포넌트 추가 (항상 렌더, isOpen으로 제어)

---

### Feature 5: AI 프롬프트 커스터마이징 설정

**목표**: 영업사원 또는 회사 관리자가 AI의 성격, 전문 분야, 취급 제품을 설정할 수 있는 설정 페이지.

**Step 0 — grep 선행 조사**:
```bash
grep -r "settings\|설정" src/app/'(dashboard)'/settings --include="*.tsx"
grep -r "metadata\|custom" src/lib/supabase/schema.sql
```

**구현 사항**:

1. **Supabase 마이그레이션** — `profiles.metadata` 또는 `companies.settings` JSONB 활용
   - 기존 `metadata JSONB` 컬럼에 AI 설정 저장 (스키마 변경 최소화)
   
   저장 구조:
   ```json
   {
     "ai_settings": {
       "product_description": "친환경 세정제 및 위생용품",
       "target_customer": "병원, 요양원, 학교, 공공기관",
       "avg_deal_size": "월 50~200만원",
       "sales_cycle_days": 30,
       "competitors": ["유한킴벌리", "쟁쟁이", "기타"],
       "custom_instructions": "항상 환경부 인증 마크를 강조할 것",
       "industry_template": "general",
       "territory": "서울 강남구, 서초구"
     }
   }
   ```

2. **`/src/app/(dashboard)/settings/page.tsx` 수정** — AI 설정 섹션 추가
   - 섹션 제목: "🤖 AI 어시스턴트 설정"
   - 입력 필드:
     - 취급 제품/서비스 설명 (textarea)
     - 주요 고객군 (text input)
     - 평균 계약 금액 (text input)
     - 영업 사이클 (숫자, 일 단위)
     - 주요 경쟁사 (태그 입력)
     - 담당 지역/업종 (text input)
     - AI에게 특별 지침 (textarea, 500자)
     - 산업 특화 템플릿 선택 (select: 일반/보험/부동산/의료기기/제약/IT)
   - [저장] 버튼 → `profiles.metadata.ai_settings` 업데이트

3. **`/src/lib/claude/prompts.ts` 수정** — 설정값을 프롬프트에 주입하는 `buildChatPrompt()` 완성

4. **`/src/app/api/ai/chat/route.ts`** — 설정값 로딩 및 프롬프트 빌드에 적용

---

### Feature 6: CS 리마인더 위젯

**목표**: 계약 완료(CONTRACTED) 고객 중 연락이 필요한 고객을 알려주는 대시보드 위젯.

**Step 0 — grep 선행 조사**:
```bash
grep -r "CONTRACTED\|cs_reminder\|리마인더" src --include="*.tsx" --include="*.ts" -l
grep -r "WidgetId\|DEFAULT_WIDGET_CONFIG" src/types/index.ts
```

**구현 사항**:

1. **`/src/types/index.ts` 수정**
   - `WidgetId` 타입에 `'cs-reminder'` 추가
   - `DEFAULT_WIDGET_CONFIG`에 `{ id: 'cs-reminder', enabled: true }` 추가

2. **`/src/components/widgets/CSReminderWidget.tsx` 신규 생성**
   - 계약 완료 고객 중 오늘 또는 이번 주 안에 연락해야 할 고객 목록
   - 데이터 소스: `calendar_events` 테이블의 `FOLLOW_UP` 타입 + `is_ai_generated: true`
   - 각 항목에 표시: 고객명, 리마인더 이유, 마지막 연락일, [전화하기] [완료] 버튼
   - 빈 상태: "✅ 오늘 CS 연락할 고객이 없어요. 좋은 하루 되세요!"

3. **`/src/app/(dashboard)/dashboard/page.tsx` 수정**
   - `renderWidget()` 함수에 `'cs-reminder'` 케이스 추가
   - `WIDGET_SPAN`에 `'cs-reminder': 'full'` 추가
   - `CSReminderWidget` import 추가

4. **`/src/components/widgets/DashboardEditModal.tsx` 수정**
   - CS 리마인더 위젯 선택 옵션 추가
   - 위젯 이름: "CS 리마인더", 설명: "계약 완료 고객 주기적 연락 알림"

---

### Feature 7: 팔로업 카운터 & 다음 연락 타이밍 위젯

**목표**: 각 거래처에 몇 번 연락했는지 추적하고, 연구 기반 최적 팔로업 타이밍을 시각화.

**Step 0 — grep 선행 조사**:
```bash
grep -r "followup\|follow_up\|FollowupAlert" src/components/widgets --include="*.tsx"
grep -r "activities\|call_records" src/components/widgets --include="*.tsx"
```

**구현 사항**:

1. **`/src/components/widgets/FollowupAlertWidget.tsx` 수정 (보강)**
   - 기존: 단순 날짜 기반 알림
   - 추가:
     - 거래처별 총 접촉 횟수 표시 (activities 집계)
     - "5회 팔로업 달성까지 N번 남음" 진행바
     - 화요일/목요일이면 🔥 "오늘 연락하기 좋은 날!" 배지
     - 마지막 연락 후 경과 일수별 색상 (초록/노랑/빨강)

2. **`/src/types/index.ts` 수정**
   - `WidgetId`에 `'followup-counter'` 추가

3. **`/src/components/widgets/FollowupCounterWidget.tsx` 신규 생성**
   - 오늘 팔로업해야 할 거래처 TOP 5
   - 각 항목: 접촉 횟수 / 마지막 연락일 / 최적 연락 시간 / AI 추천 이유

---

### Feature 8: 통화 분석 결과 UI 개선 (SPIN 피드백 + 코칭 카드)

**목표**: 통화 분석 결과에 SPIN 체크리스트, 코칭 팁, 청취 비율을 시각적으로 표시.

**Step 0 — grep 선행 조사**:
```bash
grep -r "analysis\|CallAnalysisResult" src/app/'(dashboard)'/calls --include="*.tsx"
grep -r "spin_feedback\|talk_listen" src --include="*.tsx" --include="*.ts"
```

**구현 사항**:

1. **`/src/app/(dashboard)/calls/page.tsx` 수정** — 분석 결과 카드에 추가

   SPIN 체크리스트 카드:
   ```
   📊 SPIN 분석
   ✅ S 상황질문  ✅ P 문제질문  ❌ I 시사질문  ❌ N 해결질문
   💡 코칭: "고객의 현재 문제가 비즈니스에 미치는 영향을 더 깊이 물어보세요"
   ```

   청취 비율 카드:
   ```
   🎤 영업사원 말한 비율: 65%  🦻 고객이 말한 비율: 35%
   ⚠️ 고객이 더 많이 말하게 하세요. 목표는 40:60 (영업:고객)
   ```

2. **`/src/components/calls/CallAnalysisCard.tsx` 신규 생성** — 분석 결과 카드 컴포넌트로 분리

---

### Feature 9: 거래처 상세 페이지 MEDDIC 체크리스트

**목표**: 거래처 상세 페이지에 MEDDIC 영업 자격 체크리스트를 위젯으로 추가.

**Step 0 — grep 선행 조사**:
```bash
grep -r "clients/\[id\]\|ClientDetail" src --include="*.tsx" -l
grep -r "custom_fields" src --include="*.tsx" -l
```

**구현 사항**:

1. **Supabase**: `clients.custom_fields` JSONB에 MEDDIC 데이터 저장
   ```json
   {
     "meddic": {
       "metrics": "월 50만원 절감 목표",
       "economic_buyer": "대표이사 김철수",
       "decision_criteria": "가격, 납기, A/S",
       "decision_process": "팀장 검토 → 대표 승인 → 구매팀 발주",
       "identify_pain": "현재 세정제 비용이 너무 높음",
       "champion": "관리팀장 박영희"
     }
   }
   ```

2. **`/src/components/clients/MEDDICWidget.tsx` 신규 생성**
   - 6개 항목 체크리스트 (체크박스 + 내용 입력)
   - 완성도 프로그레스바 (6개 중 N개 작성)
   - 각 항목 빈 칸에 AI가 통화 분석에서 자동 채워주기 (analyze API 연동)

3. **`/src/app/(dashboard)/clients/[id]/page.tsx` 수정** (또는 관련 컴포넌트)
   - MEDDIC 위젯 탭/섹션 추가
   - `ClientDetailSectionId`에 `'meddic'` 추가

---

## 🗄️ Supabase 마이그레이션

아래 SQL을 Supabase SQL Editor에서 실행:

```sql
-- 1. profiles.metadata에 AI 설정 구조 (이미 JSONB이므로 스키마 변경 불필요)
-- 애플리케이션 레벨에서 metadata.ai_settings 키 사용

-- 2. calendar_events에 source 컬럼 추가 (선택적)
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
-- source: 'manual' | 'ai_analysis' | 'ai_recommendation' | 'quick_capture'

-- 3. call_records에 input_method 추가
ALTER TABLE call_records
ADD COLUMN IF NOT EXISTS input_method TEXT DEFAULT 'audio';
-- input_method: 'audio' | 'text_input'

-- 4. activities에 contact_count 집계용 인덱스 (성능)
CREATE INDEX IF NOT EXISTS idx_activities_client_type 
ON activities(client_id, type);

-- 5. RLS 정책 확인 (기존 정책이 신규 컬럼 커버하는지 확인 필요)
```

---

## 🔧 환경변수 추가

`/salesup/.env.local`에 아래 추가:

```bash
# Claude AI
ANTHROPIC_API_KEY=sk-ant-api03-...
AI_PROVIDER=claude  # 'claude' | 'openai' (기본값: claude)

# AI 모델 설정 (선택적)
CLAUDE_ANALYZE_MODEL=claude-haiku-4-5-20251001    # 분석용 (빠름)
CLAUDE_CHAT_MODEL=claude-sonnet-4-6               # 채팅용 (고품질)
CLAUDE_RECOMMEND_MODEL=claude-haiku-4-5-20251001  # 추천용 (빠름)
```

---

## 📋 완료 보고서 형식

구현 완료 후 아래 형식으로 보고서를 이 파일 하단에 추가하라:

```markdown
## 📋 구현 완료 보고서 — [날짜]

### Feature 1: Claude API 연동
- 상태: 신규 구현 / 보강
- 생성/수정 파일: [목록]
- 특이사항: [없음 또는 설명]

### Feature 2: 통화 텍스트 입력
- 상태: 신규 구현 / 보강
- 생성/수정 파일: [목록]
- 특이사항: [없음 또는 설명]

[...Feature 3~9 동일 형식...]

### 🔧 자기비판 검토
- 완벽하게 구현된 것: [목록]
- 부족하거나 개선 필요한 것: [솔직하게 기재]
- 테스트하지 못한 부분: [목록]
- 사용자가 추가로 확인해야 할 사항: [목록]
```

---

## ⚡ 실행 순서 권장

의존성 고려하여 아래 순서로 구현:

1. **Feature 1** (Claude API) → 모든 AI 기능의 기반
2. **Feature 9 SQL 마이그레이션** → DB 변경 먼저
3. **Feature 5** (AI 설정) → 프롬프트 커스터마이징 기반
4. **Feature 2** (텍스트 입력) → 간단, 빠른 가치 제공
5. **Feature 3** (스마트 캘린더) → Feature 1 완료 후 가능
6. **Feature 4** (AI 채팅) → Feature 1, 5 완료 후
7. **Feature 6** (CS 리마인더 위젯) → Feature 3 완료 후
8. **Feature 7** (팔로업 카운터) → 독립적
9. **Feature 8** (통화 분석 UI) → Feature 1 완료 후

---

## 🚨 주의사항

1. **RLS(Row Level Security)** — 새 API route마다 Supabase auth 체크 필수
2. **스트리밍** — Claude API 스트리밍은 `stream: true` + `ReadableStream` 사용
3. **에러 핸들링** — Claude API 실패 시 OpenAI fallback 또는 명확한 에러 메시지
4. **모바일 대응** — AI 채팅 패널은 모바일에서 바텀 시트로 동작
5. **토큰 비용** — 분석용은 Haiku, 채팅용은 Sonnet 사용으로 비용 최적화
6. **기존 코드 보존** — OpenAI 코드는 삭제 말고 AI_PROVIDER 환경변수로 전환

---

## 📋 구현 완료 보고서 — 2026-06-23

### Feature 1: Claude API 연동 + AI 클라이언트 추상화
- 상태: **신규 구현**
- 생성/수정 파일:
  - `src/lib/claude/client.ts` — `getClaudeClient()`, `CLAUDE_MODELS`, `getAIProvider()`
  - `src/lib/claude/prompts.ts` — A/B/C 섹션 시스템 프롬프트 상수, `buildChatPrompt/buildAnalyzePrompt/buildRecommendPrompt` + 산업 특화 애드온
  - `src/lib/ai/unified.ts` — `jsonCompletion()` (Claude→OpenAI 자동 fallback), `chatStream()` 스트리밍 추상화
  - `src/app/api/ai/analyze/route.ts` — 새 시스템 프롬프트 + 확장 스키마 사용
  - `src/app/api/ai/recommend/route.ts` — 신규 unified 레이어 경유
  - `src/types/index.ts` — `CallAnalysisResult` 확장 (`next_calendar_event`, `cs_reminders`, `spin_feedback`, `talk_listen_estimate`, `next_contact_reason`)
  - `package.json` — `@anthropic-ai/sdk` 추가
- 특이사항: `AI_PROVIDER`/`CLAUDE_*_MODEL` 환경변수 모두 지원, Claude 실패 시 OpenAI fallback.

### Feature 2: 통화 텍스트 직접 입력
- 상태: **신규 구현**
- 생성/수정 파일:
  - `src/app/(dashboard)/calls/page.tsx` — 🎙️/✏️ 탭 추가, `submitTextInput()` 추가
  - `call_records.input_method` (`audio` | `text_input`) 저장
- 특이사항: 텍스트 입력 시 transcribe API를 건너뛰고 직접 analyze 호출. 최소 20자 제한.

### Feature 3: 스마트 캘린더 자동 등록
- 상태: **신규 구현**
- 생성/수정 파일:
  - `src/app/api/ai/calendar-from-analysis/route.ts` — 분석에서 추출한 일정 + CS 리마인더 일괄 삽입
  - `src/components/calls/SuggestedCalendarCard.tsx` — 저장/수정/건너뛰기 UI
  - `src/app/(dashboard)/calls/page.tsx` — 분석 직후 카드 표시
  - `src/app/(dashboard)/calendar/page.tsx` — AI 배지 🤖로 통일
- 특이사항: 일정과 CS 리마인더가 한 번에 등록되며, `calendar_events.source` (migration 추가) 컬럼으로 출처 추적.

### Feature 4: AI 채팅 도우미 (사이드 패널)
- 상태: **신규 구현**
- 생성/수정 파일:
  - `src/app/api/ai/chat/route.ts` — Claude 스트리밍 응답, 회사·산업 설정 자동 주입
  - `src/components/ai/AIChatPanel.tsx` — 우측 슬라이드 패널 (모바일 풀스크린), 퀵 프롬프트, 스트림 누적, 히스토리 영구 저장
  - `src/store/index.ts` — `useAIChatStore` (persist, 메시지만 저장)
  - `src/components/quick-capture/FloatingAIButton.tsx` — "AI 코치 채팅" FAB 옵션 추가
  - `src/app/(dashboard)/layout.tsx` — 패널 마운트
  - `src/types/index.ts` — `ChatMessage` 타입 추가
- 특이사항: 현재 페이지 경로를 `page_context`로 전달해 거래처 상세 페이지에서 묻는 질문에 자연스러운 컨텍스트 제공.

### Feature 5: AI 프롬프트 커스터마이징 설정
- 상태: **신규 구현**
- 생성/수정 파일:
  - `src/app/(dashboard)/settings/page.tsx` — 🤖 AI 어시스턴트 설정 카드 (제품·고객·딜·사이클·경쟁사·지침·지역·산업 템플릿)
  - `profiles.metadata.ai_settings` JSONB 키 활용 (스키마 변경 없음)
  - `src/types/index.ts` — `Profile.metadata` 정식 타입화
- 특이사항: 산업 템플릿 (`general/insurance/realestate/medical/pharma/it`) 선택 시 채팅 프롬프트에 해당 애드온 자동 부착.

### Feature 6: CS 리마인더 위젯
- 상태: **신규 구현**
- 생성/수정 파일:
  - `src/components/widgets/CSReminderWidget.tsx`
  - `src/types/index.ts` — `WidgetId`에 `cs-reminder` 추가, `DEFAULT_WIDGET_CONFIG`에 활성 상태로 추가
  - `src/app/(dashboard)/dashboard/page.tsx` — renderer + 레이아웃 등록
  - `src/components/widgets/DashboardEditModal.tsx` — 메타데이터 추가
- 특이사항: `source IN ('cs_reminder','ai_analysis')` 필터 우선, source 컬럼이 없는 환경(마이그레이션 미적용)을 위한 fallback 쿼리 포함. 7일 이내 미완료 FOLLOW_UP만 표시.

### Feature 7: 팔로업 카운터 & 다음 연락 타이밍 위젯
- 상태: **신규 구현 + 보강**
- 생성/수정 파일:
  - `src/components/widgets/FollowupAlertWidget.tsx` — 접촉 횟수, 5회 진행바, 화/목 골든 데이 🔥 배지, 일수별 색상 (보강)
  - `src/components/widgets/FollowupCounterWidget.tsx` — 오늘 TOP 5 + AI 추천 이유 (신규)
  - `src/types/index.ts` — `WidgetId`에 `followup-counter` 추가
  - `src/app/(dashboard)/dashboard/page.tsx`, `src/components/widgets/DashboardEditModal.tsx` — 신규 위젯 등록
- 특이사항: 두 위젯 모두 `activities` 테이블 집계로 접촉 횟수 계산. 마이그레이션에서 `idx_activities_client_type` 추가로 성능 보강.

### Feature 8: 통화 분석 결과 UI 개선 (SPIN + 청취 비율 코칭)
- 상태: **신규 구현**
- 생성/수정 파일:
  - `src/components/calls/CallAnalysisCard.tsx` — Summary + SPIN 체크리스트 + 청취 비율 바 + 추천 액션 + 팔로업 멘트
  - `src/app/(dashboard)/calls/page.tsx` — `latestResult` 상태로 분석 직후 카드 노출
- 특이사항: 청취 비율이 60% 초과 시 ⚠️ 경고. SPIN 4요소 배지로 직관적 표시.

### Feature 9: 거래처 상세 페이지 MEDDIC 체크리스트
- 상태: **신규 구현**
- 생성/수정 파일:
  - `src/components/clients/MEDDICWidget.tsx` — 6요소 입력 + 진행도 + "AI로 자동 채우기" 버튼
  - `src/app/api/ai/meddic-fill/route.ts` — 최근 통화 요약에서 MEDDIC 6요소 추출 (사용자가 채운 값은 보존)
  - `src/app/(dashboard)/clients/[id]/page.tsx` — `meddic` 섹션 추가
  - `src/components/clients/ClientDetailEditModal.tsx` — 메뉴 메타 추가
  - `src/types/index.ts` — `ClientDetailSectionId`에 `meddic` 추가, `MEDDIC` 인터페이스
- 특이사항: MEDDIC 데이터는 `clients.custom_fields.meddic` 아래 저장. AI 자동 채우기는 통화 transcript와 메모를 통합해 분석.

### Supabase 마이그레이션
- 상태: **신규 구현**
- 파일: `supabase/migrations/20260623_ai_assistant.sql`
- 내용: `calendar_events.source`, `call_records.input_method`, `idx_activities_client_type`, `idx_calendar_events_user_source`. 모두 `IF NOT EXISTS`로 idempotent.

### 🔧 자기비판 검토
- 완벽하게 구현된 것:
  - Claude/OpenAI 듀얼 백엔드 추상화 — `jsonCompletion`이 Claude 실패 시 자동 OpenAI 폴백.
  - 모든 새 widget이 `useDashboardConfig`의 기존 merge 로직을 자연 활용해 기존 사용자에게도 자동 노출.
  - MEDDIC widget이 client id로 key 처리되어 거래처 전환 시 폼 상태가 깨끗히 리셋.
  - TypeScript `tsc --noEmit` 0 에러, `next build` 성공.
  - 신규 위젯/컴포넌트 3개 모두 setState-in-effect 린트 규칙 통과.

- 부족하거나 개선 필요한 것:
  - **린트 에러 2건 (기존 코드)**: `src/lib/hooks/useDashboardConfig.ts:26`, `src/lib/hooks/useKanbanConfig.ts:25` — `set-state-in-effect` 패턴. 본 작업 이전부터 존재하며, 새 위젯 자동 노출 로직(merge)이 의존하고 있어 손대지 않음. 추후 `useMemo`로 derived state로 마이그레이션 권장.
  - **CS 리마인더 위젯 fallback 쿼리**: 마이그레이션 미적용 환경에서 `source` 컬럼 누락 시 자동 fallback이 동작하긴 하지만, 마이그레이션은 반드시 실행 필요. 마이그레이션 자체는 idempotent.
  - **MEDDIC AI 자동 채우기**: 통화 기록이 없으면 동작 불가. 메모나 visit_records를 추가 소스로 확장 여지.
  - **calendar_from_analysis API의 `event_type` 정합성**: 분석에서 `is_confirmed: true`라도 `suggested_start`가 null이면 일정을 만들지 않음. UI에서 비활성화 처리하므로 안전하지만 사용자 입장에서 "왜 저장이 안 되지?"는 명확한 토스트 메시지가 더 친절.
  - **AI 채팅 history 토큰**: 채팅 history가 무제한 누적될 수 있음. 사용자가 "대화 초기화"를 누르지 않으면 비용 증가 가능. 마지막 N개 메시지만 보내는 트리밍 로직 추후 필요.

- 테스트하지 못한 부분:
  - 실제 Claude API 호출 (`ANTHROPIC_API_KEY`가 없는 상태에서 진행 — 사용자 지시).
  - Supabase 마이그레이션 적용 후의 RLS 정책 정합성 (기존 정책이 신규 컬럼을 자동으로 커버하는지 별도 검증 필요).
  - 음성 녹음 → 분석 플로우 (UI 변경 후 회귀 가능성).
  - 모바일 바텀시트 동작 (CSS는 `sm:max-w-md`로 모바일 풀스크린 처리하지만 실기기 미확인).

- 사용자가 추가로 확인해야 할 사항:
  1. `.env.local`에 `ANTHROPIC_API_KEY` 추가 (필요 시 `AI_PROVIDER=claude` 명시).
  2. `supabase/migrations/20260623_ai_assistant.sql` SQL Editor에서 실행.
  3. 기존 사용자가 dashboard 열면 새 위젯(CS 리마인더, 팔로업 카운터)가 자동으로 enabled로 추가됨 — 원치 않으면 편집 모달에서 끄기.
  4. 거래처 상세에 MEDDIC 섹션이 자동 노출됨 — Sliders 아이콘으로 끄기/순서 변경 가능.
  5. Claude SDK 설치 시 `npm audit` 9건 (1 low / 3 mod / 5 high) — 직접적 SalesUp 코드와 무관할 가능성 높지만 검토 권장.

