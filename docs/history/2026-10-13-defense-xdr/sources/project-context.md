# 이 프로젝트의 지속 맥락

이 프로젝트에서 작업할 때 아래 지식그래프와 설명 선호를 참고한다. 사용자가 2026-10-06 대화에서 저장을 요청한 맥락이다.

## 제출 규칙

1. 제시한 문제의 해결점을 완전히 구현한 이후에 제출 할 수 있다.

- 필요한 실제 연동·설정·동작 검증이 남아 있으면 미완료로 취급한다. 연결 인터페이스만 구현하거나 가상 시험·대체 경로가 통과한 것으로 전체 해결을 완료했다고 판단하지 않는다.
- 미완료 항목을 설명에 적었다는 이유로 제출하지 않는다. 필요한 사용자 작업이 있으면 구체적으로 안내하고, 해결을 완성한 뒤 제출한다.

## XDR-01 영구 RULE

무차별 로그인 작업은 [문제 제약 RULE](vault/docs/XDR_RULES.md)의 R-X01-COMPLETE부터 R-X01-REPAIR까지 적용한다.
입력 계약·빈 격리 실행·분류 기준·실제 연결·비밀값 보호·배포 커밋 일치·실패 재현을 각각 확인한다.
임시 작업 과정 문서를 폐기한 뒤에도 이 RULE과 실패 분류는 보존한다.

## 사용자 설명 선호

- 한국어로 설명한다.
- 과제 안내는 먼저 **왜 하는지 → 하면 무엇이 생기거나 달라지는지 → 무엇을 배우는지**를 설명한 뒤 구체적인 실행 순서를 제시한다.
- 버튼과 절차만 나열하지 않는다. 사용자가 얻을 결과와 각 행동의 목적을 연결한다.
- 사용자는 현재 ALEPH BYTE BACK 방어전을 이해하고 있다. 이 기록만으로 배포, 계정 연결, 제출을 대신 수행할 권한이 생기는 것은 아니다.

## 지식그래프: ALEPH BYTE BACK 2차 방어전

출처: 2026-10-06 현재 브라우저의 https://aleph-omega.vercel.app/defense 화면 및 열린 1단계 안내. 아래는 당시 안내의 기록이며, 일정·개방 상태·점수·판정은 다시 확인한다.

### 전체 목적과 관계

- 사용자 → 연습용 자료실을 배포하고 단계별로 접근 통제를 개선한다.
- 내 GitHub 계정 → 코드·파일을 보관하는 저장소를 소유한다.
- 내 계정의 저장소 소유 → 웹사이트의 자료 접근이 자동으로 제한됨을 의미하지 않는다.
- Vercel → 저장소를 배포하여 인터넷에서 접근 가능한 웹사이트 주소를 만든다.
- 웹사이트 배포 → 다른 사람이 어떤 자료를 읽을 수 있는지 확인할 필요가 생긴다.
- 인증 → 사용자가 누구인지 확인한다.
- 인가 → 확인된 사용자가 어느 자료에 접근할 수 있는지 결정한다.
- 자료실의 화면뿐 아니라 데이터 경로도 확인 → 화면에서 숨긴 자료가 직접 요청으로 노출되는지 확인한다.
- 방어전의 학습 목표 → 자료를 함부로 읽지 못하도록 설계하고, 공개된 출발 상태와 방어된 상태를 비교해 보안 장치의 필요성을 이해한다.

### 단계별 연결

1. **급하게 만든 내 자료실이 다 보입니다** → 제공된 시작 틀을 배포하고, 가상 메모 네 건이 비로그인 상태에서 공개되는 것을 관찰한다. 의도적으로 취약한 출발점이며 아직 방어를 완성하는 단계가 아니다. 공개 상태 확인이 다음 단계 진입의 조건이다.
2. **자료를 코드 밖으로 옮깁니다** → 자료를 코드와 분리해 관리한다. 이 조치만으로 접근 통제가 완성되는 것은 아니다.
3. **진짜 로그인을 붙입니다** → 인증을 추가한다.
4. **로그인해도 내 자료만 보이게 합니다** → 사용자별 자료 접근 권한을 제한한다.
5. **자료 요청을 서버 한곳으로 모읍니다** → 서버를 통한 자료 요청 처리로 이어진다.

2~5단계는 당시 상황실의 제목과 대화에서 이해한 목적을 기록한 것이다. 구현 요구사항은 각 단계의 실제 상세 안내를 읽은 뒤 결정한다.

### 1단계의 구체적인 산출물과 확인 조건

- 원본 시작 틀: https://github.com/ChoiTimo/aleph-defense-starter
- 내 GitHub 계정의 공개 저장소 이름: `choi-bujang-secret-vault`
- 생성 흐름: 「최부장의 비밀창고 만들기」 → Vercel에 GitHub로 로그인 → 저장소 생성 → Deploy.
- 당시 안내는 무료 Hobby 요금제, `Create private Git Repository` 체크 해제, 기본 배포 설정 사용을 지시했다.
- 배포 완료 후 Dashboard의 Domains에서 짧은 `https://…vercel.app` 주소를 얻는다.
- 비로그인/시크릿 창에서 `/`, `/data.json`, `/aleph.json`을 확인한다.
- 배포 화면과 `/data.json`, 공개 저장소에 가상 메모 네 건이 있는지 확인한다.
- `/aleph.json`의 저장소·커밋 정보가 본인 GitHub 저장소와 맞는지 확인한다. 비밀값은 출력하지 않는다.
- 실제 개인정보·학생 자료·비밀번호·연락처를 넣지 않는다. 제공된 가상 자료만 사용한다.
- 이 단계에서는 로그인을 붙이거나 접근 제한을 추가하지 않는다.
- 설정 파일을 손으로 수정하거나 `npm run bundle` 실행을 요구하지 않는다는 안내가 있었다.
- 제출 산출물 → 배포 주소 하나. GitHub 저장소 주소나 ALEPH 과제 페이지 주소가 아니다.
- 제출 흐름 → 1단계 창의 「내 배포 주소」에 입력 → 「심판에게 제출하기」 → 판정 확인. 「심판에게 전할 내용」은 선택 사항이다.

### 당시 상태와 미완료 작업

