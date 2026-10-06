# BYTE BACK 자료실 · 2단계

## 현재 동작과 범위

가상 자료는 Supabase의 `public.notes` 테이블에 보관합니다. 브라우저는
`/api/notes`를 호출하고 Vercel 서버가 자료를 읽습니다. 현재 API는
비로그인 GET 요청에 열려 있습니다. 사용자 인증은 3단계에서 추가합니다.
원본 시작 틀은 ChoiTimo/aleph-defense-starter R5입니다.

## 설치와 배포

Node.js 22 이상에서 `npm ci`를 실행합니다. Vercel은 `npm run build`를 실행하고
`public/`과 `api/` 서버 함수를 배포합니다. 로컬 정적 빌드 확인은
`npm run build -- --local`이며 배포나 DB 접속의 성공을 증명하지 않습니다.

1. 학습용 Supabase 프로젝트의 SQL Editor에서 `sql/stage2-schema.sql`을 실행합니다.
2. 가상 자료 네 건은 SQL Editor 또는 Git에서 제외한 로컬 SQL로 입력합니다.
   메모 본문을 저장소, 정적 파일, 제출 묶음에 넣지 않습니다.
3. Vercel Production 환경에 `SUPABASE_URL`과 서버 전용 `SUPABASE_SECRET_KEY`를
   직접 설정합니다. 실제 키를 코드, 채팅, 응답, 로그에 넣지 않습니다.
4. GitHub main 변경을 배포합니다. 환경변수를 변경했으면 재배포합니다.
5. 첫 화면과 `/api/notes`에서 자료 네 건, `/data.json`에서 빈 notes 배열,
   `/aleph.json`에서 실제 저장소·커밋·단계를 확인합니다.

## 테이블과 권한

`notes`는 id, title, content, owner_id(uuid) 칸을 가집니다.
owner_id에는 아직 auth.users 외래키를 걸지 않습니다.
RLS를 켜고 anon·authenticated의 테이블 권한을 제거했습니다.
service_role에는 SELECT만 명시적으로 부여합니다.
SQL Editor 점검에서 자료 4건, RLS=true, anon 읽기=false,
authenticated 읽기=false, service_role 읽기=true를 확인했습니다.
관리자 SQL Editor 조회는 일반 방문자의 조회 권한을 증명하지 않습니다.

## 확인 방법

- `node --test test/r5.test.mjs test/stage2.test.mjs`: 배포 식별, API의 설정 누락,
  쓰기 요청 거부, 서버 오류·키 비노출을 확인하는 로컬 시험입니다.
- `npm run build -- --local`: 2단계 빌드에서 공개 notes 배열이 비었는지 확인합니다.
- 최신 공개 파일 검색: `rg -n "실습용 가상 .* 기록|sb_secret_" public api sql scripts data.json`
  서버 키의 변수명만 쓰고 실제 키는 없어야 합니다. 메모 본문 일치는 0건이어야 합니다.
- `curl -I https://choi-bujang-secret-vault-ecru.vercel.app/`:
  첫 화면의 `X-Content-Type-Options: nosniff`를 확인합니다.
- 최신 배포가 준비되면 `bundle-notes.json`에 비밀값·본문 없는 설명을 적고
  `npm run bundle`을 실행합니다. 결과는 `artifacts/submission.json`입니다.
  두 파일은 커밋하지 않습니다. 기록은 자기 점검이며 실제 심판 판정은 포털에서 확인합니다.

## 남은 약점과 공개 이력

서버 API는 아직 로그인 없이 자료를 반환합니다. 이번 단계는 정적 파일과
최신 공개 코드에서 자료를 분리하는 작업입니다. 로그인과 사용자별 접근 제한은
다음 단계에서 추가해야 합니다.
이전 공개 GitHub 커밋과 이전 Vercel 배포에는 가상 메모가 남아 있을 수 있습니다.
최신 파일을 수정했다고 과거 노출이 해소되거나 유출 자료가 회수되는 것은 아닙니다.
실제 개인정보나 실제 학생 자료는 넣지 않습니다.

## 저장점

1단계 배포 커밋: `8f8c1c1903093ee1a7cded60f5a36802cdad9887`.
이번 저장점은 2단계 코드·빌드·DB 권한 이전입니다.
배포와 포털 제출 결과는 실제 확인 뒤 별도로 기록합니다.
