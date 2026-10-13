# XDR-01 자료실 서버 연결과 적용 범위

이번 과제의 차단은 현재 자료실의 서버 접근 통제에 연결한다. 6단계 이후의
운영 반 엔진 연결을 이번 보너스의 필수 조건으로 추가하지 않는다.
`src/decider.mjs`의 starter.deny와18필드 계약은 그대로 보존한다.

## 실제 처리 경로

1. Vercel이 덮어쓴 `x-vercel-forwarded-for`에서 서버가 출발 주소를 확인한다.
   브라우저 본문이나 임의 IP 필드는 쓰지 않는다. Vercel 밖에서는 별도 신뢰 어댑터가 필요하다.
2. `/api/auth`의 비밀번호 로그인에서 Supabase가 `invalid_credentials`를 반환한
   경우만 실패로 센다. 네트워크 장애·갱신·로그아웃은 비밀번호 실패로 세지 않는다.
3. `xdr_failure`가 같은 출발 주소의120초 창에서 실패를 원자적으로 합산한다.
   원본 IP·이메일은 저장하지 않고 서버 키로 분리된 HMAC 지문을 저장한다.
4. `live.mjs`가 같은 `decide.mjs`로 판단한다. 명확한20건 이상 실패는 규칙으로,
   애매한 실패는 실제 Jev로 판단한다. 실패·시간 초과는 alert이며 자동 차단하지 않는다.
5. `xdr_apply`가 판단·가상 아닌 서버 경보 UUID를 기록한다. block 확신도0.85 이상만
   15분 만료와 근거 경보 번호를 가진 추가 거부 규칙이 된다.
6. `/api/auth`는 활성 후보의 인증 요청을429로 거부한다. 로그아웃은 계속 허용한다.
   `/api/notes`는 기존 토큰 검증 뒤 추가 guard로 활성 후보를403으로 거부한다.
   기존 경로·소유자 검사는 계속 적용하며, XDR은 기존 거부를 허용으로 바꾸지 않는다.
7. 만료 후 guard가 차단을 적용하지 않으므로 기존 인증·소유자 검사로 돌아간다.

HTTP 경로에서 쓰는 `xdr_brute_force`는 자료실 내부 정책 코드다. 운영 반 엔진의
등록 코드로 보고하지 않는다. `connectXdrDecider`는 미래 엔진 연결용 어댑터로
남겨 두며 현재 HTTP 경로의 연결 완료와 구분한다.

## 설치

Supabase SQL Editor에서 `sql/xdr-brute-force.sql`을 적용한다. 두 테이블과 두 RPC는
RLS 활성, anon/authenticated 직접 권한 없음, service_role만 접근한다.
기존 notes 테이블과 기존 계정·메모는 변경하지 않는다.
이미 있는 서버 전용 SUPABASE_URL·SUPABASE_SECRET_KEY·TYPESAFE_API_KEY를 사용한다.
새 공개 API는 만들지 않으며 비밀값을 브라우저나 저장소에 넣지 않는다.

## 과제의 Wazuh 시험 경보

`npm run xdr:run -- brute-force`는 제공된 가상 Wazuh 경보를 네트워크 없이 분석한다.
읽기·패턴·판단·파일 저장·추가 guard를 실제 실행하고 result.json과 검증 수치를 만든다.
가상 출발 주소는 운영 DB로 올리지 않는다. 알림은 xdr/alerts.log에 한 줄씩 기록한다.
실제 자료실 경보는 서버 전용 xdr_alerts에 같은 action/confidence/패턴 이름으로 기록한다.
서버리스의 임시 파일을 영속 운영 로그로 쓰지 않는다.

## 확인

- 가상 경보 분류와 정상 차단0건은 fixture 재생 증거다.
- 실제 자료실의 실패 합산→차단→만료 후 복귀는 별도 배포 요청으로 확인한다.
- DB의15분 TTL·원자적 합산·직접 접근 거부는 실제 트랜잭션에서 확인한다.
- 실제 Jev 응답 확인과 오류 대체 시험을 구분한다.
- 실시간 Wazuh 수집기·PC 방화벽·운영 반 엔진 전체를 설치했다고 보고하지 않는다.

[Vercel 출발 주소 헤더](https://vercel.com/docs/headers/request-headers),
[Supabase DB 함수](https://supabase.com/docs/guides/database/functions).
