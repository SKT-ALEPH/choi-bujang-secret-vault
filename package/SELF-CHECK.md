# 직접 시험한 결과

현재 보완 브랜치 검증 중이며 심판 자동 통과 판정이 아니다. 미검증 항목이 남으면 제출하지 않는다. 캡처/로그에 키·토큰·실제 개인정보·자료 본문을 넣지 않는다. 과거100점과 현재 커밋의 검증을 구분한다.

## P3. 두 서버의 무로그인 거부

- 코드/로컬: 두 API가 런타임/키/외부 원천을 읽기 전에401. 원본 JWT·XDR·서명 게이트웨이를 재사용. 가짜 신원과 임의 URL/중복 쿼리 거부 시험 통과.
- 실제 새 배포: 두 API 무로그인401 `LOGIN_REQUIRED`, 무효 토큰401 `INVALID_LOGIN`, 유효한 현재 사용자 토큰만으로 직접 접근하면403 `NETBIRD_GATEWAY_REQUIRED`. Cache-Control no-store·nosniff 확인. 정상 서명 게이트웨이를 거친 침해 정보는200. AI 정상 응답은 P4의 별도 미검증 항목이다.
- 캡처: [AI401](self-check/P3-1.png), [침해 정보401](self-check/P3-2.png).

## P4. 실제 AI 호출 상한

- 2026-10-27 격리된 실제 PostgreSQL16:35개 동시 요청30허용/5거부, 별도 사용자 분리, DB 재시작 후 사용량 보존, anon/authenticated 테이블/RPC 거부, migration 재실행 확인. 운영 연결과 구분한다.
- 실제 Supabase: 서비스 전용 두 테이블/RPC 적용. 기존 notes6건 보존. RLS=true, anon read=false, authenticated cache write/RPC=false, service_role RPC=true. [권한 캡처](self-check/schema.png).
- 실제 새 배포의 키 미설정 실패는503 `AI_NOT_CONFIGURED`로 표시되며 운영 DB 예약0회·사용량 행0개를 확인했다. 성공으로 꾸미거나 일일 사용량을 초기화하지 않았다.
- 실제 클라우드200→429: **미검증**. 새 프로젝트의 서버 한도를1로 설정하고 고정 비민감 요약 한 번의 실제 모델 응답과 다음429, 재시작 이후 한도 유지 확인 예정. 이미 사용한 일별 기록은 삭제/시계 조작으로 초기화하지 않는다.
- 캡처: self-check/P4-1.png, self-check/P4-2.png (검증 후 추가).

## P5. 공식 침해 정보·수신 시각

- 2026-10-27 공식 HTTPS NVD/CISA JSON 실제 수신 성공. 원천별 시각·KEV catalogue1758건·Node 검색1216건 중 첫50/마지막16·jose50/93·Supabase43·esbuild3·Wazuh50/94 확인. 이 수신은 직접 reader 점검이며 배포 API/DB 캐시와 구분.
- 코드 시험: 캐시 재시작·6시간·동시 조회·독립 원천 시각·실패 시 성공 시각 보존·CPE 범위·복잡 조건/타 vendor 수동 검토.
- 실제 새 배포→Windows 서명 게이트웨이→기존 앱 UI200 확인. Wazuh4.14.9 검색 첫50/94건, NVD 실제 수신13:22:49·KEV13:22:48 KST, catalogue2026.10.26. 두 번째 수동 조회는 두 시각을 그대로 유지하며 DB의 6시간 저장 자료를 표시했다. CVE-2025-24016은 KEV 등재이며 선언4.14.9가 이 기록의 명시 범위 밖임을 원문과 대조했다. 전체 검색/전체 PC 안전 판정으로 확대하지 않는다.
- 캡처: [실제 조회](self-check/P5-1.png), [재조회·원래 수신시각 보존](self-check/P5-2.png).

## P7. 새 프로젝트 배포·첫 화면

- 새 프로젝트 `keshev-defense-package-20261027`, Production은 보완 브랜치만 추적. 기존 main 배포 보존. 실제 첫 화면 https://keshev-defense-package-20261027.vercel.app/ 200, nosniff, `/aleph.json`의 원격 커밋9ef95a64e1638f4016c0a5239cc951518894fde4 일치. 후속 코드235c87d639b709fc24031fa74811ccdbf8b38a6e도 실제 Production Ready·동일 커밋·첫 화면200·두 API401을 재확인했다.
- 네 환경변수(Supabase 세 값·AI 한도1)를 Secret으로 저장하고 새 Production 배포 Ready 확인. 실제 Auth/DB 연결은 P3/P5와 기존 자료실 검증으로 확인했다. TypeSafe 키 추가와 실제 모델200→429는 아직 남아 있다. 코드235c87d의 새 배포와 같은 커밋의 새 폴더 실행/재시작은 확인했다.
- 캡처: self-check/P7-1.png(값 없는 환경변수 이름), self-check/P7-2.png(Ready/커밋), self-check/P7-3.png(실제 첫 화면).

## 총공세·기존 보호

- 1~7일차·21/22 안내를 다시 정독해 요구별 구현/검증을 기록했다. setup.exe는 사용자 제외이며 현재 package-app 없는 시작 틀의 포장 생략 안내를 적용한다.
- Windows 현재 통합 앱을 작업 관리자에서 직접 대조했다. [실측과 차이](WINDOWS-COMPARISON.md)를 따른다. 무거운 PowerShell 조회와 CPU 표본이 겹치는 문제를 발견해 CPU를 먼저 측정하도록 보완했다. 같은235c87d를 Git에서 다시 받은 별도 폴더에서 의존성 설치·빌드·통합 앱 시작/종료/재시작을 확인했다. [재현 기록](REPRODUCTION.md)을 따른다. 개인 AI 외부 호출과 서버 AI 실응답은 이 재현에서 수행하지 않았다.
- 기존 정상 계정·기기 승인·본인 메모1건을 그대로 사용했다. 같은 로그인과 기기 서명으로 원래 공개 자료실 HTTP403, NetBird 경로 HTTP200을 실제 확인했다. 계정/자료를 새로 만들거나 삭제하지 않았다.
- 9ef95a6 전체 로컬120시험·실제 제한 격리 실행 통과(HTTP19회·읽기 Git6회). 키 없는 DB401과 유효 anon 권한 검증을 구분하고 미실행2항목을 명시했다. 후속235c87d 원본/새 폴더에서 각각 전체120시험, 새 폴더의 실제 제한 격리 실행도 통과(HTTP19·읽기 Git6·미실행2). 텍스트354파일 비밀 패턴0건, 공개 캡처 수동 검토. 이후 문서만 바뀐 커밋도 제출 전 원격/실제 배포 일치를 재대조한다.
- 미검증 조건이 모두 해소되기 전 CEX/메모리얼을 재제출하지 않는다.