- 당시 사용자 점수는 0/500점, 1단계는 제출 가능, 2~5단계는 잠겨 있었다.
- 단계마다 100점 만점, 전체 목표는 400/500점이었다. 같은 단계는 여러 번 제출하면 가장 높은 점수가 남는다고 안내됐다.
- 당시 2차 방어전 1~5단계 기한은 한국시간 2026-10-12 밤 24시, 즉 2026-10-13 00:00이었다.
- 최초 안내 시점에는 배포·제출을 수행하지 않았다. 이후 사용자가 직접 진행했고, 아래 진행 기록에서 배포와 제출 접수를 확인했다.
- 다음 행동이 요청되면 먼저 현재 진행 상태를 확인하고, 이미 끝낸 작업을 반복하지 않는다.

### 진행 기록: 2026-10-06

- 사용자가 「일단 했어」라고 알린 뒤 실제 브라우저 화면을 확인했다.
- 배포 주소: https://choi-bujang-secret-vault-ecru.vercel.app/
- 배포 화면 제목은 「점령된 자료실」이며, 로그인 화면 없이 과제·포트폴리오·아침 리추얼·훈련 행정 자료의 가상 기록 네 건이 표시됐다.
- ALEPH의 1단계 창에 「심판이 검사하고 있습니다」, 「방금 접수했습니다」가 표시돼 제출 접수가 확인됐다. 당시 안내 소요 시간은 2~4분이었다.
- 점수·통과 여부·2단계 개방 여부는 아직 확인하지 않았다. 다음 작업에서 최신 판정을 확인한다.
- `/data.json`, `/aleph.json`은 확인 도구의 접근 제한으로 직접 검증하지 못했다. 공개 GitHub 저장소와 배포 커밋 일치 여부도 아직 검증하지 않았다.

### 최종 ZTNA·XDR 패키지

출처: 2026-10-06 「패키지·제출」 링크를 따라 열린 https://aleph-omega.vercel.app/memorial#package 의 「ZTNA·XDR 패키지 확인」 카드.

- 최종 패키지 → 1~12단계와 총공세·XDR에서 만든 방어를 남이 설치해 쓸 수 있는 제품으로 묶은 결과물이다. 현재 2차 1~5단계는 전체 과정의 일부이다.
- 제출 시점 → 2~4차 방어전과 총공세가 모두 시작된 뒤 제출 가능하다고 안내한다. 모두 완료해야 제출 가능하다고 바꾸어 설명하지 않는다.
- 제출 입력 → GitHub 저장소 주소, 시연 주소, 심판에게 전할 내용(선택).
- 심판 → 접수 시점의 저장소 커밋을 고정해 확인한다. 제출 후에도 저장소와 시연 주소를 보관한다.
- 패키지 카드 → 패키징 확인표 P1~P8, 총공세 및 XDR 결과를 모아 포트폴리오/지원서에서도 활용한다.
- P1 → `package/` 필수 문서와 `SELF-CHECK.md`가 있다. 다른 필수 문서의 정확한 파일명은 이 카드에서 확인되지 않았다.
- P2 → 브라우저 코드·저장소에 API 키가 없다.
- P3 → 새 서버 함수는 `api/ai`, `api/threat-intel`뿐이며 비로그인 요청을 거부한다.
- P4 → AI 중계에 사용자별 호출 상한이 있다.
- P5 → 침해 정보가 NVD·KEV에서 오고 마지막 받은 시각이 있다.
- P6 → 브라우저가 접근 허용·거부를 스스로 정하지 않는다.
- P7 → README대로 새 Vercel 프로젝트에 배포해 첫 화면까지 간다.
- P8 → 구성도·규칙 목록·침해 정보 대조가 실제 코드와 맞는다.
- 당시 패키지 저장소·시연 주소는 카드에 없고, 패키징 판정은 아직 확인되지 않았다. 과정 기록에는 방어 점수 100이 표시됐지만 특정 단계 판정은 이 확인에서 직접 읽지 않았다.

### 진행 기록 및 2단계 안내: 2026-10-06

- 1단계 창에서 「방어에 성공했습니다」, 조건 3개 확인, 100/100점이 직접 확인됐다. 상황실에서는 2단계가 제출 가능해졌다. 상황실 합계와 담당 안내는 이전 값을 보여 단계 창의 판정을 기준으로 한다.
- 이 작업 폴더에는 AGENTS.md만 있으며 Git 원격이 없다. 실제 `choi-bujang-secret-vault` 소스는 아직 이 폴더에 연결되지 않았다. 구현 전 사용자의 실제 GitHub 저장소를 확인한다.
- 2단계 목적 → 최신 공개 정적 파일·저장소에서 메모를 제거하고, 학습용 Supabase DB → Vercel 서버 API → 화면 흐름으로 옮긴다.
- 제작 1 → SQL 파일 작성, `owner_id uuid` 칸 준비, 아직 `auth.users` 외래키 연결하지 않음. 테이블 RLS 활성화, anon·authenticated에 자료 읽기 권한을 주지 않음. 공개 `data.json`에 메모를 남기지 않음. SQL Editor에서 실행 후 확인한다.
- 안내 불일치 → 제작 1에는 가상 메모 「세 개」, 제작 2에는 「네 건」으로 적혀 있다. 실제 1단계 화면과 제작 2 확인 조건은 네 건이므로 네 건 유지가 합리적이며 설명할 때 불일치를 알린다.
- 제작 2 → Vercel `api/` 서버 함수가 가상 메모 네 건을 읽도록 변경. `SUPABASE_URL`, 서버 전용 `SUPABASE_SECRET_KEY` 환경변수 사용. 키를 브라우저 파일·응답·로그에 넣지 않음. 아직 공개 API라는 약점을 README에 기록한다.
- 제작 3 → 최신 배포·GitHub 파일에서 가상 메모 문장을 검색하는 절차와 결과를 README에 기록. 옛 공개 커밋·배포에 남은 과거 노출이 해결됐다고 쓰지 않는다.
- 제출 전 안내 → 「2단계 저장점」 커밋 후 `npm run bundle` 실행하여 제출 묶음 JSON과 요약 확인. 1단계의 bundle 불필요 안내를 2단계에 적용하지 않는다. 실제 제출 칸은 배포 주소다.
- 추가 10점씩 → `/data.json`이 404 또는 메모 0건, `/aleph.json` 정상 열림, 첫 화면의 `X-Content-Type-Options: nosniff` 또는 CSP 헤더. 기본 70점 + 3항목 = 100점.
- 현재는 안내만 확인했고 2단계 코드·DB·환경변수를 변경하지 않았다.

### Supabase 프로젝트 생성 안내: 2026-10-06

