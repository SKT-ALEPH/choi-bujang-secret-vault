# Keshev · Soft UI Evolution

2026-10-19 · 직원용 보안 앱과 기존 BYTE BACK 자료실의 공통 디자인 시스템.

## 방향과 근거

사용자 지정 Soft UI Evolution, Cormorant Garamond / Montserrat, 밝은 화면을 우선한다. 부드러운 그림자와 은은한 깊이, 편안한 간격, 차분한 녹색으로 보안 정보를 명확하게 보여준다. 네온·다크 모드·과한 애니메이션·보라/분홍 그라디언트는 사용하지 않는다.

ui-ux-pro-max 공식 v2.15.0의 `style: Soft UI Evolution`, `typography: Luxury Serif`, `ux: Focus Not Obscured` 검색을 검토했다. 전역 자동 추천은 마케팅 랜딩/일반 데이터 대시보드로 제품·사용자 지정과 맞지 않아 적용하지 않았다. 이 문서는 사용자 요구, 검증된 개별 검색 결과, 스킬 기본 접근성 규칙으로 구성한 프로젝트별 기준이다. Luxury Serif 검색의 Cormorant와 사용자가 지정한 Cormorant Garamond는 별개이며 실제 구현은 **Cormorant Garamond**다. plain HTML/CSS/DOM 구조를 유지한다.

## 적용 범위와 원본

- `on-client/public/style.css`: 유일한 테마 원본. 글꼴 subset·토큰·공통 컴포넌트·직원 앱·자료실·오프라인 스타일을 포함한다.
- `public/style.css`: 빌드 때 위 원본에서 복사하는 배포본. 이 파일만 따로 수정하지 않는다.
- `scripts/build-public.mjs`: 기존 빌드에 테마 복사와 오프라인 테마 내장을 추가한다.
- `on-client/public/index.html`: 보호 현황 / 업무 앱 / 보안 기록, 연결 도구, 원본 비교 화면.
- `public/index.html`, `public/offline.html`, `public/manifest.webmanifest`, `public/icon.svg`: 자료실 로그인·기기 확인·메모·검사 기록·오프라인·설치 표면.
- `public/sw.js`: 원본 그대로 공개 오프라인 문서 하나만 캐시한다. 오프라인 문서에는 빌드가 공통 테마를 내장하므로 추가 캐시가 필요 없다. 보호 자료와 인증 응답 캐시 금지를 유지한다.

기존 제공 `app.js`, 서버, 인증, SDP adapter, 판정·탐지·XDR·DB 계약은 바꾸지 않는다. 학생 표시 함수의 클래스·표시용 data 속성만 추가한다. 공식 통과 기록을 새 UI 검증으로 대체하지 않고, 새 심판 제출이나 운영 배포를 수행하지 않는다.

## 색상

| 역할 | 토큰 | 값 |
|---|---|---|
| 배경 | `--bg` | `#f6f5f0` |
| 카드 | `--surface` | `#fffefa` |
| 안쪽 표면 | `--surface-inset` | `#eeefe8` |
| 본문 | `--text` | `#263b33` |
| 보조 본문 | `--muted` | `#59665e` |
| 강조 / 주요 버튼 | `--accent` | `#345c49` |
| 강조 hover | `--accent-hover` | `#254b39` |
| 강조 배경 | `--accent-soft` | `#e6ede3` |
| 구획 경계 | `--border` | `#d9ddd2` |
| 조작 가능한 경계 | `--control-border` | `#7f8b81` |
| 허용 | `--allow` / `--allow-soft` | `#2f6248` / `#e8f1e9` |
| 거부 / 요청 실패 | `--deny` / `--deny-soft` | `#983e32` / `#faeee9` |
| 추가 확인 | `--challenge` / `--challenge-soft` | `#805c23` / `#f5eddc` |
| 확인 불가 | `--unknown` / `--unknown-soft` | `#59665e` / `#edf0e9` |

상태는 색뿐 아니라 한국어와 원래 코드로 보여준다. 활성 세션을 기기 안전 확인으로 표현하지 않는다. demo/미연결/확인 불가를 실제 연결 완료로 바꾸지 않는다. 요청 실패는 거부 판정과 구분한다.

## 글꼴과 계층

