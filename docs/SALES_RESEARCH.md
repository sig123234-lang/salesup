# 영업 딥 리서치 보고서 — SalesUp 설계 근거

> 작성일: 2026-06-23  
> 목적: SalesUp 웹앱 기능 설계를 위한 세일즈 학문적 근거 수집  
> 범위: 세일즈 방법론 / 통계 / 최적 타이밍 / AI 도구 / 고객 유지

---

## 1. 핵심 영업 통계 (데이터 기반)

### 성공률 & 전환율
| 지표 | 수치 | 출처 |
|------|------|------|
| 업계 평균 계약 성사율 | 29% | HubSpot 2024 |
| 평균 영업 승률 | 21% | HubSpot |
| 첫 연락 후 5분 내 전화 시 도달 확률 | 100배 증가 | LeadsAtScale |
| 1분 내 연락 시 전환율 향상 | 400% | 복수 연구 |
| 톱 세일즈와 평범한 세일즈의 리서치 차이 | 82% vs 49% | 복수 연구 |

### 팔로업 (Follow-Up) — 가장 중요한 단일 요소
- **80%의 영업 계약은 5회 이상의 팔로업 필요**
- **44%의 영업사원은 1번 시도 후 포기** → 경쟁 우위 확보 가능
- 최적 이메일 팔로업 간격: **첫 연락 2~5일 후**
- 다음 날 팔로업은 응답률 11% 감소 → 약간의 간격 필수
- 최고 응답률 요일/시간: **화요일, 목요일 오전 10시~오후 2시**
- 8회 이상 접촉부터 수확 체감의 법칙 적용

### 관계 vs 제품 피치
- **"우리", "함께", "저희"** 표현 사용 → 성공률 35% 향상
- 82% 영업 전문가: 관계 구축이 가장 중요한 요소
- LinkedIn 메시지+방문 콤보: **11.87% 응답률** (이메일 시퀀스 대비 최고)

---

## 2. 세일즈 방법론 — AI 프롬프트 설계 기반

### 2-1. SPIN Selling (닐 래컴, 1988)
**연구 기반 방법론** — 35,000건 이상의 세일즈 콜 분석 결과

질문 유형:
- **S**ituation: 고객 현황 파악 ("현재 어떤 방식으로 처리하고 계세요?")
- **P**roblem: 문제점 발굴 ("그 과정에서 불편하신 점이 있으신가요?")
- **I**mplication: 문제의 파급효과 확대 ("그 문제로 인해 매달 손실이 얼마나 발생하시나요?")
- **N**eed-Payoff: 해결책의 가치 확인 ("만약 이 문제가 해결된다면 어떤 도움이 될까요?")

**앱 활용**: AI가 통화 내용을 SPIN 프레임으로 분석하여 어느 단계인지, 어떤 질문이 부족했는지 피드백

### 2-2. Challenger Sale (매튜 딕슨 & 브렌트 아담슨, 2011)
**CEB 연구 — 6,000명 영업사원 분석**

고성과자 유형: Challenger(도전형)가 최고 성과  
핵심 3요소:
- **Teach**: 고객이 몰랐던 새로운 인사이트 제공
- **Tailor**: 고객의 경제적 가치/관심사에 맞춤화
- **Take Control**: 영업 프로세스를 주도적으로 이끌기

**Xerox 사례**: Challenger 방법론 도입 후 매출 17% 증가, 계약 가치 6,500만 달러 추가

**앱 활용**: AI가 통화 분석 시 "고객에게 새로운 인사이트를 제공했는가?" 평가

### 2-3. MEDDIC (엔터프라이즈 B2B 표준)
- **M**etrics: 성공의 수치화 기준
- **E**conomic Buyer: 실제 결정권자 파악
- **D**ecision Criteria: 구매 기준
- **D**ecision Process: 의사결정 과정
- **I**dentify Pain: 핵심 문제점 명확화
- **C**hampion: 내부 지지자 확보

**효과**: 구조화된 자격 검증 → 승률 41% 향상, 영업 사이클 26% 단축

**앱 활용**: 거래처 카드에 MEDDIC 항목 체크리스트 위젯으로 제공

---

## 3. 고객 유지 & CS 사후관리

### 경제적 가치
- 고객 유지율 **5% 증가 → 매출 25~95% 증가** (Bain & Company 연구)
- 신규 고객 획득 비용 = 기존 고객 유지 비용의 **5~7배**
- B2B 재계약율 90% 이상 = 건강한 수준

### 최적 CS 연락 주기 (계약 후)
| 시점 | 액션 | 목적 |
|------|------|------|
| 계약 직후 1주 | 온보딩 확인 전화 | 초기 만족도 확인 |
| 계약 후 1개월 | 정착 점검 | 불만 조기 발굴 |
| 계약 후 3개월 | 성과 공유 | 가치 재확인 |
| 만료 D-180 (6개월 전) | 재계약 프로세스 시작 | 이탈 방지 선제 대응 |
| 만료 D-90 | 조건 협상 시작 | 계약 갱신 |
| 만료 D-30 | 최종 확인 | 서명 |

**앱 활용**: 계약 완료(CONTRACTED) 상태 전환 시 CS 리마인더 자동 생성

---