- 사용자가 Supabase New Project 화면을 열었다. 프로젝트 생성 완료는 확인하지 않았다.
- 당시 화면: 본인 FREE 조직 선택, 기본 프로젝트 이름, Database password 비어 있음, Region Asia-Pacific, Enable Data API 켜짐, Automatically expose new tables 켜짐, Enable automatic RLS 꺼짐.
- 안내할 권장 설정: GitHub(optional)은 현재 단계에서 연결 불필요, 알아보기 쉬운 프로젝트명, 사용자 본인이 DB 비밀번호 생성·보관, Asia-Pacific 유지, Data API 켜짐 유지, 새 테이블 자동 공개 꺼짐, automatic RLS 켜짐. 실제 SQL에서도 RLS·anon/authenticated 읽기 제한·서버 권한을 확인해야 한다.
- DB 비밀번호와 `SUPABASE_SECRET_KEY`는 별개이다. 비밀번호/비밀 키를 채팅에 공유하도록 요청하지 않는다.
- 프로젝트 생성 → 빈 DB 공간 준비. 가상 메모 이전과 화면 연결은 SQL 및 Vercel 서버 코드 변경으로 후속 수행한다.
- 이번 요청은 상세 설명이며 설정 변경·프로젝트 생성·비밀번호 입력은 대신 수행하지 않았다.

### Supabase 생성 완료 및 저장소 연결의 의미

- 이후 브라우저에서 `choi-bujang-vault-db` 프로젝트의 Healthy 상태를 확인했다. 프로젝트 ref는 `ghsdcculokaxprelnvdv`, 프로젝트 URL은 https://ghsdcculokaxprelnvdv.supabase.co 이다.
- 당시 대시보드는 GitHub 저장소 미연결, 마이그레이션 없음으로 표시됐다. 테이블 생성·자료 이전 여부는 직접 검사하지 않았다.
- Supabase GitHub 통합은 저장소의 Supabase 마이그레이션 등 배포 자동화용이다. 단순 연결만으로 기존 `data.json`을 테이블로 옮기거나 Vercel 화면 코드를 수정하지 않는다.
- 2단계의 코드 편집에 로컬 clone만이 유일한 방법이라고 설명하지 않는다. 사용자 요청·실제 연결 기능에 맞게 코드에 접근한다. Supabase GitHub 통합과 이 채팅의 코드 작업 폴더 연결은 별개의 연결이다.
- 확인한 공식 문서: https://supabase.com/docs/guides/deployment/branching/github-integration

### 2단계 전체 안내를 위한 원본 코드 확인

- 2026-10-06 원본 시작 틀의 README, AGENTS.md, package.json, data.json, public/index.html, scripts/build-public.mjs, scripts/bundle.mjs, aleph.config.json, vercel.json, .gitignore를 읽었다. 사용자 저장소의 현재 파일은 아직 확인하지 않았으므로 원본과 같다고 단정하지 않는다.
- 원본 public/index.html은 `/data.json`을 fetch하고 `{ notes: [{ title, content }] }` 형식으로 렌더링한다. 서버 응답에서 이 형식을 유지하면 화면 변경을 최소화할 수 있다.
- 원본 scripts/build-public.mjs는 step이 1이 아니면 오류를 내고, root data.json을 public/data.json으로 복사한다. 2단계에서 이 복사를 끝내고 기존 결과물도 정리하되, public/aleph.json의 배포 신원 생성은 보존해야 한다.
- 원본 package.json은 Node >=22, npm run build 및 npm run bundle, @supabase/supabase-js 의존성을 포함한다.
- bundle은 커밋되지 않은 파일이 있으면 실패하고 HTTPS GitHub origin, 설정의 repoUrl 일치, bundle-notes.json, 실제 공격 점검 결과를 요구한다. 결과 경로는 artifacts/submission.json이다. 생성 파일은 원본 .gitignore에 제외되어 있다.
- 원본 AGENTS.md는 한 제작 단위씩 요청, 비밀값과 메모 본문을 제출 묶음에서 제외, bundle 생성물 미커밋, judgeIssuer 임의 변경 금지를 요구한다.
- 메모를 포함한 초기 입력 SQL을 공개 최신 저장소에 커밋하면 2단계 메모 제거 조건과 충돌한다. seed SQL은 SQL Editor 또는 Git에서 제외한 로컬 파일로 적용하고 공개 저장소에는 본문 없는 스키마/권한 문서만 남긴다.
- 최신 Supabase 화면은 Settings > Integrations의 GitHub repository 선택 대기 상태였다. 아직 저장소 연결 완료는 확인되지 않았다.

### 2단계 직접 구현: 진행 중

- 사용자가 「니가 직접 진행해」라고 요청하여 2단계 구현, DB 설정, 배포와 제출을 직접 진행하도록 승인했다.
- 실제 배포 `/aleph.json`과 Vercel Source에서 사용자 저장소가 `SKT-ALEPH/choi-bujang-secret-vault`임을 확인했다. GitHub 로그인 NoGravyBeef가 ADMIN 권한을 갖는다. 작업 사본은 이 폴더의 `vault/`이다.
- Supabase SQL Editor에서 public.notes 테이블을 생성하고 가상 메모 네 건을 입력했다. 확인 결과: 자료 4건, RLS=true, anon SELECT=false, authenticated SELECT=false, service_role SELECT=true.
- 서버 GET /api/notes, 프런트엔드 서버 조회, 최신 data.json 비우기, 공개 복사 빌드 변경, 2단계 배포 신원 생성, nosniff 헤더, README, 실제 배포 자기 점검, SQL 스키마 및 안전성 테스트를 구현했다.
- 로컬 확인: `node --test test/r5.test.mjs test/stage2.test.mjs`의 5개 시험 통과; `npm run build -- --local` 성공; 공개 notes 0건; 46개 파일의 메모 본문·키 검색에서 일치 없음.
- 로컬 main 커밋: `5b26009` (2단계 저장점: 서버 자료 조회와 공개 메모 제거). 아직 원격 push하지 않았다. 키 미설정 상태로 기존 사이트를 깨뜨리지 않도록 대기한다.
- 메모 입력 SQL은 vault/.local/stage2-seed.sql에 보관하며 Git에서 제외했다. 공개 sql/stage2-schema.sql에는 본문이 없다. bundle-notes.json도 Git 제외로 준비했다.
- Vercel Production 환경에 SUPABASE_URL을 저장했다. SUPABASE_SECRET_KEY는 아직 없으며 Secret 형식, Production, 키 이름까지 입력한 공식 화면을 준비했다.
- vault/AGENTS.md는 비밀값을 학생이 공식 입력란에 직접 넣도록 요구한다. 사용자에게 Supabase Secret key를 Vercel에 직접 저장하고 완료를 알리도록 요청했다. 실제 키를 읽거나 채팅으로 요청하지 않았다.
- 다음 행동: 키 저장 완료 확인(값은 읽지 않음) → main push → 실제 배포 준비 확인 → 화면 네 건, data.json 0건, aleph.json의 저장소/커밋, 헤더 검증 → npm run bundle → ALEPH 2단계 제출 → 심판 결과 확인.
- 준비 화면 기록: artifacts/vercel-secret-input.jpg. 작업 완료로 보고하지 않는다.

