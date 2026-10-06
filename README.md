# BYTE BACK 자료실 · 3단계

## 현재 구현

Supabase Auth 공식 SDK로 이메일·비밀번호 로그인과 로그아웃을 제공합니다.
브라우저에는 공개 publishable key만 있고 서버 키는 Vercel 환경변수에 둡니다.
서버 자료 API는 원본 `src/verify-login.mjs`로 토큰을 검증합니다. 해당 파일과
운영 judgeIssuer는 변경하지 않았습니다. 토큰이 없거나 검증에 실패하면
자료 없이 401 JSON 오류를 반환합니다.

로그인한 사용자는 메모를 추가·조회·수정·삭제할 수 있습니다. 목록은 확인된
사용자의 메모만 반환하고, 새 메모의 owner_id는 서버가 확인한 사용자 ID입니다.
개별 메모의 소유자 검사는 아직 없습니다. B의 A 메모 개별 조회·수정·삭제는
3단계에서 남은 약점이며 4단계에서 막습니다.

## 설치와 배포

Node.js 22 이상에서 `npm ci`를 실행합니다. 원본은
ChoiTimo/aleph-defense-starter R5입니다.

1. 기존 2단계 DB에 `sql/stage3-schema.sql`을 적용합니다. 기존 자료를 보존하고
   id를 UUID로 옮깁니다. 이미 UUID면 변환을 반복하지 않습니다.
2. `public/auth-config.json`에 학습용 Supabase URL과 공개 publishable key를 둡니다.
   서버 Secret key를 이 파일에 넣지 않습니다.
3. Vercel Production에 `SUPABASE_URL`과 `SUPABASE_SECRET_KEY`를 직접 저장합니다.
   실제 키·비밀번호·JWT는 채팅, Git, 로그, 응답, 제출 묶음에 넣지 않습니다.
4. Supabase Auth의 Site URL을 실제 배포 주소로 설정합니다. 이메일 확인을
   비활성화하지 않습니다. 테스트 계정과 비밀번호는 사용자가 공식 화면에서
   직접 설정하고, 가입 확인 메일의 링크를 누릅니다.
5. GitHub main을 배포합니다. 빌드는 `public/`에 공식 SDK UMD 파일을 복사하고
   빈 data.json과 실제 배포 신원 aleph.json을 생성합니다. Vercel은 서버 API도 배포합니다.

## 실제 API 계약

- GET `/api/notes`: 로그인 사용자의 `{id,title,body}` 배열.
- POST `/api/notes`: `{id?,title,body}`. id는 UUID이며 생략하면 서버가 생성합니다.
  201 `{id}` 응답. owner_id는 클라이언트 값 대신 검증된 사용자 ID입니다.
- GET `/api/notes/:id`: 200 `{id,title,body}` 또는 404 JSON 오류.
- PUT `/api/notes/:id`: `{title,body}`로 수정합니다. owner_id는 바꾸지 않습니다.
- DELETE `/api/notes/:id`: 삭제 후 같은 주소의 GET은 404입니다.
- 모든 자료 요청은 인증이 필요합니다. 무로그인 401, 잘못된 입력 400,
  중복 id 409, DB 오류 502를 반환하며 DB 오류 상세나 키를 출력하지 않습니다.

Vercel rewrite가 개별 메모 경로를 실제 서버 함수로 전달합니다.
`aleph.config.json`의 identityProvider와 allowedRoutes는 이 계약을 기록합니다.
owner_id에 auth.users 외래키는 없습니다. 원본 검증 도우미가 일반 사용자와
운영 심판의 테스트 신원을 모두 검증하기 때문입니다.

## 확인과 제출

`node --test test/r5.test.mjs test/stage2.test.mjs test/stage3.test.mjs`로 배포 신원,
실제 암호학적 토큰 검증, 무로그인 거부, 사용자 ID 결합과 CRUD 계약을 시험합니다.
DB를 대신하는 테스트 응답은 운영 DB 접속의 증거가 아닙니다.
`npm run build -- --local`은 로컬 정적 빌드 확인입니다.

배포 후 무로그인 GET·POST·PUT·DELETE 및 잘못된 토큰 요청의 실제 거부,
3단계 aleph.json, nosniff 헤더를 `npm run bundle`에서 직접 요청합니다.
일반 A 계정으로 로그인한 뒤 가상 메모 추가·수정·삭제·로그아웃을 화면에서
확인합니다. 심판 결과와 자기 점검을 구분합니다.
설명은 Git에서 제외한 bundle-notes.json에 적고 결과 artifacts/submission.json도
커밋하지 않습니다. 실제 포털 제출 칸에는 배포 주소를 넣습니다.

## 검증 기록과 공개 이력

2026-10-06 2단계 심판의 100/100점 통과를 확인했습니다. 2단계 배포
`9ab3e0e18f296dd3531c7e74cbc4afd9ece52bd7`에서 서버 자료 4건도 확인했습니다.
3단계 DB 변경은 기존 4건 보존, id=uuid, RLS=true, anon/authenticated 읽기=false,
service_role 쓰기=true로 확인했습니다. 3단계 배포와 포털 판정은 제출 후 별도로 기록합니다.

최신 공개 data.json에는 notes가 0건입니다. 과거 공개 GitHub 커밋과 Vercel
배포에는 가상 자료가 남을 수 있으며 최신 파일을 비웠다고 과거 노출이 회수되지는 않습니다.
실제 학생 자료나 개인정보는 입력하지 않습니다.
