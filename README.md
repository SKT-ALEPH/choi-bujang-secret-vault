# BYTE BACK 자료실 · 5단계

## 현재 구현

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
   공개 키는 서버 전용 `config/supabase-public.json`에 둡니다. 빌드가 만드는
   `public/auth-config.json`에는 URL만 있으며 키는 없습니다. Secret key는 이 설정에도 넣지 않습니다.
4. Vercel Production에 `SUPABASE_URL`과 `SUPABASE_SECRET_KEY`를 직접 저장합니다.
   실제 키·비밀번호·JWT는 채팅, Git, 로그, 응답, 제출 묶음에 넣지 않습니다.
5. Supabase Auth의 Site URL을 실제 배포 주소로 설정합니다. 이메일 확인을
   비활성화하지 않습니다. 테스트 계정과 비밀번호는 사용자가 공식 화면에서
   직접 설정하고, 가입 확인 메일의 링크를 누릅니다.
6. GitHub main을 배포합니다. 빌드는 `public/`에 공식 SDK UMD 파일을 복사하고
   빈 data.json과 실제 배포 신원 aleph.json을 생성합니다. Vercel은 서버 API도 배포합니다.

## 실제 API 계약

- GET `/api/notes`: 로그인 사용자의 `{id,title,body}` 배열.
- POST `/api/notes`: `{id?,title,body}`. id는 UUID이며 생략하면 서버가 생성합니다.
  201 `{id}` 응답. owner_id는 클라이언트 값 대신 검증된 사용자 ID입니다.
- GET `/api/notes/:id`: 200 `{id,title,body}` 또는 404 JSON 오류.
- PUT `/api/notes/:id`: `{title,body}`로 본인 메모만 수정합니다. owner_id는 바꿀 수 없습니다.
- DELETE `/api/notes/:id`: 본인 메모만 삭제합니다. 삭제 후 같은 주소의 GET은 404입니다.
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

`npm run xdr:run -- brute-force`로 원본을 보존한 채 가상 Wazuh 경보 28건을
분석합니다. `read-alerts.mjs`는 시각·출발 IP·가명 계정·수준·설명만 추출하고
비밀값과 개인정보처럼 보이는 설명을 가립니다. 원본은 실제 PC 로그가 아닙니다.

`patterns.json`은 MITRE ATT&CK T1110·T1110.001·T1110.003 근거를 기록합니다.
같은 IP·계정의 120초 실패 합계20건, 높은 수준의 실패20건, 반복적인 여러 계정
비밀번호 대입을 분류합니다. 수치와 확신도는 이번 연습의 정책값이며 MITRE가
보장한 확률이나 고정 임계값이 아닙니다. 중복 경보를 합산하지 않습니다.