### 2단계 배포 및 키 교체 대기

- 사용자가 최초 키 저장 완료를 알렸고 main을 push했다. 최신 원격 커밋 bc638c1은 공식 Supabase SDK로 서버 자료를 조회한다. 로컬에는 SDK 헤더 테스트 수정 저장점이 추가됐다.
- 배포의 /aleph.json은 2단계와 실제 원격 커밋을 표시하고, /data.json은 notes 0건이며 첫 화면 nosniff 헤더도 확인됐다.
- /api/notes는 아직 502다. 비밀값을 출력하지 않는 진단에서 Supabase 인증 401, 키 종류 unrecognized를 확인했다. DB 권한은 이미 RLS=true, anon/authenticated 읽기=false, service_role 읽기 및 public schema USAGE=true로 확인됐다.
- 실제 키를 읽거나 출력하지 않고 Vercel의 SUPABASE_SECRET_KEY 수정 입력란(Secret, Production, 빈 Value)을 준비했다. 같은 Supabase 프로젝트의 실제 sb_secret_ 키 전체를 학생이 직접 교체하도록 요청했다. 준비 화면: artifacts/vercel-key-replacement.jpg.
- 로컬 시험 5개는 통과했다. 키 교체 후 최신 저장점 push → 정상 화면/API 검증 → 실제 bundle 생성 → 2단계 제출 → 심판 판정 확인이 남았다. 아직 2단계 완료/통과로 보고하지 않는다.

### 2단계 완료 및 3단계 직접 진행

- 사용자가 3단계 브리핑 후 「니가 진행 부탁해」라고 요청했다. 3단계 구현·배포·제출을 진행하도록 승인했다.
- 사용자가 서버 키를 직접 교체했다. 2단계 커밋 9ab3e0e 재배포에서 /api/notes 200·메모 4건, /aleph.json 커밋 일치를 확인했다. 포털 2단계 창에서 이미 100/100점 통과를 확인해 재제출하지 않았다.
- 2단계 정상 자기 점검 묶음은 artifacts/stage2-submission.json, 심판 통과 화면은 artifacts/stage2-result.jpg에 보관했다.
- 3단계 안내: Supabase Auth 이메일·비밀번호 로그인/로그아웃 → 원본 src/verify-login.mjs로 서버 토큰 검증(도우미와 judgeIssuer 변경 금지) → 확인된 ID로 owner_id 저장 및 메모 CRUD → 실제 경로를 allowedRoutes에 기록 → 저장점·bundle·배포 주소 제출.
- 3단계 목록은 로그인 사용자의 메모만 반환한다. 개별 GET·PUT·DELETE는 아직 소유자 검사가 없어 B의 A 메모 접근을 허용하며, 이 약점은 4단계에 남긴다.
- API 계약: POST {id?,title,body}, id=UUID(없으면 서버 생성), 개별 GET·PUT·DELETE /:id, 개별 GET {id,title,body}, 삭제 후 GET404. 무로그인·검증실패는 자료 없는 401JSON. issuer/audience/JWKS는 실제 Supabase 프로젝트로 기록한다.
- 기존 4건을 유지한 채 DB id를 UUID로 변환했다. RLS=true, anon/authenticated 읽기=false, service_role 쓰기=true 확인. 원본 helper가 심판의 시험 신원도 처리하므로 owner_id에 auth.users 외래키를 추가하지 않는다.
- Supabase Site URL을 실제 배포 주소로 저장했다. 이메일 확인은 활성 상태를 유지했다. 브라우저에는 공식 SDK UMD와 publishable key만 사용한다.
- 3단계 저장점 a58e5fd를 main에 push했다. 로컬 시험6개 통과, 공개대상52파일의 실제 키·토큰·메모 본문 패턴0건. 배포 검증과 포털 심판 판정, 일반 A 계정 화면의 실제 로그인·CRUD 확인이 남았다.
- a58e5fd 배포의 /aleph.json에서 3단계·실제 커밋 일치를 확인했다. 정상 로그인 화면과 공식 SDK 파일이 열린다. 실제 무로그인 GET·POST·PUT·DELETE 및 잘못된 토큰은 모두 401 JSON, nosniff 헤더와 배포 신원은 정상이다.
- npm run bundle 성공: 3단계·a58e5fd·변경15파일·실제자기점검7개. 결과는 vault/artifacts/submission.json이다.
- 포털 3단계에 실제 배포 주소를 제출했고 「심판이 검사하고 있습니다」「방금 접수했습니다」를 확인했다. 아직 3단계 통과로 보고하지 않는다.
- 일반 A 계정의 비밀번호 입력은 같은 AGENTS 규칙에 따라 사용자에게 직접 자료실에서 로그인하도록 요청했다. 사용자가 로그인 완료를 알려주면 가상 메모 CRUD·로그아웃 UI를 확인한다. 그동안 심판 판정을 기다린다.
- 이후 포털 3단계 창에서 「방어에 성공했습니다」, 조건7개·가점3개, 100/100점을 직접 확인했다. 제출 커밋은 a58e5fdb1646d25beabeec285dd7b37a23aba893. 증빙 artifacts/stage3-result.jpg.
- 사용자가 실제 자료실 로그인 완료를 알렸다. 일반 계정의 기존 메모는 보존하고, 에이전트가 만든 「3단계 검증용 임시 메모」의 실제 화면 추가·수정을 확인했다. 사용자 비밀번호·JWT를 읽거나 기록하지 않았다.
- 브라우저 규칙의 되돌릴 수 없는 삭제 실행 직전 확인에 따라 에이전트가 만든 임시 메모1건 삭제만 사용자에게 확인 요청했다. 승인 뒤 삭제·목록 반영·로그아웃을 확인한다. 거절하면 임시 메모를 보존한다. 단계 구현·배포·심판 제출/통과는 완료됐으며 이 확인은 화면 검증 자료의 정리이다.
- 4단계는 아직 구현하지 않았다. 타인 메모 개별 접근의 소유자 검사가 다음 범위다. 사용자가 3단계를 요청했다고 4단계까지 임의로 진행하지 않는다.
- 사용자가 임시 메모 삭제를 허용했다. 해당 메모의 삭제 버튼으로 확인창을 열었으나 브라우저 도구가 열린 JS confirm 때문에 후속 조작을 처리하지 못했다. Codex 앱 자체 조작도 안전 제한으로 거부돼, 사용자에게 열린 확인창의 확인 버튼만 직접 누르도록 요청했다. 이미 삭제 승인은 받았으므로 다시 삭제 허가를 묻지 않는다. 완료 후 삭제 반영과 로그아웃을 확인한다.