- 영문 브랜드·표제: Cormorant Garamond 500, 32–76px. 과장된 마케팅 약속 대신 메뉴 의미를 보조한다.
- 영문 UI·숫자: Montserrat 400/600. 한국어는 Apple SD Gothic Neo / Malgun Gothic / 시스템 sans-serif로 fallback한다. 두 영문 서체에 한국어 글리프가 있다고 주장하지 않는다.
- 기본 16px / 1.65, 카드 본문 13–16px, 보조 정보 12px 이상. 가장 작은 영문 장식 라벨은 정보 전달에 필수적이지 않은 부제에만 쓴다.
- 긴 ID/원래 코드/오류는 `overflow-wrap:anywhere`로 유지한다. 필수 상태 정보를 말줄임으로 숨기지 않는다.
- Google Fonts 공식 출처의 영문 subset 3개를 CSS data URL로 포함한다. 런타임 외부 글꼴 요청과 새 정적 서버 경로가 없다. `font-display:swap`. 라이선스는 `licenses/`에 보관한다. 앱 CSP는 font 리소스만 self/data 허용하며 script/connect 기존 제한을 유지한다.

## 간격·형태·깊이

- 간격: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px.
- 카드: radius20px, 큰 안내28px, 필드·버튼12px, 배지999px.
- 기본 카드: `0 6px 24px #263b3307, 0 1px 3px #263b3304`.
- 로그인 등 중심 카드: `0 10px 32px #263b330c, 0 2px 6px #263b3305`.
- 데이터 영역 전체에 깊은 음각을 사용하지 않는다. 경계·텍스트 대비로 조작 가능 여부를 구분한다.
- 아이콘: 현재색 SVG, 1.5–1.6px 외곽선. 메뉴 라벨 옆 아이콘은 aria-hidden. 래스터 AI 장식은 시각 계층에서 제외하며 원본 자산은 보존한다.

## 컴포넌트 규칙

| 컴포넌트 | 규칙 |
|---|---|
| 상단 | 브랜드 / 현재 실행 모드 / 수동 새로고침. 모드와 실제 연결 구분을 항상 표시 |
| 메뉴 | 기존 세 메뉴와 원래 ID/키보드 동작 유지. 선택 상태는 표면·경계·굵기·aria-selected로 표시 |
| 카드 | 사용자 정보가 먼저, 비교용 제공 UI는 native details로 펼쳐 보기 |
| 버튼 | 최소 높이44px, 간격8px 이상, 기본/hover/active/focus/disabled 구분. 주요 버튼만 짙은 녹색 |
| 필터 | 원래 이름 「기록 종류」「업무 앱」「접속 상태」와 원래 option 값 유지 |
| 판정 | allow/deny/challenge/unknown 색+문구. 서버 이유·시각 유지. 실제 업무 앱 접속 성공과 허용 판정 구분 |
| 기록 | 원래 ID·시각·근거·규칙·접속/세션/기기 상태 유지, `<id> 상세` 이름과 data 속성 유지 |
| 진단 | 명시적으로 불러오고, 「도움정보 복사」로 허용 6필드만 수동 복사. 자동 전송·자동 재시도 없음 |
| 미지원 조치 | 비활성 상태와 미지원 설명. 지원 목록이 비면 버튼 없음 |
| 연결·후속 기능 | native details 안에 모든 제공 UI 유지. 펼친 것만으로 요청하지 않음. 준비 중 기능을 완성으로 표시하지 않음 |
| 자료실 | 기존 로그인·비밀번호 표시·기기 승인·로그아웃·메모 CRUD·검사표 동작 보존 |
| 오프라인 | 보호 자료를 저장하거나 승인을 대신하지 않는다는 원래 안내 유지 |

## 반응형·접근성·전환

- ≥1100px 사이드바236px와 유동 본문; ≥1600px 사이드바256px; 768–1100px 사이드바196px; ≤767px 상단 가로 메뉴와 단일 열 카드.
- 375px, 768px, 1280px 이상과 가로 화면 확인. 페이지 전체 가로 넘침 금지. 넓은 검사표만 이름 붙은 내부 스크롤을 허용한다.
- `:focus-visible` 3px 녹색 outline+4px offset. 고정 덮개 없음, scroll-padding24px. 기존 skip link와 ARIA live region 유지.
- 본문/상태 텍스트 대비 목표4.5:1, 조작 경계·포커스3:1. 텍스트 확대와 긴 ID로도 정보가 남아야 한다.
- press120ms, hover200ms, reveal260ms 토큰. 배경·색·그림자만 전환한다. 자동 재생/반복 모션, 큰 이동, 레이아웃 애니메이션 없음. reduced-motion에서 모든 전환 제거.
- 외부 JS UI 프레임워크/애니메이션 라이브러리 추가 없음.

## 검증 기록

현재 변경의 실행 결과는 저장소 밖 `artifacts/ui-refresh/verification.json`과 화면 캡처에 기록한다. 기존 공식13~16 통과 결과는 `artifacts/stages13-16/official-final-results.json`에 보존되며 이번 디자인 변경의 재심사로 표현하지 않는다.