판단 모듈은 명확한 공격과 정상 이벤트를 규칙으로 처리하고, 애매한 경보만
`jev.mjs`에 수치·불리언 요약으로 요청합니다. 연결은
[TypeSafe 공식 API](https://docs.typesafe.ai/api)의 POST `/v1/systemone`,
`jev-latest`, Noul 질문을 사용하고 `answers.is_brute_force.noul`을 읽습니다.
이 값은 공격이라는 명제의 확률이며 Choice의 별도 confidence와 구분합니다.
기본 실행은 네트워크 없이 응답 없음 → alert입니다. 실패,
형식 오류, 제한시간 초과도 alert이며 실제 Jev 호출 성공으로 기록하지 않습니다.
0.85 이상 block, 0.5 이상 alert, 그 아래 record 계약을 유지합니다.

실제 호출은 [TypeSafe 대시보드](https://console.typesafe.ai/)에서 본인이 받은
키를 서버 실행 환경의 `TYPESAFE_API_KEY`에 안전하게 저장한 뒤,
`XDR_JEV_LIVE=1 npm run xdr:run -- brute-force`로 명시적으로 켭니다.
키를 명령문·채팅·Git에 넣지 않습니다. 키가 없으면 외부 호출하지 않고 alert로
돌아갑니다. 출발 IP·계정·설명·원본 로그는 전송하지 않고 재시도하지 않습니다.
격리 심판과 기본 명령은 오프라인 경로로 재현합니다.

실제 연동 검증은 `npm run xdr:verify-live`입니다. 이 명령은 실제 API 응답이
한 건도 없거나 애매한 경보의 어느 호출이라도 실패하면 실패하며, 오프라인 alert를
실제 성공으로 취급하지 않습니다. Vercel Production의 Secret `TYPESAFE_API_KEY`와
Config `XDR_VERIFY_JEV=1`을 설정한 배포는 빌드에서 같은 검증을 실행합니다.
결과는 비밀값 없는 수치 증빙 `public/xdr-live-check.json`으로 남깁니다. 검증 후
`XDR_VERIFY_JEV`를 끄면 다음 빌드에서 불필요한 유료 호출을 하지 않습니다.
2026-10-07 배포 커밋 `8295b3bae97aa9565bcb523197203612ac418fcf`에서
실제 Jev 요청9건·정상 응답9건을 확인했습니다. 실제 판정은 block10·alert1·record17이며
오프라인 결과 block10·alert9·record9와 구분합니다. 이후 검증 플래그를0으로 변경했습니다.
이 검증은 배포 빌드의 실제 외부 API 호출 증거이며 운영 반 엔진의 실시간 경보·접속
차단 연결을 증명하지 않습니다. 자료실 API에 실시간 XDR 처리를 붙였다는 뜻도 아닙니다.

실행기는 `result.json`과 만료15분·근거 경보 ID를 가진 차단 후보를 만듭니다.
알림은 `xdr/alerts.log`에 비밀값 없이 한 줄씩 기록하며 재실행 중복은 제거합니다.
로그·deny-rules.json·verification.json은 Git에서 제외합니다. result.json은 가상
경보의 판정만 담고 커밋합니다. 다른 XDR 과제의 판단 모듈은 아직 구현하지 않았습니다.

`guard.mjs`는 기존 ZTNA 판정을 대체하지 않는 추가 검사입니다. 신뢰된 운영
연결의 `getTrustedSource(requestId)`로 출발 IP를 받고, 활성 후보만 deny합니다.
정상·만료 주소는 원래 판정 함수로 그대로 돌아갑니다. 현재18필드 계약에는 IP가
없어 요청에 IP를 추가하지 않았고 `src/decider.mjs`의 starter.deny도 변경하지
않았습니다. 실제 연결에는 운영자가 신뢰된 주소 제공과 xdr_brute_force 이유 코드
등록을 제공해야 합니다. 현재 운영 엔진·실제 Wazuh·방화벽에는 연결하지 않았습니다.

운영 측 진입점은 `src/xdr-decider.mjs`의 `connectXdrDecider(operatorBinding)`입니다.
운영 측의 `getTrustedSource`, `getRules`, `denyReasonCode`, `allowedReasonCodes`가
없거나 거부 사유가 등록되지 않았으면 시작에 실패합니다. 기존 판정이 deny 또는
step_up이면 결과를 그대로 보존하며, allow일 때만 추가 주소 차단을 검사합니다.
운영자가 이 진입점과 신뢰된 주소 제공·규칙 저장소를 연결한 실제 요청 증빙이
없으면 차단 연결 완료로 보고하거나 과제를 제출하지 않습니다.

`node --test test/brute-force.test.mjs test/xdr-run.test.mjs`는 비밀값 가림,
중복·시간 창·계정 분리, Jev 실패와 경계값, 차단 만료, 기존 규칙 보존을 확인합니다.
정상 통과 검증은 명시적 allow 시험 기준 함수로 추가 검사만 재생한 것이며,
기본 거부 판정기의 실제 허용이나 실제 PC 차단으로 보고하지 않습니다.
가상 시험 결과 block10·alert9·record9, 정상 이벤트 차단0건입니다.

제출은 보너스 작전 → 무차별 로그인 → 과제 보기에서 실제 배포 주소와 공개
GitHub 저장소 주소를 넣고 「심판에게 제출하기」를 누릅니다. 심판은 저장소에서
같은 실행 명령을 재실행하며 결과 JSON만으로 완료를 판단하지 않습니다.