### 사용자 지시 및 4단계 진행

- 사용자가 「확인 눌렀고. 이제 쓸데없는 작업 그만하고 4번하자」라고 답했다. 임시 메모 삭제 확인은 사용자 본인이 눌렀다고 기록하며, 추가 화면 검증·로그아웃을 중단하고 4단계로 진행했다. 사용자는 이미 통과한 단계의 부가 작업보다 다음 단계 진행을 우선한다. 필수 보안 점검은 수행하되 불필요한 추가 시험·정리를 만들지 않는다.
- 4단계 전체 구현·DB 권한 적용·배포·제출이 사용자 요청 범위다. 원본 verify-login.mjs와 judgeIssuer, 실제 경로 계약은 보존한다.
- 4단계 개별 조회·수정·삭제에서 DB 쿼리에 owner_id=검증된 사용자 ID 조건을 원자적으로 추가했다. 상대 행과 없는 행은 404로 거부한다. POST/PUT 본문의 owner_id/ownerId는 400으로 거부한다. 추가 소유자는 계속 검증된 ID로 저장한다.
- DB notes의 PUBLIC·anon·authenticated 기존 권한을 회수하고 authenticated에 CRUD만 부여했다. 네 가지 RLS 정책: SELECT/DELETE 기존 행 USING, INSERT 새 행 WITH CHECK, UPDATE 양쪽 모두 auth.uid()=owner_id.
- 적용 전 확인: 실제 자료실 계정1개, 기존 owner 없는 가상자료4건, notes 정책0개, 두 역할 읽기권한false. 적용 후 anon의7권한은 모두false, authenticated는CRUD만true이고 TRUNCATE/REFERENCES/TRIGGER=false.
- 실제 DB 트랜잭션에서 가상 A/B 신원으로 본인 CRUD허용, 타인 읽기·수정·삭제 거부, 소유자 변경과 위조 소유자 삽입 거부를 확인하고 모두 롤백했다. 이는 실제 B 계정 로그인 검증과 구분한다. 증빙 artifacts/stage4-rls-result.jpg.
- 안내의 제작1은 두 계정 이메일로 owner를 배정하는 SQL 제안이다. sql/stage4-owners.sql을 준비했으며, 현재 계정1개라 실행하지 않았다. 원래 가상4건과 사용자의 메모는 보존했다. 실제 이메일이나 비밀번호를 요구하거나 Git에 저장하지 않는다.
- 로컬 보안시험6개 및 정적빌드 통과. 공개대상54파일의 비밀값·기존메모본문 패턴0건. 4단계 저장점을 main에 push했다. 실제 배포검증·bundle·심판 판정이 남았다.
- 4단계 커밋 03434a216b4dfa926adedfb778c4daf192be546d의 실제 배포 신원 일치를 확인했다. npm run bundle 성공: 변경9파일·실제자기점검8개, 무로그인4메서드·잘못된토큰·익명직접DB 모두401, 배포정보와 nosniff 정상.
- 포털4단계에 실제 배포 주소와 구현 설명을 제출했다. 접수 결과와 심판 판정 확인을 진행 중이다. 사용자에게 불필요한 추가 계정 생성이나 화면 정리를 요구하지 않는다.
- 이후 포털4단계 심판에서 「방어에 성공했습니다」, 조건6개·완결성 가점3개, 100/100점을 직접 확인했다. 타인 조회·수정 및 시험 계정 B의 A 메모 삭제 공격 모두 격파로 표시됐다. 제출 커밋은 03434a216b4dfa926adedfb778c4daf192be546d이며 증빙은 artifacts/stage4-result.jpg, 제출 묶음은 artifacts/stage4-submission.json이다.
- 4단계 구현·DB 정책 적용·배포·제출·심판 통과 완료. 실제 B 계정의 일반 브라우저 로그인은 수행하지 않았으며 DB 역할 시뮬레이션과 심판 검증으로 구분한다. 5단계는 아직 요청받지 않았으므로 진행하지 않는다.

### 5단계 직접 진행

