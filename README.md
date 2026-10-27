> **2026-10-27 패키지 보완:** 총공세와 P1~P8의 실제 구현·연결·재현 결과는 [SELF-CHECK](package/SELF-CHECK.md)를 따른다. 이전에 성급하게 접수한 마무리 제출은 철회했고 보완 브랜치에서 바로잡았다. 현재 GitHub/배포 커밋과 접수·심판 판정은 별도로 대조하며 과거100점을 최신 결과물 전체의 판정으로 사용하지 않는다.

# BYTE BACK 자료실 · 12단계

## 2026-10-26 · 케셰브 개인 운영 추가

현재 케셰브의 단일 실행은 Node 24.19.0에서 `node personal-workspace/start.mjs`이며 주소는 http://127.0.0.1:5189/ 입니다. 원래 Supabase 자료실·로그인·기기 승인과 기존 Agent를 NetBird Windows 게이트웨이에 연결합니다. ChatGPT OAuth는 AI 설명에만 사용하며, PC 감시는 별도 Wazuh 서비스가 담당합니다. 별도 SQLite 메모 화면은 현재 업무 자료 경로로 제공하지 않습니다. 범위·저장 위치·재실행·검증은 [통합 실행기 안내](personal-workspace/README.md)와 [마무리 제출 설명서](docs/FINAL_SUBMISSION.md)에 있습니다.

## 2026-10-27 패키지 보완

현재 설치·서버 환경변수·새 Vercel 프로젝트 재현은 [패키지 안내](package/README.md), 현재 실제 검증 여부는 [SELF-CHECK](package/SELF-CHECK.md)를 따른다. 아래 이전 단계 기록의 `config/supabase-public.json` 키 보관 설명은 현재 적용하지 않는다. 최신 파일에는 URL만 있고 Auth 키는 `SUPABASE_PUBLISHABLE_KEY` 서버 환경변수로 이동했다. `codex/defense-requirements-repair`에서 검증한 보완 내용을 사용자 요청으로 main에 병합해 배포한다. 이 브랜치의 `publicAppUrl`·`packageServicesUrl`은 새 배포 https://keshev-defense-package-20261027.vercel.app 을 함께 가리키며, 같은 Supabase 계정·자료·기기 등록을 사용한다. 기존 프로젝트와 새 프로젝트 모두 main 배포를 사용하며, 같은 Supabase 계정·자료·기기 등록을 보존한다.

## 현재 상태

8단계는 커밋 `1c110a2c37073b690694724002f898e4161709f9`에서 실제 심판100/100점을 받았습니다. 조건5개와가점3개,타인조회/수정/목록/학생공지쓰기공격모두격파를확인했습니다.9단계도커밋 `5f4b4b248138c0e8c233358d90fd61479d7ad459`에서실제100/100(4조건/3가점/4공격격파)을확인했습니다.10단계는 e10436a9b417에서 실제100/100(5조건/3가점/3공격격파)을확인했습니다.11단계는 cadd46d2a02eaf52e8592f1a1bd82eba9fd640a2 동일코드 재심사에서 실제100/100(6조건/3가점/3공격)을 확인했습니다. 12단계 작전실 구현 및 실제 API 통합47조건/자기점검20조건을 검증했습니다. 실제 심판 결과는 제출 뒤 따로 확인하며 미실행41종을 통과로 표시하지 않습니다.작업기록은저장소상위 `STAGE8-WORK.md`입니다.

9단계의 `src/detect.mjs`는 계약의가명사용자별GET사건만세어10분미만의창에120건을넘으면별도회수제안을반환합니다.정확히120건,다른사용자,창밖사건,비GET은합산하지않습니다.시간순정렬후첫기준초과주체하나만제안하며입력/본문/토큰을로그에남기지않습니다.엔진확인네트워크/기기값이없는연습입력에가짜값을넣지않습니다.기존7단계복합이상판정및8단계구역규칙과5필드판정응답은보존합니다.

`npm run detect:test`는로컬가상사건6조건이며실제접속회수의증거가아닙니다.회수API나기기권한변경은추가하지않고안내대로실제회수/가상기기한개한정/시간은심판의운영시험에서확인합니다.

2026-10-13 실제 Supabase 로그인·배포 API 검사43조건을 통과했습니다. 새 A/B계정과 새 메모로 두 번 각각13조건, 공지17조건을 확인했습니다. 본인 메모 조회·수정·삭제는 허용되고 타인 조회·수정·삭제는404, 학생 공지 수정은403, 저장된 편집권한의 공지 수정은200입니다. 권한 없는 시도 뒤 자료 불변과 직접DB/RPC 우회 차단도 확인했습니다.

시험 대상 배포는 `aeed1c0`이고 실행빌드는 `7070688`입니다. 검사 뒤 시험계정6개·메모2개·공지2개·편집권한1행을 정리했습니다. 일회성 실행을 제거한 최종배포는 `644000c`입니다. API·원본검증기·판정기·배포설정6개 파일은 시험대상/마지막심판/최종배포 사이에서 내용이 같습니다. 평소 빌드는 실제 시험을 자동 실행하지 않습니다.

이 결과는 배포 자료 API의 실제 동작 증거이며 제공엔진 릴레이나 숨겨진 심판 요청을 실행한 결과가 아닙니다. 기본 판정기의 가상 allow/allow를 실제 메모 노출이나 심판 실패 원인으로 확정하지 않습니다. 실제 엔진 경유 구역 검증과 전체 요구 충족은 별도로 확인해야 하며 재제출하지 않았습니다.

현재 코드에는 `src/decider.mjs`, `api/notes.js`, `api/announcements.js`, `sql/stage8-resources.sql`이 있습니다. 설치 및 API 계약은 아래와 같습니다.

2026-10-13 선택 롤백: 운영에서 사용되지 않는 `createDecider(resourceGrants)` 및 XDR 권한표 주입, 별도 접근시험 화면을 제거했습니다. XDR 연결과 인증 API 시험은7단계100점 버전으로 복원했습니다. 기존 인증·소유자 필터·공지별 편집권한·DB 자료는 보존합니다. 변경 전 원본은 Git 제외 로컬 백업에 보관했습니다.

새 심판 안내는 판정기에서 모든 공지 쓰기와 메모 전체 목록 경로를 거부하고, 메모 한 건의 소유자 비교는 API가 맡으라고 명시합니다. 기본 판정기에 별도 사용자–메모 권한표를 넣을 필요가 있다는 이전 추정은 철회했습니다. 최종 API의 저장 권한 검사는 유지합니다.

## 8단계 경로 일치 보완

본인 목록 분리 저장점 `09b6b16`에서 새 A/B 로그인으로 `/my/notes` 목록 분리와 개별 메모 CRUD13조건을 다시 확인했습니다. A는 정상 허용, B는A메모조회/수정/삭제404 및목록에A자료없음, 위조·기능쿼리거부, 시험2계정/메모정리성공입니다. 판정기 전체목록/공지쓰기거부 및 이전규칙 회귀를 포함한 관련13시험이 통과했습니다. 검사 실행 설정은0으로 복원했고 일회성 빌드 코드는 제거했습니다.

판정기는 `GET /notes`·`GET /api/notes` 및 다른 전체 목록 경로를 거부합니다. 본인 목록은 `GET /api/my/notes`(`/my/notes`)로 분리하며 같은 원본 인증·소유자 필터를 재사용합니다. 목록 화면의 요청 주소만 연결하고 메뉴는 유지합니다. 새 본인 목록 API는 읽기만 받고 쿼리 선택자를 거부합니다. 기존 API 주소·자료는 호환을 위해 보존합니다. 판정기의 모든 공지 쓰기는 역할과 무관하게 거부합니다.

경로 보완 저장점 `a9a9152`를 실제 Supabase 로그인으로 검사했습니다. `/notes` 논리 경로에서 본인 CRUD·타인 거부·기능쿼리/소유자위조 거부13조건이 통과했고 새 시험계정2개와 메모1개 정리도 확인했습니다. 기존 실제 API43조건과 별개 검사이며 실제 심판의 최종 판정은 제출 뒤 확인합니다. 일회성 검사 설정은0으로 복원하고 빌드 실행 코드도 제거했습니다.

판정기의 논리 경로(`/notes`, `/notes/:id`, `/announcements`, `/announcements/:id`)와 실제 API 경로를 모두 `allowedRoutes`에 선언합니다. 논리 경로도 Vercel rewrite로 같은 인증·소유자/편집권한 검사에 연결합니다. 기존 API 주소와 화면 메뉴는 유지합니다. 엔진 판정에는18필드만 사용하고 저장 자료의 권한은 원본 JWT 검증 후 최종 API에서 원자적으로 확인합니다.

