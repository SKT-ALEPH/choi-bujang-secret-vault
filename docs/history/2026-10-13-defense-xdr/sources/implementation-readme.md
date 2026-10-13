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