- 사용자가 「5단계도 진행」을 요청했다. 구현·학습 DB 권한 회수·배포·제출·심판 검증까지 진행한다. 4단계 마지막 커밋과 README 단계 일치를 확인했다.
- 브라우저 메모 CRUD 직접 Supabase 호출은 없음. 기존 /api/notes와 원본 verify-login.mjs 및 judgeIssuer를 보존했다. 만점 조건을 위해 공개 키를 서버 config/supabase-public.json으로 옮기고 공식 SDK Auth만 고정된 /api/auth 프록시로 연결했다. 화면 설정에는 URL만 있다. 인증 비밀번호·토큰은 읽거나 출력하지 않는다.
- sql/stage5-revoke.sql을 실제 학습 DB에 적용했다. notes의 PUBLIC·anon·authenticated 직접 권한을 모두 회수하고 원래 메모, RLS 정책, service_role 권한을 보존했다. originalApiUrl은 쿼리 없는 실제 HTTPS /rest/v1/notes 경로다. 다른 테이블은 변경하지 않았다.
- 실제 DB 트랜잭션에서 service_role CRUD 성공 및 authenticated 직접 조회·수정 거부를 확인하고 시험 행 변경은 모두 롤백했다. 최종 결과 direct_read_revoked·direct_write_revoked·server_crud_retained·rls_retained 모두true, transaction_check=passed; fixtures rolled back. 일반 B 계정 로그인 시험과 구분한다.
- 로컬 시험8개·정적빌드 통과. 공개대상57파일의 알려진 무효 토큰 시험 문자열 제외 후 비밀값 패턴0건, public 키 패턴0건. 배포·bundle·심판 결과 확인이 남았다.
- 5단계 커밋 ae24c36e4d44a0df2d825998b90a16baede501b3을 main에 push하고 실제 배포 /aleph.json의 5단계·커밋·allowedRoutes·originalApiUrl 일치를 확인했다. npm run bundle 성공: 변경14파일(이름변경을 이전/이후 두 경로로 계산)·실제자기점검11개. 무로그인4메서드·무효토큰·익명직접DB401, Auth 우회자료경로404, 공개5파일키·시드자료없음, 보안헤더·메타데이터정상.
- 실제 5단계 자료실을 새로고침한 뒤 기존 A 로그인을 유지한 채 본인 메모 목록이 표시되는 것을 확인했다. 추가 CRUD·계정 생성·삭제 정리 작업은 하지 않았다. 포털에 5단계 배포 주소와 구현 설명을 제출하고 「심판이 검사하고 있습니다」「방금 접수했습니다」를 확인했다. 아직 심판 통과로 보고하지 않는다.
- 이후 실제 포털 5단계에서 「방어에 성공했습니다」, 조건7개·완결성 가점3개, 100/100점을 확인했다. 직접 원본 조회·수정과 공개 파일 키/시드 자료 검색 공격 모두 격파로 표시됐다. 최초 제출 커밋 ae24c36의 심판 통과 증빙은 artifacts/stage5-result.jpg이다. 상황실에서 1~5단계 모두 「막아 냈습니다」, 자료함4/4 회복, 「2차 침공을 막아 냈습니다」 표시도 확인했다. 합산 점수판은 여전히0으로 표시되어 개별 점수와 구분한다.
- 실제 Auth 실패 점검에서 SDK의 오류 코드 호환 차이를 발견해 api/auth.js·test/stage5.test.mjs만 보완했다. c3ed50a72f63e1b921a78611a35f040f2110d29f를 main에 push·배포했다. Auth 관련 시험2개 통과, 실제 잘못된 로그인400·invalid_credentials·세션없음 확인. 최종 배포 신원 일치 및 bundle 자기점검11개 통과, 최신 묶음 artifacts/stage5-submission.json. 이 후속 오류 안내 보완은 심판 재제출하지 않았으며 ae24c36의 100점과 구분한다. 일반 B 계정 로그인·추가 화면 CRUD는 미실행이다.
- 5단계 요청 완료. 기존 자료·로그인·서버 소유자 검사를 유지하면서 직접 DB 접근을 회수했다. 6단계는 아직 요청받지 않았고 현재 차수 안내는 운영자가 다음 차수를 열 때까지 기다리는 상태다. 불필요한 부가 시험·정리를 진행하지 않는다.

### 2026-10-07 보너스 XDR-01 · 무차별 로그인

- 실제 보너스 작전 화면에서 반 공동11830/14500점·81.6%, 보너스 개방, 본인500/500점 확인. 무차별 로그인80점·웹 입력 조작100점 제출 가능이며 다른 보너스는 아직 잠겨 있다. 사용자에게 무차별 로그인 브리핑 후 「진행하자」라는 직접 구현·배포·제출 요청을 받았다. 웹 입력 조작은 범위에 포함하지 않는다.
- 원본 xdr/fixtures/brute-force.json은 실제 로그가 아닌 가상 Wazuh 경보28건이다. 원본과 src/verify-login.mjs·judgeIssuer·src/decider.mjs의 starter.deny 및 5단계 설정·실제 자료실 기능을 보존한다.
- read-alerts.mjs·patterns.json·decide.mjs·guard.mjs·respond.mjs와 의미 있는 시험을 구현했다. MITRE T1110·T1110.001·T1110.003 근거, 반복 실패·여러 계정 대입·동일 IP/계정120초창 합산, 경보 중복 제외, 15분 만료 및 근거 경보 ID 차단 후보, 비밀값 없는 알림 로그를 추가했다. 판정 결과 JSON은 가상 경보 ID·행동·확신도·짧은 패턴 이유만 담는다.
- 첫 시험에서 비밀번호 여러 계정 연속 대입 경보를 정상으로 잘못 분류한 원인을 실패 신호 인식 조건 한 가지로 수정했다. 최종 가상 경보 결과 block10·alert9·record9, 추가 검사 재생의 정상 이벤트 차단0건·정상9건 통과. 관련 및 기존 로그인·메모 보안시험17개와 정적빌드 통과.
- Jev 주소·키는 제공되지 않아 실제 호출하지 않는다. createDecider({askJev}) 인터페이스와 안전한 수치/불리언 요약·제한시간·실패시alert를 구현했고 기본 실행은 미설정alert 대체 경로다. 가짜 AI 응답을 실제 호출로 보고하지 않는다.
- 현재 ZTNA18필드 계약에는 IP가 없으므로 브라우저 IP나 임의 요청 필드를 믿지 않는다. 추가 guard는 운영자가 신뢰된 출발 주소를 requestId로 제공하는 연결을 받으며, 실제 운영 연결/이유 코드 등록은 아직 없다. allow 시험 기준 함수로 추가 검사만 검증했다. starter.deny 전체 판정이 정상 요청을 실제 허용했다거나 운영 PC·방화벽을 차단했다고 쓰지 않는다. 원본 판정 규칙은 변경하지 않았다.
- 배포·심판 판정 확인은 아직 남았다. generated alerts.log·deny-rules.json·verification.json은 Git 제외이고 가상 result.json은 저장점에 포함한다.

- 사용자가 Jev 연결 방법도 직접 조사하라고 지시했다. TypeSafe 공식 https://docs.typesafe.ai/api 및 /introduction/quickstart 를 확인해 jev.mjs에 고정 공식 POST /v1/systemone·jev-latest·Noul 질문 및 응답검증을 추가했다. XDR_JEV_LIVE=1과 서버 환경 TYPESAFE_API_KEY를 모두 갖춘 때만 외부 호출하며 IP·계정·원문·로그는 보내지 않는다. 키 미설정·오류·타임아웃은 alert이다. 실제 키 저장이나 실제 모델 응답은 아직 없으며 기본 심판 실행은 오프라인이다. 관련 및 기존 기능 시험18개 통과, 공개65파일 비밀값 패턴0건.
- 보너스 저장점 acde4ce8dde1e8d1bbed32031dc93aea0277175b 을 main에 push했다. 실제 Vercel Ready 및 /aleph.json의 동일 커밋·5단계 유지, 무로그인 API401·공개메모0건 확인. 포털에 배포 URL·공개 GitHub URL·구현 한계를 포함한 설명을 제출했다. 아직 심판 판정 대기이며 결과는 artifacts/xdr-01-result.json, 추가 검사 재생 검증은 artifacts/xdr-01-verification.json에 보관한다.