## 4. AI 도구 트렌드 & 최적 기능

### 시장 현황
- 영업팀 AI 활용률: **51%** (가장 낮은 부서 중 하나) → 선점 기회
- 고성과 팀은 저성과 팀 대비 **3배** 더 많은 세일즈 기술 활용
- AI 도입 후 30~60일 내 생산성 향상, 3~6개월 내 매출 가시적 증가

### 핵심 AI 기능 (Gong, Clari 등 벤치마크)
1. **통화 전사(Transcription)** — 이미 구현됨 ✅
2. **감성 분석** — 고객 반응 (POSITIVE/NEUTRAL/NEGATIVE) ✅ 부분 구현
3. **경쟁사 언급 감지** ✅ 구현됨
4. **자동 캘린더 등록** — 통화 중 언급된 날짜/시간 자동 캘린더 등록 ❌ 미구현
5. **최적 연락 타이밍 AI 판단** — 미팅이 안 잡혔을 때 ❌ 미구현
6. **다음 연락 스크립트 생성** — 팔로업 시 쓸 멘트 자동 작성 ⚠️ 부분 구현
7. **Coach 모드** — 통화 품질 점수 (SPIN/Challenger 기준) ❌ 미구현
8. **실시간 AI 채팅 도우미** ❌ 미구현
9. **CS 리마인더 자동화** ❌ 미구현
10. **Talk-to-Listen 비율** — 영업사원이 얼마나 들었는지 ❌ 미구현

---

## 5. SalesUp 현재 상태 분석

### 현재 구현된 것 ✅
- 위젯 시스템 (stats, recent-clients, calendar, ai-tip, kanban-preview, followup-alert)
- 통화 녹음 + OpenAI Whisper 전사 + GPT-4o-mini 분석
- 계약 확률, 고객 반응, 경쟁사, 팔로업 멘트 생성
- AI 추천 (REVISIT/FOLLOW_UP/UPSELL/RETENTION)
- 칸반 보드, 지도, 방문 기록
- 퀵 캡처 (음성/메모/고객/일정)

### 부족한 것 ❌
- **Claude API** — 현재 OpenAI만 사용, Claude API 미통합
- **통화 텍스트 직접 입력** — 오디오만 가능, 통화 내용 수동 입력 불가
- **자동 캘린더 등록** — 통화에서 미팅 날짜/장소 파악 시 자동 저장 없음
- **AI 연락 타이밍 추천** — 다음 전화 최적 시간 자동 판단 없음
- **CS 리마인더** — 계약 후 주기적 연락 알림 없음
- **AI 채팅 도우미** — 실시간 질의응답 불가
- **AI 프롬프트 커스터마이징** — 회사/산업별 AI 성격 설정 불가
- **SPIN/Challenger 코칭 피드백** — 방법론 기반 통화 품질 평가 없음
- **멀티채널 위젯** — 산업별 특화 위젯 없음
- **Talk-to-Listen 비율** — 음성 길이 기반 분석 없음

---

## 6. 우선순위 기능 로드맵 (연구 기반)

### Sprint 1 — 최고 임팩트 (이번 구현)
1. **Claude API 연동** — AI 품질 향상 + 비용 최적화
2. **통화 텍스트 입력** — 현장에서 텍스트로 통화 내용 입력 가능
3. **스마트 캘린더 자동 등록** — 통화 분석에서 미팅 추출 → 캘린더 자동 저장
4. **AI 연락 타이밍 추천** — 미팅 미확정 시 최적 연락 시간 자동 판단 및 캘린더 등록
5. **CS 리마인더 위젯** — 계약 완료 고객 주기적 연락 알림
6. **AI 채팅 도우미** — 사이드바 또는 플로팅 AI 채팅 인터페이스
7. **AI 프롬프트 커스터마이징 설정** — 산업/회사별 AI 성격 설정 페이지

### Sprint 2 — 중간 임팩트
8. **SPIN/Challenger 코칭 피드백** 위젯
9. **Talk-to-Listen 비율** 시각화
10. **MEDDIC 체크리스트** 위젯 (거래처 상세 페이지)
11. **팔로업 카운터** — 몇 번 접촉했는지 추적
12. **재계약 타이머** — D-180, D-90, D-30 리마인더

---

## 7. 참고 문헌 & 소스

- HubSpot Sales Statistics 2025: https://blog.hubspot.com/sales/sales-statistics
- SPOTIO Sales Statistics 2026: https://spotio.com/blog/sales-statistics/
- Belkins B2B Follow-Up Study: https://belkins.io/blog/sales-follow-up-statistics
- Challenger Inc. Methodology: https://challengerinc.com/what-is-challenger-sales-methodology/
- SPIN vs Challenger vs MEDDIC: https://salesperformance.com.au/spin-challenger-meddic-comparison/
- B2B Retention Management: https://blog.trackit.so/b2b-retention-renewal-management
- Monday.com AI Sales Productivity: https://monday.com/blog/crm-and-sales/sales-productivity/
- Bain & Company Customer Retention Research (수치 인용)
- Neil Rackham, "SPIN Selling", McGraw-Hill, 1988
- Matthew Dixon & Brent Adamson, "The Challenger Sale", Portfolio/Penguin, 2011