공식 제작자의 [공개 표본 판정기](https://github.com/ChoiTimo/byteback-sample-pass/blob/main/src/decider.mjs)는 경로별 구역과 최종 소유권 검사 책임을 구분하는 참고 자료로 사용했습니다. 해당 표본의 API는 모두401인 시험용이므로 그대로 복사하거나 실제 인증·인가 검증을 대신하지 않습니다.

`node scripts/stage8-live-read-check.mjs --logical`은 서버 전용 시험 환경에서 임시 A/B 로그인으로 논리 경로의 본인 CRUD·타인 거부13조건을 검사하고 시험 계정/메모를 정리합니다. 비밀값을 출력하지 않으며 일반 빌드에서는 자동 실행하지 않습니다.

## 이전 단계 구현

7단계는 judge_fixture 출처의 hour0~5/22~23, networkunusual, 최근600초
risk_signal20건 이상이 겹치면 step_up_required로 추가 확인을 요청합니다.
지역 단독으로 차단하지 않습니다. 선언 경로의 입장 조건을 충족한 요청의 신호 누락은 추가 확인하며
source none/unknown은 계약상 미제공 상태로 남기고 위치 정상으로 꾸미지 않습니다.
엔진 확인 stepUp.verified와 age0~900초일 때만 재판정에서 허용합니다.
`npm run fixture:7`과 `npm run decider:test`로 정상/복합/재확인 및
기기 거부를 확인합니다. 현재 일반 자료실 브라우저에는 제공 엔진의 재로그인
확인 통로가 없으므로 실제 재로그인 전후 자료 차단 실측은 미실행입니다.
가상 사건·제공 엔진 심판과 구분하며 임의 토큰/헤더로 확인 상태를 만들지 않습니다.
제약은 [7~12단계 RULE](docs/STAGES7-12_RULES.md)입니다.


6단계 당시 판정기는 운영 엔진이 확인한 `deviceRegistered === true`인
`notes` 서비스의 `GET /notes`와 `GET /notes/:id` 읽기만 허용합니다.
미등록·누락·문자열 값은 `deny`와 `device_not_registered`로 거부합니다.
다른 서비스와 쓰기는 기본 거부를 유지합니다. `subjectId`는 엔진이 만든
가명 사용자 ID이며 Supabase 사용자 UUID와 비교하지 않습니다.

확인 순서: `npm run decider:test` → 등록 기기의 정상 요청 통과와 미등록
가상 요청 거부 확인 → `node --test test/stage6.test.mjs`로 누락·범위와
XDR 추가 거부 보존 확인. 모두 로컬 가상 시험이며 실제 인증서/mTLS와
다른 사용자 토큰 조합 공격은 운영 심판이 검증합니다. 이번 단계에 새
인증서·CA·서명 키나 접속 프로그램 설치는 없습니다. 기존 화면·주소·DB
권한·Auth·XDR 연결은 유지합니다. 제약은 [6단계 RULE](docs/STAGE6_RULES.md).
6단계 구현 저장점 이후 실제 배포 커밋을 확인하고 `npm run bundle`로
기존 HTTP 점검11개와 로컬 기기 가상 점검3개를 묶습니다. 심판 판정은
포털의6단계 결과를 별도로 확인해야 합니다.

Supabase Auth 공식 SDK로 이메일·비밀번호 로그인과 로그아웃을 제공합니다.
브라우저에는 Supabase 키가 없습니다. 공식 SDK의 Auth 요청은 고정 경로의
`/api/auth` 서버 함수로 보내고, 서버만 공개 키를 덧붙여 같은 Supabase Auth에
전달합니다. 로그인·가입·이메일 확인·비밀번호 재설정·토큰 갱신·로그아웃을 유지합니다.
서버 Secret key는 계속 Vercel 환경변수에 둡니다.
서버 자료 API는 원본 `src/verify-login.mjs`로 토큰을 검증합니다. 해당 파일과
운영 judgeIssuer는 변경하지 않았습니다. 토큰이 없거나 검증에 실패하면
자료 없이 401 JSON 오류를 반환합니다.

로그인한 사용자는 메모를 추가·조회·수정·삭제할 수 있습니다. 목록은 확인된
사용자의 메모만 반환하고, 새 메모의 owner_id는 서버가 확인한 사용자 ID입니다.
개별 메모 조회·수정·삭제에도 검증된 사용자 ID와 owner_id 조건을 적용합니다.
상대 메모와 없는 메모는 모두 404로 거부해 존재 여부를 숨깁니다. 요청 본문으로
owner_id 또는 ownerId를 보내는 소유자 지정·변경은 400으로 거부합니다.

## 설치와 배포

Node.js 22 이상에서 `npm ci`를 실행합니다. 원본은
ChoiTimo/aleph-defense-starter R5입니다.

1. 기존 2단계 DB에 `sql/stage3-schema.sql`을 적용합니다. 기존 자료를 보존하고
   id를 UUID로 옮깁니다. 이미 UUID면 변환을 반복하지 않습니다.
2. `sql/stage4-rls.sql`로 PUBLIC·anon·authenticated의 기존 테이블 권한을 회수하고
   authenticated에 CRUD만 부여합니다. SELECT·DELETE는 USING, INSERT는 WITH CHECK,
   UPDATE는 USING과 WITH CHECK 모두 auth.uid()=owner_id로 제한합니다. 다른 영구 테이블은 변경하지 않습니다.
3. 5단계에서는 `sql/stage5-revoke.sql`로 notes의 PUBLIC·anon·authenticated 직접
   권한을 모두 회수합니다. 기존 행과 RLS 정책 및 서버 service_role 권한은 보존합니다.
   공개 키는 서버 환경변수 `SUPABASE_PUBLISHABLE_KEY`에 둡니다. 설정 JSON에는 URL만 남기며 빌드가 만드는
   `public/auth-config.json`에는 URL만 있으며 키는 없습니다. Secret key는 이 설정에도 넣지 않습니다.
4. Vercel Production에 `SUPABASE_URL`·`SUPABASE_SECRET_KEY`·`SUPABASE_PUBLISHABLE_KEY`를 직접 저장합니다.
   실제 키·비밀번호·JWT는 채팅, Git, 로그, 응답, 제출 묶음에 넣지 않습니다.
5. Supabase Auth의 Site URL을 실제 배포 주소로 설정합니다. 이메일 확인을
   비활성화하지 않습니다. 테스트 계정과 비밀번호는 사용자가 공식 화면에서
   직접 설정하고, 가입 확인 메일의 링크를 누릅니다.
6. 8단계 공지 자원은 `sql/stage8-resources.sql`을 적용합니다. 편집 권한은 DB 소유자가
   검증된 실제 사용자 UUID와 공지 UUID에 한해 관리합니다. 기본 권한 행은 없습니다.
7. GitHub main을 배포합니다. 빌드는 `public/`에 공식 SDK UMD 파일을 복사하고
   빈 data.json과 실제 배포 신원 aleph.json을 생성합니다. Vercel은 서버 API도 배포합니다.

## 실제 API 계약

- GET `/api/notes`: 로그인 사용자의 `{id,title,body}` 배열.
- POST `/api/notes`: `{id?,title,body}`. id는 UUID이며 생략하면 서버가 생성합니다.
  201 `{id}` 응답. owner_id는 클라이언트 값 대신 검증된 사용자 ID입니다.
- GET `/api/notes/:id`: 200 `{id,title,body}` 또는 404 JSON 오류.
- PUT `/api/notes/:id`: `{title,body}`로 본인 메모만 수정합니다. owner_id는 바꿀 수 없습니다.
- DELETE `/api/notes/:id`: 본인 메모만 삭제합니다. 삭제 후 같은 주소의 GET은 404입니다.
- GET `/api/announcements` 및 `/api/announcements/:id`: 인증된 사용자에게 공지를 반환합니다.
- PUT `/api/announcements/:id`: `{title,body}`. 저장된 해당 공지 편집 권한이 있어야 200, 없으면403.
- 모든 자료 요청은 인증이 필요합니다. 무로그인 401, 잘못된 입력 400,
  중복 id 409, DB 오류 502를 반환하며 DB 오류 상세나 키를 출력하지 않습니다.

Vercel rewrite가 개별 메모 경로를 실제 서버 함수로 전달합니다.
`aleph.config.json`의 identityProvider와 allowedRoutes는 이 계약을 기록합니다.
owner_id에 auth.users 외래키는 없습니다. 원본 검증 도우미가 일반 사용자와
운영 심판의 테스트 신원을 모두 검증하기 때문입니다.

## 확인과 제출

`node --test test/r5.test.mjs test/stage2.test.mjs test/stage3.test.mjs test/stage5.test.mjs`로 배포 신원,
실제 암호학적 토큰 검증, 무로그인 거부, 사용자 ID 결합과 CRUD 계약을 시험합니다.
DB를 대신하는 테스트 응답은 운영 DB 접속의 증거가 아닙니다.
`npm run build -- --local`은 로컬 정적 빌드 확인입니다.

배포 후 무로그인 GET·POST·PUT·DELETE 및 잘못된 토큰 요청의 실제 거부,
현재 단계 aleph.json, nosniff 헤더와 anon 키 직접 DB 거부를 `npm run bundle`에서 직접 요청합니다.
5단계는 공개 파일의 키·시드 자료 부재, 허용 경로, 원본 API 주소, Auth 우회 경로
거부도 직접 점검합니다. `npm run bundle`이 제출 명령이며 포털의 5단계 창에서
「심판에게 제출하기」를 누릅니다. 본인 CRUD는 허용되고 타인 CRUD·무로그인 및
직접 Data API는 거부돼야 합니다. 심판 결과와 자기 점검을 구분합니다.
설명은 Git에서 제외한 bundle-notes.json에 적고 결과 artifacts/submission.json도
커밋하지 않습니다. 실제 포털 제출 칸에는 배포 주소를 넣습니다.

## 검증 기록과 공개 이력

2026-10-06 2단계 심판의 100/100점 통과를 확인했습니다. 2단계 배포
`9ab3e0e18f296dd3531c7e74cbc4afd9ece52bd7`에서 서버 자료 4건도 확인했습니다.
3단계 DB 변경은 기존 4건 보존, id=uuid, RLS=true, anon/authenticated 읽기=false,
service_role 쓰기=true로 확인했습니다. 3단계 a58e5fd 배포는 포털에서 조건 7개·가점 3개, 100/100점 통과를 확인했습니다.
4단계 권한 적용 후 anon의 7개 테이블 권한은 모두 false, authenticated는 CRUD만
true로 확인했습니다. 4단계 03434a2 배포는 조건 6개·가점 3개, 100/100점으로
통과했습니다. 5단계 권한 회수 후 anon·authenticated의 7개 권한은 모두 false입니다.
실제 DB 트랜잭션에서 service_role CRUD 성공과 authenticated 직접 조회·수정
거부를 확인하고 시험 변경은 모두 롤백했습니다. 기존 RLS도 유지했습니다.
로컬 시험 8개 및 정적 빌드를 통과했습니다. 5단계 배포 후 실제 A 로그인을 유지한
채 본인 메모 목록 표시를 확인했습니다. ae24c36의 5단계 심판은 조건7개·가점3개,
100/100점 통과입니다. 이후 c3ed50a에서 Auth 오류 코드 호환성을 보완하고 배포·
자기 점검11개를 확인했습니다. 이 후속 보완은 심판 재제출과 구분합니다.

최신 공개 data.json에는 notes가 0건입니다. 과거 공개 GitHub 커밋과 Vercel
배포에는 가상 자료가 남을 수 있으며 최신 파일을 비웠다고 과거 노출이 회수되지는 않습니다.
실제 학생 자료나 개인정보는 입력하지 않습니다.

## 4단계 학습용 소유자 배정 SQL

`sql/stage4-owners.sql`은 A/B의 이메일로 auth.users에서 ID를 찾고, 기존의
소유자 없는 가상 메모 4건을 A 3건·B 1건으로 배정하는 제안 SQL입니다.
두 계정이 없거나 대상이 정확히 4건이 아니면 변경 없이 실패합니다. 실제
이메일은 SQL Editor에 직접 입력하고 Git에 저장하지 않습니다. 현재 실제
계정은 1개이므로 이 배정 SQL은 실행하지 않았습니다. 기존 자료는 보존했습니다.

서버는 service_role로 DB를 조회하므로 RLS를 우회합니다. 따라서 서버의
소유자 조건은 계속 유지합니다. 4단계 RLS 정책도 보존하지만 5단계에는
클라이언트 테이블 권한 자체를 회수하므로 로그인했어도 직접 DB 자료 접근은 불가능합니다.
실제 B 계정의 로그인·직접 Data API 검사는 미실행입니다. 운영 심판의 A/B
시험 신원과 DB 트랜잭션의 가상 신원 검증을 일반 B 계정 로그인으로 보고하지 않습니다.

## 보너스 XDR-01 · 무차별 로그인

제공된 가상 Wazuh 경보는 `npm run xdr:run -- brute-force`로 분석한다.
판단 원본은 `xdr/brute-force/analyze.mjs`이며, 변경 후 `npm run xdr:build`로
외부 import·파일 접근이 없는 `decide.mjs`를 생성해 함께 커밋한다.
알림·규칙 파일 저장은 판단이 끝난 뒤 실행기가 `respond.mjs`를 별도로 호출한다.
Node·파일·네트워크·브라우저 보조 기능이 없는 격리 환경 동등성은 `node --experimental-vm-modules --test test/xdr-portable.test.mjs`로 확인한다.
원본 경보를 보존하며 시각·출발 주소·가명 계정·수준·설명만 추출한다.
원본과 추출 입력 모두 같은 판정을 내며 비밀값은 제거한다.
MITRE T1110·T1110.001·T1110.003 근거와 연습의 수치 기준은 patterns.json에 있다.
같은 주소·계정120초 창의 반복 실패와 여러 계정 대입을 분석한다.
명확한 공격과 정상은 규칙으로, 애매한 경보는 Jev로 판단한다.
0.85 이상 block,0.5 이상 alert,나머지 record이며 Jev 실패는 alert이다.
원본 fixture 재생은 네트워크 없는 경로로 block10·alert9·record9, 정상 차단0건이다.

### 실제 자료실 서버 연결

`api/auth.js`의 실제 비밀번호 실패→`live.mjs`→서버 전용 Supabase 상태→
`createXdrGuard`→로그인·메모 API 거부로 연결했다. 같은 출발 주소에서120초 안에
20건 이상 실패하면 명확한 공격으로 보고15분 차단 후보를 만든다.
그 아래 애매한 실패는 Jev가 판단하며, 응답 없음·오류·시간 초과는 알림으로 남긴다.
차단 대상의 인증 요청은429, 인증된 메모 요청은403으로 거부하며 Retry-After를 준다.
만료 후 기존 인증·소유자 검사로 복귀한다. 로그아웃은 허용한다.

Supabase SQL Editor에서 `sql/xdr-brute-force.sql`을 적용한다.
`xdr_sources`·`xdr_alerts`와 RPC는 서버 service_role만 접근할 수 있다.
실제 IP·이메일은 서버 키로 HMAC 처리하고 비밀번호·토큰·원본 로그를 저장하지 않는다.
이미 설정한 서버 환경 SUPABASE_URL·SUPABASE_SECRET_KEY·TYPESAFE_API_KEY를 사용한다.
Vercel이 덮어쓴 출발 주소 헤더만 믿으며 다른 호스팅에서는 신뢰 어댑터를 별도로 구성한다.
기존 자료실의 로그인·경로·소유자 검사, src/verify-login.mjs, judgeIssuer,
6단계 전의 src/decider.mjs 기본 거부 규칙을 보존했다.

실제 Jev 연결은 [TypeSafe 공식 API](https://docs.typesafe.ai/api)의
POST /v1/systemone·jev-latest·Noul 응답이다. IP·계정·설명은 전송하지 않고
수치·불리언만 전송한다. 실제 서버 실패 판단은 키가 있을 때 Jev를 호출한다.
오프라인 fixture 명령은 네트워크를 사용하지 않는다.
서버 환경에서 fixture 자체의 실호출을 확인하려면
`XDR_JEV_LIVE=1 npm run xdr:run -- brute-force` 또는 `npm run xdr:verify-live`를 쓴다.
키는 명령문·파일·채팅에 넣지 않는다. XDR_VERIFY_JEV=1을 켠 Vercel 빌드에서도
실호출을 확인할 수 있으나 반복 검증을 막기 위해 평소0으로 둔다.
2026-10-07 배포8295b3b에서 실제 요청9·응답9, block10·alert1·record17을 확인했다.
실제 모델 값은 오프라인 대체 경로의10/9/9와 구분한다.

### 저장과 검증

로컬 fixture 후보는 rule-store.mjs가 deny-rules.json에 중복 없이 추가한다.
0600 원자적 저장·재시작 유지·15분 이내 TTL 검증을 적용한다.
파일·alerts.log·verification.json은 Git에서 제외한다. result.json은 가상 판정만 커밋한다.
실제 자료실 운영 후보·경보는 Supabase에 영속 저장한다.
실제 서버 이벤트는 UUID·시각·행동·확신도·정해진 패턴 이름만 기록한다.

`node --test test/xdr-live.test.mjs test/brute-force.test.mjs test/stage3.test.mjs test/stage5.test.mjs test/xdr-run.test.mjs`
으로 실패 합산·추가 거부·만료 복귀·저장 장애·토큰·소유자 검사 보존을 확인한다.
세부 설치·경계는 [서버 연결 문서](docs/XDR_OPERATOR_CONNECTION.md)를 따른다.
이 연결은 자료실 HTTP 서버의 접근 통제다. 운영 반 엔진·실시간 Wazuh 수집기·PC 방화벽
설치 완료로 보고하지 않는다. 미래 운영 엔진 어댑터 src/xdr-decider.mjs는 별도로 남겨 둔다.
당시 XDR-01 범위에는 웹 입력 조작과 다른 XDR 모듈을 포함하지 않았다.

2026-10-07 배포2a42586에서 존재하지 않는 가상 계정의 실제 실패 요청20건 뒤21번째 요청429,
위조 출발 주소 헤더 변경 뒤에도 같은 근거로429, DB의실패20·경보20·TTL900초를 확인했다.
기존 로그인 계정의 메모 조회는 공격 전 정상·차단 중 거부·시험 규칙 만료 후 복귀했다.
복귀 시험은 에이전트가 만든 근거UUID 한 건의 만료를 앞당기고 이미 지난 실패 창을
초기화한 것이다. 실제로15분 기다렸다고 보고하지 않는다. DB 트랜잭션과 경계값 시험에서
15분 TTL 및 정확한 만료 시각의 비적용을 별도로 확인했다. 기존 계정·메모는 변경하지 않았다.

제출 전 같은 fixture 명령으로 결과를 갱신하고 「보너스 xdr-01 저장점」으로 커밋한다.
구현·DB 설정·실제 배포 검증이 모두 끝난 뒤 보너스 작전→무차별 로그인→과제 보기에서
배포 주소와 공개 GitHub 주소를 제출한다. 심판은 저장소의 decide를 다시 실행한다.

## 보너스 XDR-02 · 웹 입력 조작

SQL 구문 결합·스크립트 삽입·경로 이탈·명령 구분자 신호가 같은 주소에서
120초 안에8번 이상 반복되면15분 거부 후보로 추가한다. 이 수치는 구현 정책이다.
단어 select/script/up 또는 따옴표만으로 차단하지 않는다. 애매한 경보만 실제
Jev에 수치·불리언 요약으로 묻는다. 반복 근거가 없는 높은 AI 점수는.84 상한으로
알림에 남긴다. 오류·시간 초과·미설정은.5 알림이며 실제 응답과 구분한다.

`sql/xdr-web-injection.sql`을 같은 Supabase 프로젝트에 적용한다. 새 xdr_web_sources/
xdr_web_alerts/RPC는 service_role 전용이고 기존 notes/Auth/XDR-01을 바꾸지 않는다.
`xdr/live.mjs`가 기존 무차별 로그인 guard와 웹 입력 guard를 합성한다.
Auth 프록시는 요청 인자만 검사하며 비밀번호/JWT/Auth 본문을 검사하지 않는다.
로그인한 메모 요청에서는 인자·title/body의 문법 신호만 메모리에서 확인하고,
본문·URL·계정·IP를 로그/DB/AI에 보내지 않는다. 운영 출발 주소는 Vercel의
신뢰된 헤더만 쓰고 서버 키로 HMAC 처리해 저장한다. 출발 주소별 차단은 공유
네트워크의 다른 사용자도 영향을 받을 수 있어 반복 근거와15분 만료로 제한한다.
로그아웃은 계속 허용하며 인증/소유자 검사와 직접DB 권한 회수를 보존한다.
추가 query 값은 기존 Auth의 고정 경로로 전달하지 않는다.

재생: `npm run xdr:run -- web-injection` → 가상 fixture26건의 result.json,
오프라인 block8·alert9·record9. 읽기 read-alerts는 원본/추출5필드를 동일하게
처리한다. analyze가 판단 원본, `npm run xdr:build`가 외부import 없는 decide를
만든다. respond는 alerts.log/만료·경보ID 후보를 저장하고 추가guard 재생의
정상차단0을 기록한다. src/xdr-decider는 기존starter.deny를 보존한 연결 어댑터다.

시험: `node --experimental-vm-modules --test test/web-injection.test.mjs test/xdr-portable.test.mjs test/xdr-live.test.mjs test/brute-force.test.mjs test/stage3.test.mjs test/stage5.test.mjs test/xdr-run.test.mjs`.
빈 VM과 원본/추출의 동등성, 이름/순서 암기 부재, 만료/중복/정상/오류 및
기존 규칙·인증·소유자 검사를 확인한다. 정책은 [영구 RULE](docs/XDR_WEB_INJECTION_RULES.md).
[MITRE T1190](https://attack.mitre.org/techniques/T1190/)의 공개 앱 악용 범주를
이용한 학습 감지기이며 모든 취약점/인코딩/웹 공격을 탐지하는 완전한 WAF는 아니다.
이 감지기는 실행이나 쿼리 결합을 하지 않는다. 기존DB 쿼리는 SDK로 값/필터를
전달하고 화면은 textContent로 메모를 출력한다.

2026-10-07 배포87b5c17에서 실제 정상 입력5종은 기존400 입력 검사로 처리되어
추가 차단이 없었다. 같은 출발 주소의 주입 요청8번째는429·Retry-After900초로
거부됐고 이후 위조 출발 헤더도 같은 경보UUID로 거부됐다. 서버DB의 반복8·
TTL900·근거1 및 실제 Jev 응답7건(block1·alert6·record1)을 확인했다.
기존 로그인 A의 목록 요청도 차단 안내를 표시했다. 자신의 시험 경보UUID 한 건만
만료를 앞당기고 지난 집계 창을 초기화한 뒤 Auth 요청의 기존400 처리가 복귀했다.
15분 실제 대기 시험으로 보고하지 않는다. DB/경계 시험에서900초 설정 및
정확한 만료 시각의 비적용을 확인했다. 계정·메모·XDR-01 상태는 변경하지 않았다.
로컬30개 시험과 정적빌드가 통과했다. 실제 모델 결과는 가상fixture8/9/9와 구분한다.

## 10단계: 사전 검증 사본에서 정책과 한 건 복원

정책 사본은 `backups/stage9-safe-policy/`의9단계100점 소스입니다. `manifest.json`의 버전·출처 커밋·각 파일 SHA-256을 다시 읽고 `src/recovery-policy.mjs`에 고정한 manifest 지문과 대조합니다. 사본이 없거나 달라지면 실패하며 복원하지 않습니다. 정책 파일에는 자료 본문이나 비밀값이 없습니다.

시험 정책 절차는 운영 파일을 쓰지 않고 `.local/stage10-policy/`만 대상으로 합니다.

1. `node scripts/test-policy.mjs init`으로격리 사본을 준비합니다.
2. `node scripts/test-policy.mjs preview`로복원 버전·변경 파일·전후 지문과 확인값을봅니다.
3. 확인한 변경에한해 `node scripts/test-policy.mjs apply <확인값>`을실행합니다. 미리보기뒤시험정책이달라지면적용하지않습니다.
4. 변경 파일만복원하고 다른 서비스 파일과기존감사기록을보존합니다. 복원 기록은추가합니다.

메모 복원 서비스는 `notes`, 경로는 **POST `/api/restore/:noteId`**입니다. `aleph.config.json.restoreRoute`에같은경로를기록합니다. 원본 로그인검증후 저장된백업 소유자가같은한건만복원합니다. 본문은비우거나같은ID만되풀이할수있으며 owner·role·본문·정책버전선택은받지않습니다. 무로그인401,타인/사본없음404,잘못된검증/소유충돌409입니다.

`sql/stage10-recovery.sql`은비공개 `aleph_recovery` 스키마에사본과추가형감사기록을둡니다. 기존소유메모와새메모의최초사본을한번보관하며 변경·삭제가사본을덮어쓰지않습니다. 기존메모/소유자없는가상자료는수정하지않습니다. anon/authenticated의사본·RPC직접접근을차단하고서버만좁은복원RPC를호출합니다. 복원은ID·저장소유자·본문SHA-256·정책사본지문·전체사본지문을대조하고한트랜잭션에서대상한건만반영·재검증·감사추가합니다. 삭제된메모ID를다른소유자가차지할수없게보호합니다.

검증 순서:정책사본preview/시험정책복원→비공개DB권한/롤백전용B가상메모검사→서버전용시험환경에서 `node scripts/stage10-live-check.mjs`의새B메모변조·삭제복원→`node --experimental-vm-modules --test test/stage3.test.mjs test/stage5.test.mjs test/stages7-12.test.mjs test/stage8-route-declarations.test.mjs test/stage9.test.mjs test/stage10.test.mjs`→실제배포자기점검/bundle→심판의1~9대표공격재검사입니다. 가상·DB트랜잭션·실제로그인·심판증거를구분하고 미실행결과를꾸미지않습니다.

정책시험에서변경파일1개만복원/운영정책해시불변/기존감사앞부분보존을확인했습니다. 실제DB트랜잭션에서는B가상메모변조/삭제복원,타인거부,NULL정책지문거부,ID재사용거부,변조사본거부,다른메모/감사보존을확인하고모두롤백했습니다. 전체권한검사와시험감사롤백도true였습니다. 실제Auth A/B의배포HTTP17조건이6fd4c57에서모두통과했습니다. B변조/삭제메모복원200,ID/내용지문일치,타인읽기/복원404,위조/기능쿼리400,브라우저RPC403,다른메모·감사보존을확인했습니다. 새시험2계정과활성2메모는정리했고비공개사본/감사는보존했습니다. 일회성빌드검증설정0복원과자동실행코드제거후제출합니다. 최종초기 심판은 UNV_RUN_ENVIRONMENT로 판정을 끝내지 못했으나, 최종 cadd46d 동일 코드 재심사에서 실제100점을 확인했습니다. 이전 내부 오류 원인은 공개되지 않았습니다.

검증 근거:[PostgreSQL SHA-256 함수](https://www.postgresql.org/docs/17/pgcrypto.html),[SECURITY DEFINER와안전한검색경로](https://www.postgresql.org/docs/17/sql-createfunction.html).


### 복구 뒤 1~9단계 정상·금지 재시험

`scripts/stage10-live-check.mjs`는 실제 B 메모의 변조 복원과 삭제 복원을 마친 **뒤**, 시험 계정 정리 **전**에 아래 순서로 재시험합니다. 결과는 `postRestoreRetests`에 실행 방식(`live_http` / `local_synthetic`)과 상태를 구분하여 남깁니다. 이전 단계의 점수를 이번 재시험 결과로 대신하지 않습니다.

| 순서/단계 | 정상·보존 확인 | 금지 요청 확인 | 실행 방식 |
|---|---|---|---|
| 1~2 공개 자료 제거 | 배포 신원200, 공개 data.json 메모0, 헤더/공개5파일 검사 | 공개 파일 키·시드 본문 없음 | 실제 배포 HTTP |
| 3 로그인 | A 본인 목록200, B 복원 메모200 | 무로그인 CRUD와 무효 토큰401 | 실제 Auth A/B 및 HTTP |
| 4 소유자 | B 복원 메모의 ID/내용 해시 유지 | A의 B 메모 읽기·수정·삭제404, 복원404 | 실제 Auth A/B 및 HTTP |
| 5 서버 경유 | 서버 자료 경로와 메타데이터 일치 | anon 직접DB401, Auth 자료경로 우회404, authenticated 복원RPC403 | 실제 HTTP |
| 6 등록 기기 | 등록 기기 가상 요청allow | 미등록·누락 기기deny | 계약의 로컬 가상 판정 |
| 7 추가 확인 | 확인한 복합 이상 요청allow | 미확인 복합 이상 요청step_up | 계약의 로컬 가상 판정 |
| 8 자료 구역 | 선언된 단일 메모 경로/본인 목록 입장, API 본인 조회200 | 전체목록·공지쓰기·기능/미지경로deny, 비로그인 공지401, 타인 API404 | 로컬 가상 판정 + 실제 HTTP |
| 9 접속 회수 제안 | 정상120건/사용자 분리/창밖 사건observe | 동일 가명 주체121건propose_revocation | 계약의 로컬 가상 사건 |

6~9의 제공 엔진 기기 등록·추가 확인·실제 접속 회수는 이 서버 시험에서 **미실행**입니다. 가상 판정 통과를 운영 집행으로 보고하지 않습니다. 심판의 복원 뒤 대표 공격 실행 결과는 별도 판정에서 확인합니다. 정책 복원 시험도 실제 운영 정책을 변경하지 않습니다.

복원 뒤 재시험 실행 결과: 2026-10-13 UTC 2026-10-13T11:25:42.769Z의 [실측 기록](docs/STAGE10_VERIFICATION.json)에서 복원17조건과 복원 직후 재시험26조건이 전부 통과했습니다. testedCommit `f2ee0079077ba5b3159d8f29f973fc7cc20b848e`, 검증 도구 빌드 `47a5159a785570f66959ad81def5d538ec5879b1`입니다. 정상 A 목록200·B 복원 메모200, 타인 PUT/DELETE404 및 자료불변, 공개 메모0, 무로그인/위조/직접DB 거부를 복원 뒤 다시 실행했습니다. 6~9는 표에 명시한 로컬 가상 판정이며 제공 엔진 집행과 구분합니다.

## 11단계: 설치형 접속 화면과 서버 기기 확인

`public/index.html`은 기존 자료실에 설치·오프라인 안내 및 승인 상태를 더합니다. `manifest.webmanifest`의 시작 주소는 기존 `/`이며 별도 프로그램은 설치하지 않습니다. 로그인과 승인 전에는 기존 메모 화면을 숨기고 보호 자료를 요청하지 않습니다. 승인 버튼은 요청만 보내며 서버 응답과 서명된 상태 재확인 후에 화면을 엽니다.

이 구현의 승인 정책은 **로그인한 사용자의 열린 화면 세션 키 소유 확인**입니다. 운영자 수동 승인이나 하드웨어 기기 인증으로 표시하지 않습니다. `api/device.js`는 원본 로그인 검증을 거쳐 등록 요청에 2분짜리 일회성 도전을 발급하고, 이 화면의 키로 서명한 증명과 로그인 지문을 확인하여 최대1시간의 서버 등록 상태를 만듭니다. 브라우저 직접 DB 승인 변경은 권한으로 막습니다. 새로고침·다시 열기·토큰 갱신·오프라인 뒤에는 다시 승인해야 합니다.

`public/device-client.mjs`는 WebCrypto의 내보낼 수 없는 P-256 개인키를 열린 화면 메모리에만 둡니다. SDK의 `persistSession:false`로 토큰 영속화를 끄고 이전 SDK 세션 항목은 읽지 않고 제거합니다. localStorage/sessionStorage/IndexedDB/CacheStorage에는 개인키·토큰·메모를 저장하지 않습니다. `sw.js`가 캐시하는 것은 공개 `offline.html` 한 장뿐이며 보호 API 응답은 저장하지 않습니다.

`src/device-session.mjs`는 서버에 저장한 사용자·로그인 지문·등록 공개키·만료 상태를 대조하고 메서드·기존 Vercel 재작성 규칙과 동일하게 정규화한 자원 경로/쿼리·JSON 본문 지문·일회성 nonce·시각(30초)을 검증합니다. `notes`·본인목록·공지·복원 API의 실제 공통 경로에 연결하여 서명 없는 일반 사용자 요청, 경로/본문/메서드 변경 및 재전송을 자료 조회 전에403으로 거부합니다. 로그아웃은 서버 승인을 회수하고 화면의 키와 자료를 비웁니다. 개인키나 토큰 원문은 서버 DB/로그에 남기지 않습니다.

제공 엔진의18필드 판정과 원본 심판 로그인 검증기는 변경하지 않습니다. 운영자가 서명하고 원본 검증기가 엄격히 확인하는 시험 신원은 기존 제공 엔진의 기기·요청서명 검증 통로를 유지합니다. 일반 Supabase 사용자에 적용하는 위 세션 키 흐름을 엔진의 하드웨어 인증이나 운영자 승인으로 과장하지 않습니다.

적용: `sql/stage11-device.sql` → 정상 배포 → 서버 전용 환경에서 `node --experimental-vm-modules scripts/stage11-live-check.mjs` → 관련 시험 → 배포 일치/bundle/심판. 실제 DB에서 anon 조회·authenticated 승인변경 거부와 서버 확인 권한을 확인했습니다. 로컬 보안25시험이 통과했습니다. 실제 접속 클라이언트 코드와 WebCrypto를 통해 배포된 서버의24조건이5532582에서전부통과했습니다. 정상A/B승인·목록·메모추가/읽기/수정/복원·공지읽기,서명누락/경로·본문·메서드변경/재전송/타인키/만료/직접DB거부와회수를확인했습니다. 기존20점검도통과했고새시험계정2/메모1/기기세션정리cleanupOk true입니다. [실측 기록](docs/STAGE11_VERIFICATION.json)에시각/커밋/방식을구분했습니다. 이는 실제클라이언트프로토콜실행이며 수동브라우저로그인이라고기록하지않습니다. 실제화면에서는승인전자료미표시/오프라인안내를확인했습니다. 초기 심판은 UNV_RUN_ENVIRONMENT로 판정을 끝내지 못했으나, 최종 cadd46d 동일 코드 재심사에서 실제100점을 확인했습니다. 이전 내부 오류 원인은 공개되지 않았습니다.

참조: [WebCrypto 키 생성](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/generateKey), [Node.js 서명 검증](https://nodejs.org/api/crypto.html#cryptoverifyalgorithm-data-key-signature-callback), [PWA 캐시 경계](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Caching).

서명 경로는 `public/device-message.mjs`의 `canonicalTarget`을 클라이언트와 서버가 함께 사용합니다. 기존 논리/API 별칭은 같은 최종 자원으로 연결하되, 다른 자원 ID·서비스·기능 쿼리는 같은 대상으로 축약하지 않습니다. Vercel의 기존8개 rewrite와 동등한지 회귀 시험합니다. 본문 없는 GET/DELETE의 Vercel 빈 객체는 빈 본문으로 처리합니다.

11단계 재심사 진단: 동일 커밋의 심판 실행 세 번이 `UNV_RUN_ENVIRONMENT`로 끝났습니다. 이는 통과나 요구사항 불합격 판정이 아니며 상세 원인은 공개되지 않았습니다. 새 사본 설치·묶음 생성과 실제 배포 점검은 별도로 통과했습니다. 공식 공개 [실행 예제](https://github.com/ChoiTimo/byteback-sample-pass/blob/main/src/attack-check.mjs)에 맞춰 `src/attack-check.mjs`의 모든 HTTP 요청을 `alephEvidence.caseId/requestKey`로 해당 점검과 연결했습니다. 이 메타데이터는 심판 실행기의 독립 관측용이며 헤더·URL로 전송하지 않습니다. 로컬 가상 판정에는 실제 HTTP 근거를 꾸며 붙이지 않습니다. 이 연결 누락이 환경 오류의 확정 원인이라는 뜻은 아니며, 수정 후 실제 재심사 결과로 구분합니다.


11단계 호환 가설 검증: 공개 예제와 대조하여 제출 점검을 GET 전용으로 제한한88526ee에서 실제15요청/18항목, 별도 비로그인 쓰기·삭제·복원거부5조건, 별도Node22 묶음 생성이 통과했습니다. 그러나 실제 심판은 같은 `UNV_RUN_ENVIRONMENT`로 확인을 끝내지 못했습니다. 읽기 전용 제한이 해결책이라는 근거가 없으므로 실험 변경을 되돌리고 기존 전체20항목 자기 점검을 복원했습니다. 서버의 인증·소유권·기기서명·복원 통제는 실험 전후 동일합니다. 내부 원인은 미확정이며 실패 명령·종료 사유·비밀값을 제거한 예외 로그가 필요합니다.

## 12단계 작전실 사용·설치·검증

현재 자료실 첫 화면 아래의 **탈환 작전실**은 `/api/checks`가 반환한 가린 서버 시험 기록을 표시합니다. 판정 규칙 수, 탐지 시험, 회수 뒤 거부, 복구 API 결과와 안전 정책 버전·해시를 읽습니다. 메모 본문·계정·실제 자원 UUID·토큰·기기 개인키는 이 API와 표에 넣지 않습니다. 공개되는 것은 고정 가상 입력의 결과와 시험용 계정으로 얻은 안전한 영수증뿐입니다. 이 화면은 권한을 부여하거나 현재 운영 사용자의 현황을 추정하지 않습니다.

| 구성 | 파일·진입점 | 역할 |
|---|---|---|
| 판정 | `src/decider.mjs`의 `decide`, `RULE_IDS` | 제공 엔진의 18필드 입력 → 5필드 판정. 기기·추가 확인·정확한 구역 입장 검사 |
| 탐지 | `src/detect.mjs`의 `detect` | 동일 가명 주체 GET 10분 120/121 경계 → 회수 **제안** |
| 자료 API | `api/notes.js`, `api/my/notes.js`, `api/announcements.js` | 원본 로그인 검증·기기 서명·XDR·저장 소유자/편집 권한 확인 |
| 접속 앱 | `public/device-client.mjs`, `public/device-message.mjs`, `public/app.js` | 메모리 키 소유 증명·요청 서명·승인/로그아웃. `api/device.js`가 서버 상태 확인 |
| 복구 | `api/restore.js`, `src/recovery-policy.mjs` | 비공개 사본의 지정 메모 복원과 고정 정책 해시 확인 |
| 기록 API | `api/checks.js`, `src/operations.mjs` | GET만 허용. 임의 입력 없이 지정된 가상 시험과 가린 영수증 반환. DB 권한 없음 |
| 작전실 표시 | `public/operations.mjs`의 `renderReport` | 실제 API 행·요약을 `textContent`로 표시, 실패/미실행 유지 |
| 검사 절차 | `scripts/stage11-live-check.mjs`, `src/stage12-check.mjs` | 실제 A/B 프로토콜 + 정상/금지 HTTP 검사. 단계·기대·실제·서버 요청ID·UTC 시각 수집 |
| 보존 기록 | `config/operations-verification.json` | 검사 커밋·시각·안전한 요청 영수증·실행 범위. 서버가 읽는 원본 |

**출처와 범위:** 학생이 만든 것은 판정기·탐지 규칙·XDR·접속 앱·자료 API·복구·작전실입니다. 가명 사건 전달, 학생 판정 호출/집행, 탐지 제안에 따른 엔진 회수는 **ALEPH SDP 엔진**이 제공합니다. 일반 Vercel 자료 API의 JWT/기기/소유자 검사와 제공 엔진의 판정·회수는 다른 실행 범위입니다. 고정 가상 입력을 HTTP로 실행한 결과는 `synthetic_input_over_http`, 실제 로그인·키·자료 요청은 `live_api_protocol`로 구분합니다. 대표 회귀시험 수를 41종 총공세 통과 수로 바꾸지 않습니다. 자체 41종 전체 실행은 미실행이며 전체 통과 근거는 운영 심판에서 따로 확인합니다. [원본 시작 틀](https://github.com/ChoiTimo/aleph-defense-starter), [공식 공개 점검 표본](https://github.com/ChoiTimo/byteback-sample-pass/pull/1)의 실제 HTTP 관측 방식만 참고했고, 표본의 항상 거부 API를 운영 구현으로 복사하지 않았습니다.

설치·실행 순서:

1. 검사 기록의 `testedCommit`으로 저장소를 받고 Node22 이상에서 `npm install`을 실행합니다. 비밀값 없는 새 사본에서도 설치와 `node --experimental-vm-modules --test test/stage12.test.mjs test/stage11.test.mjs test/stages7-12.test.mjs`가 실행됩니다. 전체 시험 중 `package-starter.test.mjs`의 초기 API 목록 항목은 원본 두 개의 패키지용 함수만 기대하는 오래된 기준으로 별도 실패합니다. 보안 회귀의 성공과 최종 제품 패키징의 미완료를 구분합니다.
2. 기존 설치의 DB·Vercel 환경을 보존합니다. 새 설치는 위 설치 절의 단계3~5 SQL과 `sql/stage8-resources.sql`, `sql/xdr-brute-force.sql`, `sql/xdr-web-injection.sql`, `sql/stage10-recovery.sql`, `sql/stage11-device.sql`을 각 안내의 순서와 조건에 맞춰 적용합니다. 기존 정책·사용자 자료를 덮어쓰는 seed는 실행하지 않습니다. 서버 변수 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TYPESAFE_API_KEY`는 공식 서버 설정에만 보관합니다. 판정 엔진은 ALEPH 제공 엔진을 사용하고 임의 CA나 별도 접속 프로그램을 설치하지 않습니다.
3. Vercel에서 이 저장소를 배포하면 `npm run build`가 기존 접속 앱과 작전실을 준비합니다. `/aleph.json`의 커밋/단계12/저장소를 실제 저장점과 대조합니다. 일반 빌드는 시험 계정 생성·복구를 실행하지 않습니다. 작전실의 새로고침은 가린 기록 읽기만 수행합니다.
4. 새 실제 영수증을 생성할 때에만 서버 전용 시험 환경에서 `node --experimental-vm-modules scripts/stage11-live-check.mjs`를 실행합니다. 배포가 같은 커밋인지 먼저 확인하고 새 A/B 시험 계정으로 승인·허용·타인 거부·복구·서명 변조·회수 후 거부를 재생합니다. `public/stage12-live-proof.json`은 Git 제외 결과이며 실측이 모두 통과하고 `receiptsComplete`, `stageCoverage`, `cleanupOk`가 true인지 확인합니다. 개인 토큰/계정/본문을 파일로 추출하지 않습니다. 시험 계정·메모·기기 세션만 정리하며 비공개 복구 사본/감사 이력은 보존합니다.
5. 성공 결과의 `records`, `testedCommit`, `at`, `sourceHashes`만 가린 기록 파일에 옮깁니다. 소스 해시로 기록 후 문서/영수증 커밋과 시험한 앱 코드의 일치를 대조합니다. Vercel이 JSON을 압축해 읽는 vercel.json은 JSON.stringify(parsedConfig)+개행의 해시 및 검사 커밋의 Git 원문 일치를 함께 확인합니다. 1~11단계마다 정상/금지 행, 기대/실제, 요청ID와시각이 모두 있어야 합니다. `/api/checks`의 표와 실제 화면 표를 대조하고 검사 자체 실패·미실행은 그대로 표시합니다.
6. `bundle-notes.json`에 비밀값 없는 변경 설명을 적고, 저장점 커밋 뒤 `npm run bundle`을 실행합니다. 최종 제출의19개 독립 GET 관측은 실제 응답 상태와 `ready`를 기록하고 네트워크 미실행/예상 밖 결과에 중단합니다. POST 복원 점검1건은 격리환경 계약에 따라 `observed: not_run`으로 남깁니다. 쓰기 정상/금지 실측은 별도 서버47조건의45행에 보존합니다. `alephEvidence`는 runner 관측 메타데이터이고 HTTP 헤더나 URL로 보내지 않습니다. 최종 배포 커밋 일치 후 포털에 제출하고 실제 점수를 확인합니다.

중지·복구:

- 접속 앱은 **로그아웃**으로 서버 기기 세션을 회수하고 메모리 키/토큰을 비웁니다. 오프라인에서는 자료 표시를 비우며 새로 열면 다시 로그인·승인합니다. 설치 제거는 OS/브라우저의 앱 제거 기능을 사용합니다.
- 제공 엔진의 실행·중지는 운영자가 제공한 엔진 관리 절차를 따릅니다. 학생 판정/탐지 파일은 엔진에 제공하는 모듈이며 임의의 `npm start` 데몬이 아닙니다. 로컬 시험 프로세스는 종료하면 멈춥니다. Vercel 배포를 중지하려면 프로젝트의 공식 배포 관리에서 직전 검증 배포로 되돌립니다.
- 기록 API 오류 시 미실행/오류로 표시합니다. 성공 문구를 채우거나 판정 규칙을 완화하지 않습니다. `git diff`로 변경 범위를 확인하고 직전 검증 커밋의 해당 파일만 복원한 뒤 시험·배포 신원을 다시 확인합니다. `reset --hard` 및 전체 DB 초기화는 사용하지 않습니다.
- 정책 복원은 `node scripts/test-policy.mjs init` → `preview` → `apply <confirmation>`의 기존 격리 시험 정책 미리보기·확인값 적용 절차를 사용합니다. 지정 메모 복원은 로그인·승인된 서명 `POST /api/restore/:noteId`로만 요청합니다. 다른 메모와 감사 이력은 보존합니다. 자세한 안전 사본 검증은 위 10단계 절을 따릅니다.

12단계 실제 기록: `27e6474bed35c53b70e02bc52bec816659b36f7d`에서47조건과20HTTP자기점검이 모두 통과했습니다. 표의45행은1~11단계 정상·금지 양쪽을 포함하며 서버 요청ID/시각이 모두 있습니다. [실측 기록](docs/STAGE12_VERIFICATION.json)의 `receiptsComplete`, `stageCoverage`, `cleanupOk`, `deploymentUnchanged`는 모두true입니다. 공개 기록에는 메모·계정·자원ID를 제외했고,20개 앱/서버/판정/탐지/설정 파일의 SHA-256으로 후속 기록 커밋과 시험 소스가 일치하는지 확인합니다. 서버 시험 자동 실행 훅은 제거하고 검증 플래그를0으로 되돌립니다. Vercel JSON 압축 표현은 정규화해 일치시키고 Git 원문도 같은 것으로 확인했습니다. 실제 접속 클라이언트/WebCrypto/배포 HTTP 프로토콜 검증이며 수동 로그인 화면 전체 시험과 구분합니다. 작전실의 실제 브라우저 표시와 서버45행 대조는 별도 수행합니다.

12단계 격리 실행 제약(실제 S12_BUNDLE_UNSUPPORTED 안내): 제출 경로는 node:fs/path/url, child_process의 Git 읽기, crypto의 randomUUID/SHA-256만 사용합니다. node:fs/promises는 이 경로에서 제거했습니다. 요청은 공개HTTPS GET/HEAD만 보내고 POST복원 항목은 not_run입니다. `node --experimental-vm-modules --test test/stage12-sandbox.test.mjs`가 깨끗한 Git 상태에서 제한된 모듈/명령과 실제 GET을 검사하고 새 묶음을 메모리에 확인합니다. 이는 공개된 능력 제한의 재현이며 비공개 심판 구현을 복제했다고 주장하지 않습니다.

제출용 Git 호출은 `git status/rev-parse/config/remote/diff-tree/show`의 읽기만 사용하며 작업 폴더는 `cwd`로 지정합니다. 첫 인수가 실제 읽기 명령이 되게 해 `-C`를 명령으로 오인하는 검사기와의 호환 범위를 줄였습니다. 이는 명령 구문 호환 수정이며 실제 심판 내부의 원인을 확정하는 설명은 아닙니다. 원본 origin/커밋/깨끗한 상태/기록 검사는 보존합니다.

12단계 영수증 완결성 검사는 깨끗한 Git 상태를 확인한 뒤 허용된 fs에서 고정 기록 파일을 읽습니다. 공식 공개 표본의 여섯 Git 읽기(상태/HEAD/origin원문/origin실효값/변경파일/단계설정) 밖에 새 `git show` 호출을 추가하지 않습니다. 영수증의 실제 성공·정상/금지·요청ID·시각 검사 자체는 유지합니다.

실제742c5fe 심판에서 나머지3조건을 확인하고 묶음 실행의 `path_format` 한 조건이 남았습니다(45점). 문자열 파일 경로만 받는 환경에서 동일 오류를 재현해 제출 checker의 fs 읽기를 URL객체에서 `join(root, ...)` 문자열로 바꿨습니다. 기존화면/API/45영수증과 접근통제는 유지합니다. 고정 가상입력HTTP를 포함한47조건을 모두 운영사용자 요청으로 표현하지 않습니다.

3eefd1f의 실제 묶음 실행은 다음 URL 변경 `.set` 오류로 진행했습니다. 검색 조건 변경 API가 없는 읽기 URL 환경에서 같은 첫 오류를 재현하고, 12단계 checker는 검증한 쿼리 없는 HTTPS 주소에 고정 `?select=id`를 붙이도록 바꿨습니다. 제공되지 않은 URL 기능을 재현 시험에 주입하지 않습니다.

## XDR-03 알려진 취약점
`npm run xdr:run -- known-cve`는 원본24건을 독립 `xdr/known-cve/decide.mjs`로 판단해 result.json을 생성한다. 완전한 원격 JNDI 조회는 block, 불완전한 점검 흔적은 alert, 정상은 record. CVE 이름·심각도만으로 차단하지 않는다. 패턴 근거는 NVD CVE-2021-44228과 MITRE T1190이며 patterns.json에 출처를 보존했다.

`read-alerts.mjs`는 비밀값을 제거한5필드 확인용이다. 요청 원문은 추출하지 않으므로, 원본에만 완전한 조회 구문이 있고 설명은 CVE 이름뿐인 경우 원본block/추출alert가 된다. 잃은 근거를 가짜로 복원하지 않는다. 실제 심판 입력은 원본Wazuh이며 판단기는 파일/네트워크/import 없이 실행한다.

`respond.mjs`는 block만 서버전용 deny-rules.json에 근거경보ID와15분 만료로 저장하고 alert만 xdr/alerts.log에 중복 없이 남긴다. `src/xdr-decider.mjs`의 기존 연결 진입점은 이 추가규칙도 읽는다. 신뢰된 서버 출발주소만 조회하고 기존 src/decider.mjs의 deny/step_up을 유지한다. 실행기는 실제 기본판정기+추가guard를 공용18필드 가상요청으로 재생해 verification.json을 남긴다. 현재24건은8/8/8, 정상차단0이다.

검증: `node --experimental-vm-modules --test test/known-cve.test.mjs`. 이 과제는 오프라인Wazuh 경보부품이며 새Jev/API/PC프로그램/실시간수집기를 설치하지 않는다. 가상경보를 운영DB에 올리지 않는다. 운영반엔진·PC방화벽 설치 증거와 혼동하지 않는다. 기존Vercel자료실/실제HTTP두XDR은 보존한다. 영구제약은 docs/XDR_REMAINING_RULES.md.

## XDR-04 몰래 심은 프로그램
`npm run xdr:run -- persistence`: 원본24건을 import 없는 독립판단기로 처리한다(차단8/알림8/기록8). 패턴 근거는 MITRE T1543/T1053. 새 서비스·예약·시작 항목의 변경과 서명부재·임시실행·평소목록미등록을 함께 확인한다. 서명미확인/임시파일한개/설명변경만으로 차단하지 않는다.

`xdr/persistence/read-alerts.mjs`는5필드 확인, `patterns.json`은근거, `decide.mjs`는판단만, `respond.mjs`는비공개규칙/만료15분/경보ID/알림을 담당한다. 기존 `src/xdr-decider.mjs` 연결에서 그 출발주소의PC 접속을 추가거부한다. fixture에 고유기기ID가 없으므로 **경보PC의 관찰된 출발주소 범위**이며 영구하드웨어ID 격리로 주장하지 않는다. 네트워크주소변경/NAT 공유 환경에는 신뢰된 기기매핑이 필요하다. 브라우저주소를 신뢰하거나18필드에임의필드를추가하지 않는다.

`node --experimental-vm-modules --test test/persistence.test.mjs`로 빈VM·원본/5필드·ID/순서변경·오탐0·실제기본판정기추가guard·기존deny/step_up·주소별마지막규칙만료복귀를 검사한다. 실행중인프로그램을제거하는도구가아니며, 실제PC설치/수집기배포와가상경보재생을구분한다.

## XDR-05 권한 가로채기
`npm run xdr:run -- privilege`: 원본26건 차단9/알림8/기록9, 정상차단0. 독립`xdr/privilege/decide.mjs`는 관리자그룹추가/권한전환/명령실행에 낯선접속·직전권한상승·다른계정권한사용·시간밖사용이 결합된 경우만 차단한다. 관리자아닌그룹/취소/실패/단발명령은 알림, 기법코드나 심각도만으로 확정하지 않는다. 패턴 출처 T1068/T1078은 patterns.json에 기록하며 실제취약점악용확정과징후탐지를구분한다.

`read-alerts.mjs`는5필드비밀제거, `respond.mjs`는 해당계정+출발주소 세션의 추가deny를15분간저장하고경보ID/알림을남긴다. `rule-store.mjs`는 privilege에만 가명화계정필드를허용하며, `guard.mjs`는 신뢰된계정과출발주소 모두일치할때만 거부한다. 같은주소의다른계정/다른주소의세션은이규칙으로차단하지않는다. 이는Supabase계정삭제·권한부여가아닌추가접속거부다.

`connectXdrDecider`에 서버측 `getTrustedAccount(requestId)`와 기존 `getTrustedSource(requestId)`를 제공한다. 계정규칙이있는데신뢰된계정조회가없으면명시적오류로실패한다. 경보가명과엔진subjectId의자동동일성을가정하지않고, 브라우저계정값은받지않는다. fixture응답기는현재경보의서버측가명화계정으로실제기본판정기에연결하여재생한다. 운영반엔진에새계정매핑을설치했다는주장은하지않는다. `node --experimental-vm-modules --test test/privilege.test.mjs`로빈VM/원본·5필드/대상계정분리/누락조회실패/TTL/기존거부를검사한다.

## XDR-06 자료 빼돌리기
`npm run xdr:run -- exfiltration`: 원본30건 차단10/알림10/기록10, 정상차단0. `xdr/exfiltration/decide.mjs`는대량자료(수업기준50MB/50파일 또는명시적대량반출)와낯선목적지·5회이상반복·시간밖·이상포트를함께본다. 단일소량/실패/압축생성만은알림이고전송량·심각도만으로차단하지않는다. T1041/T1048은패턴근거이며수치임계값은MITRE표준이라고주장하지않는다.

`respond.mjs`는원본경보의목적지IP를검증해 **destinationAddress** 거부규칙으로15분저장한다. `rule-store.mjs`는목적지규칙에출발주소/계정필드가섞이는것을거부한다. `guard.mjs`는서버측 `getTrustedDestination(requestId)`로확인한목적지만대조하므로출발사용자전체나같은계정의다른목적지를막지않는다. 목적지조회누락은명시적오류이며18필드입력에임의목적지를추가하거나브라우저값을신뢰하지않는다. 실제외부전송/실제유출은시험하지않고문서용주소경보로재생한다.

읽기5필드에는목적지·바이트·파일수가없다. 따라서추출입력에서해당근거가사라지면판단강도를낮춘다. 심판은원본경보를단독decide에주며,read-alerts를import하지않는다. `node --experimental-vm-modules --test test/exfiltration.test.mjs`로빈VM/원본/추출정보손실/바이트경계/목적지분리/누락조회/만료/기존거부를검사한다.

### 여섯 XDR 합성 검증
`node --test test/xdr-six-integration.test.mjs`: 여섯공식경보→각decide→각respond→비공개규칙파일→공유규칙저장→실제기본판정기추가guard의전체로컬경로를검사한다. 차단규칙53개가함께있어도기존deny/step_up은그대로이며새규칙의출발주소/계정세션/목적지대상을구분하고만료후정상복귀한다. 이는가상경보통합검증이며반엔진/PC방화벽배포증거와구분한다. 이전두XDR의실제HTTP보호는기존구현을유지한다.

### 2026-10-14 심사 완료
XDR-03/04/05/06은각각367eee3/be320c1/e3c3ab3/7b2eb26에서실제완성도100/100,조건4·가점3으로통과했다. 작전점수는120/100/100/100이며기존두종과합쳐승인6/6이다. 판정과검증범위는 docs/XDR_REMAINING_VERIFICATION.json. 전체79시험중78통과,기존최종제품API목록시험1실패는별도범위로보존했다. 모든로컬시험이통과했다고주장하지않는다.

## 케셰브 개인 ChatGPT 실행 모드 · 17단계

`personal-ai/`에서 OpenAI 공식 Sign in with ChatGPT로 개인 계정을 연결할 수 있습니다. Mac에서 `cd personal-ai && npm ci && npm start` 후 http://127.0.0.1:5191/ 을 엽니다. 실제 모델 응답·가상 보안 기록 설명·요청 취소와 수동 복구를 확인했습니다. [실행 안내](personal-ai/README.md)와 [17단계 요구사항 대조](personal-ai/STAGE17.md)를 참고하세요. ALEPH 수업용 승인·운영 SDP 사건 연결·공식17 통과와 구분하며 기존 자료실 배포는 변경하지 않습니다.

직원 앱13~21의 실행·구성·장애 대응·지원 범위는 [케셰브 학생 실행 설명서](on-client/docs/STUDENT_RUNBOOK.md)를 봅니다. 기존 배포 자료실, 공식 로컬 앱, Mac 개인 ChatGPT의 실행 경로를 구분합니다.

22단계의 검증 중 버전·새 폴더 재현·단계별 관측·데이터 보존과 복구 범위는 [학생 재현·버전 기록](on-client/docs/STUDENT_RELEASE.md)을 봅니다. 운영 연결·실집행 미확인과 AI 원문 심사를 구분합니다.

마지막 총공세는 [학생 작업 기록](on-client/docs/STUDENT_FINAL_ASSAULT.md)에 일차별 실제 확인과 한계를 남깁니다. 기존22단계 결과를 보존하며 기본 포장·바로가기만 진행하고 setup.exe는 제작하지 않습니다.

## 기존 자료실의 NetBird 접속 경로 (2026-10-26 실검증)
원래 Supabase 자료와 계정을 유지한다. Mac의 기존 케셰브 → 승인된 NetBird TCP 54123 → Windows 게이트웨이 → 기존 Vercel API로 요청한다. Windows의 DPAPI 개인키로 요청마다 서명하며 Vercel은 지정 공개키·30초 유효기간·DB 단회 nonce를 확인한 뒤 원래 JWT·기기 P256 서명·소유자 검사를 수행한다. 공개 사이트에서 자료 API를 직접 호출하는 것은 거부한다. `sql/netbird-gateway.sql`의 서버 전용 nonce 테이블이 선행 조건이다.

Node 24.19.0으로 `node personal-workspace/start.mjs`를 실행하고 케셰브의 **기존 자료실 열기**를 이용한다. 기존 비밀번호 로그인 또는 Supabase 이메일 인증을 사용한다. 암호를 만들거나 이메일 확인을 끄는 우회는 없다. 새 자료실을 만들지 않으며 경로 이름 personal-workspace는 기존 키/감사 저장 위치를 유지하기 위해 보존했다. 공개키만 저장소에 두고, 서버 키·브라우저 기기 개인키·사용자 토큰은 내보내지 않는다.

실제 이메일 로그인·기기 승인·기존 Supabase 메모 저장/조회, 동일 기기 증명의 공개403/NetBird200, 기존 Agent의 권한 회수/기기 철회 원천 효과와 자료 거부/복구, NetBird 정책 차단/복구, 실제 XDR 차단·재시작 유지·15분 만료 후 같은 메모 자동 복구를 확인했다. 실제 사건의 GPT-6-Luna 설명도 확인했다. 검증 범위와 원천별 관측 한계는 [NetBird 통합 안내](on-client/docs/STUDENT_NETBIRD.md)를 따른다. 이 단락은 PC 확장 전 자료실 경로의 검증이며 모든 외부 유출 방지나 새 심판 통과로 확대 해석하지 않는다.

후속 PC 감시 확장은 [Wazuh 연결 안내](pc-security/README.md)를 따른다. 기존 자료실과 Agent 화면에 두 기기의 공식 Wazuh·파일 감시·실제 송신 메타데이터 및 OS 대응 상태를 연결한다. 앞 단락은 PC 확장 이전의 검증 범위이며, 새 실제 검증과 Mac의 표본 관측·신규 연결 차단 한계는 별도 기록한다.