- 사용자가 미구현 상태에서 제출한 행동을 지적하고 「제시한 문제의 해결점을 완전히 구현한 이후에 제출 할 수 있다」를 규칙에 추가하도록 지시했다. 루트와 vault/AGENTS.md에 동일한 제출 규칙을 저장했다. XDR-01의 실제 Jev 호출·운영 판정기 연결 및 동작 검증은 미완료이며, 대체 경로 시험 통과를 완전 구현으로 취급해 제출한 것은 잘못이다. 기존 제출 접수는 이미 발생했지만 이 사실을 해결 완료로 기록하지 않는다. 완전 구현 전 추가 제출을 하지 않는다.

### 2026-10-07 XDR-01 미완료 연동 이어서 구현

- 사용자 「이어서 구현하자」 요청에 따라 실제 Jev 검증과 판정기 연결 진입점을 보완했다. 사용자가 TypeSafe 공식 콘솔에 직접 로그인한 뒤, 키 발급·Vercel 저장도 「니가 해 상관없으니까」로 직접 승인했다. 공식 콘솔에서 조직 키를 발급해 클립보드 값을 출력하지 않고 Vercel Secret TYPESAFE_API_KEY·Production에 저장했다. 키 자체는 답변·로그·파일·Git에 기록하지 않았으며 전송 후 런타임 변수와 복사 값을 비웠다. 결제·충전은 대신 수행하지 않았다.
- Config XDR_VERIFY_JEV=1·Production 저장. scripts/xdr-live-check.mjs는 실제 모델 응답이 모든 애매한 경보에서 있어야 성공하며 첫 실패에서 중단한다. 배포 빌드의 선택적 검증으로 실제 API를 호출하고, 수치·시각·커밋만 public/xdr-live-check.json에 기록한다. 키 미설정·실패는 검증 실패이며 alert 대체를 성공으로 인정하지 않는다.
- src/xdr-decider.mjs는 기존 src/decider.mjs를 보존해 운영 연결 진입점을 제공한다. 신뢰된 주소 제공·규칙 저장·등록된 거부 사유 목록이 없으면 시작하지 않으며, 기존 deny/step_up 결과는 그대로 유지한다. 가상 시험20개·정적빌드 통과. 공개67파일 비밀값 패턴0건.
- 저장점8295b3b을 main에 push했다. 실제 Jev 배포 검증은 진행 중이며 운영 반 엔진의 신뢰된 IP 조회·사유 코드 등록/연결은 아직 제공받지 못했다. 공식 시작 틀·계약·ALEPH Workbench 안내에서 학생이 실행할 운영 XDR 연결 방법은 찾지 못했다. 새 과제 제출은 하지 않는다.

- 실제8295b3bae97aa9565bcb523197203612ac418fcf 배포 Ready 및 /aleph.json 동일 커밋 확인. /xdr-live-check.json에서 real_typesafe_api·요청9·응답9·block10/alert1/record17·2026-10-07T08:50:50.242Z를 직접 확인해 artifacts/jev-live-proof.json에 보관했다. 이는 오프라인10/9/9와 다르며 실제 운영 요청 차단 증거가 아니다. 비로그인 /api/notes401 유지. 실제 API 키 저장 완료 및 성공 검증 뒤 반복 호출을 막도록 Production XDR_VERIFY_JEV=0으로 변경했다.
- 운영 측 연결에 필요한 네 항목·완료 증빙을 vault/docs/XDR_OPERATOR_CONNECTION.md에 작성했다. 운영 연결은 미완료이며 추가 제출하지 않았다. 최신 README의 미설정·미호출 문구를 실제 상태에 맞게 수정했다.

- 실제 Jev 증빙을 Vercel8295b3b 배포 빌드 로그에서도 확인해 artifacts/jev-live-proof.jpg에 저장했다. public JSON의 브라우저 직접 열기는 client 차단으로 실패했으며 재시도하지 않았다. CLI로 미리 확인·보관한 안전한 수치 증빙과 정상 빌드 로그를 근거로 한다. XDR_VERIFY_JEV=0 업데이트 성공을 확인했고 증빙 artifacts/jev-env-final.jpg. 문서245e86e을 main에 push했다. 운영 계약은 미완료 상태로 기록하며 추가 심판 제출은 하지 않았다.

### 2026-10-07 XDR-01 최종 완료와 영구 RULE

- 위 미완료 운영 연결 기록은 이후 해석·구현으로 갱신됐다. 미래 반 엔진 설치를 이번 과제의 필수 조건으로 추가한 것은 과도한 해석이었다. 현재 자료실 HTTP 서버의 실제 접근 통제에 추가 guard를 연결했다. 반 엔진·운영 PC 방화벽을 설치했다고 주장하지 않는다.
- 실제 Jev 연동, Vercel 신뢰 출발 주소 기반 실패 합산, 서버 전용 Supabase 규칙/경보 저장, Auth429·Notes403, 근거UUID·15분 만료를 구현했다. 실제20회 실패 뒤21번째429, 위조 헤더 우회 거부, 시험 규칙 한 건 조기 만료 후 정상 복귀를 확인했다. 15분을 실제 기다린 시험과 구분한다. 기존 로그인·메모·소유자 검사·starter.deny·18필드 계약을 보존했다.
- 판단 원본 analyze.mjs에서 외부 import 없는 decide.mjs를 생성한다. 완전히 빈 ECMAScript VM에서도 원본/추출28건 block10/alert9/record9. 실제 Jev 평가와 오프라인 경보 재생은 구분한다. 관련25시험·정적빌드·bundle실제점검11개 통과, 공개79파일 비밀값패턴0건.
- 최종 저장점03b8d3d5849eca5e5e543df62a3ecb9f263efa0f의 실제배포·제출 뒤 「방어에 성공했습니다」, 조건4개·가점3개,100/100점을 직접 확인했다. 증빙 artifacts/xdr-01-passed.png, 실제HTTP증빙 artifacts/xdr-live-http-proof.json.
- 사용자의 실패 분류 및 RULE 요청을 vault/docs/XDR_RULES.md에 영구 저장하고 루트·vault AGENTS에 연결했다. 완료 판단·입력 계약·실행 환경·검증 환경·범위 해석 오류를 구분한다. 이 RULE은 임시 과정 문서와 달리 보존한다.
- 전체 작업 완료 후 사용자가 지정한 WORK-IN-PROGRESS.md와 상기 포인터를 폐기했다. 코드·영구RULE·증빙은 보존한다. 웹 입력 조작·6단계는 이번 요청 범위가 아니다.

### 무차별 로그인 모듈 설명 페이지

- 사용자 요청에 따라 [무차별 로그인 모듈 정리](https://chatgpt.com/space/page_eb3232462d3c819193de269fe5408cc5)에 육하원칙·실제 두 경로·파일/함수/줄37곳·다이어그램3개·보안경계·검증·구현제약을 저장했다. 코드 링크는 통과 커밋03b8d3d에 고정했다.
- C4 계층 확대, arc42 구성/실행 관점, Diataxis 설명/참조/절차 구분을 적용했다. Mermaid3개 문법 유효·저장블록 확인, 실제 미리보기는 앱안전제한/브라우저로그인으로 미확인이라고 구분한다.
- 이 페이지가 사용자 지정 설명 결과물이다. 코드·배포는 변경하지 않았다. 임시 작성 과정·초안은 완료 후 폐기하고 영구RULE과 실제 증빙은 보존했다.

## XDR-02 영구 RULE
웹 입력 조작에는 [새 문제 제약 RULE](vault/docs/XDR_WEB_INJECTION_RULES.md)을 적용한다. 원본/추출5필드·같은주소 반복·빈격리 실행·실제 Jev·추가guard·TTL/근거·기존방어 보존·완성후 제출을 각각 검증한다. 임시 작업 문서는 전체 트리와 최종 end-to-end가 모두 통과해야만 폐기한다.

### 2026-10-07 XDR-02 웹 입력 조작 완료

- 사용자 전체 수행 지시에 따라 작업/하위작업 트리와 단위 기록을 작성하고 자동으로 구현·검증·배포·제출까지 진행했다. 새 영구 RULE은 vault/docs/XDR_WEB_INJECTION_RULES.md, 구현/실행/경계 설명은 vault/README.md와 코드에 남겼다.
- xdr/web-injection에 5필드 읽기·T1190 패턴·Jev 판단·독립 decide·후보/로그 응답을 구현했다. 원본 가상26경보 불변, fixture block8·alert9·record9, 정상차단0. 빈VM·원본/추출·ID변경/역순·만료·중복·AI실패·기존인증/소유자/무차별방어30시험과 정적빌드 통과.
- 실제 서버 xdr/live.mjs에서 기존 XDR-01과 새 guard를 합성했다. Auth는 인자만, 인증된 메모는 인자/title/body 문법 신호를 메모리에서 확인한다. 비밀번호/토큰/Auth본문은 검사하지 않으며 원본URL/IP/메모를 DB·AI·로그에 보내지 않는다. 운영 출발 주소는 Vercel이 덮어쓴 헤더로 확인하고 HMAC 처리한다.
- sql/xdr-web-injection.sql 적용: 서버 전용 xdr_web_sources/xdr_web_alerts/RPC, RLS 및 anon/authenticated 접근 거부 확인. 실제DB 트랜잭션에서8회 합산·900초TTL·경보UUID근거 검증 후 시험행롤백. 기존 notes/계정/XDR-01 보존.
- 실제 배포87b5c17에서 정상 입력5종은 추가차단 없이 기존400 validation_failed 처리. 반복주입8번째429·RetryAfter900, 정상q 및 위조출발헤더도 같은경보UUID로429. 실제Jev응답7건(DB block1·alert6·record1)을 확인해 오프라인결과와 구분했다.
- 같은 로그인 A의 메모 요청이 차단 안내로 전환됐다가 자신의 시험UUID 한 건만 만료를 앞당기고 지난집계창을 초기화한 뒤 정상목록으로 복귀했다. 15분 실제대기라고 보고하지 않는다. 계정·메모 신규생성/삭제/수정 없음.
- 검증기록 저장점3db1bcab4eeca03f80a4a747c5ea59129d10bf5f 배포신원·원격·clean 일치, bundle 직접점검11개 성공. 구현과 실제연결검증 후 포털에 배포/공개저장소주소 제출했다.
- 실제심판 「방어에 성공했습니다」 조건4개·가점3개,100/100점 확인. 판정커밋3db1bcab4eec. 증빙 artifacts/xdr02-passed.png, xdr02-final-result.json, xdr02-live-http-proof.json, xdr02-live-db-proof.png, xdr02-final-deployment.json.
- 최종 end-to-end에서 배포커밋일치·clean·무로그인메모401·공개notes0·정상Auth400복귀 확인. 전체트리 완료 후 임시 WORK-IN-PROGRESS.md 및 해당 재상기 포인터만 폐기했다. 영구RULE/구현문서/시험/증빙은 보존했다.
- 이것은 학습용 Wazuh 경보 재생과 실제 자료실 HTTP 방어다. 실시간 Wazuh 수집기·운영 반 엔진·PC 방화벽 설치 완료로 보고하지 않는다. 다른 XDR과제는 아직 요청하지 않았다.

## 진행 중 웹 입력 문서 작업
압축 후 WORK-IN-PROGRESS.md를 먼저 읽고 지정된 웹 주입 공격 모듈 정리 Page의 문서 저장/검증을 이어간다. 전체 문서 완료 전 임시 작업 기록을 폐기하지 않는다.

### 2026-10-07 웹 주입 공격 모듈 설명 페이지

- 사용자 지정 [웹 주입 공격 모듈 정리](https://chatgpt.com/space/page_403e8b1c25488191bd9c4126fe9c169a)에 육하원칙, 전체/내부/실행 다이어그램3개, 파일/함수/행51곳, 분류·Jev·영속저장·신뢰경계·검증범위·제약·재현 절차를 저장했다. 코드 링크는 통과 커밋3db1bcab4eeca03f80a4a747c5ea59129d10bf5f에 고정했다.
- C4 확대 원리, arc42 구성/실행 관점, Diataxis 설명/참조/절차 구분을 공식근거와 함께 적용했다. 실제 HTTP 고정창과 경보 판단기의 시간창, 실제 Jev와 대역, 정상 기존400과 XDR429를 구분한다.
- Mermaid3개 문법검사 및 25파일의51줄링크 확인. Page sequence18,67블록 읽기 결과가 초안 본문과 완전 일치했다. 소스·배포·제출 변경 없음, vault git clean.
- Page 열기 요청은 queued이며 실제 렌더 화면은 미확인이다. 사용자 지시상 미검증 항목이 있으면 임시 과정 문서를 폐기하지 않으므로 WORK-IN-PROGRESS.md 및 재상기 포인터를 보존했다. 화면 확인 후에만 해당 임시 기록을 폐기한다.
