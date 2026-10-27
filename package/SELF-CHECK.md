# 직접 시험한 결과

현재 보완 브랜치 검증 중이며 심판 자동 통과 판정이 아니다. 미검증 항목이 남으면 제출하지 않는다. 캡처/로그에 키·토큰·실제 개인정보·자료 본문을 넣지 않는다. 과거100점과 현재 커밋의 검증을 구분한다.

## P3. 두 서버의 무로그인 거부

- 코드/로컬: 두 API가 런타임/키/외부 원천을 읽기 전에401. 원본 JWT·XDR·서명 게이트웨이를 재사용. 가짜 신원과 임의 URL/중복 쿼리 거부 시험 통과.
- 실제 새 배포: 두 API 무로그인401 `LOGIN_REQUIRED`, 무효 토큰401 `INVALID_LOGIN`, 유효한 현재 사용자 토큰만으로 직접 접근하면403 `NETBIRD_GATEWAY_REQUIRED`. Cache-Control no-store·nosniff 확인. 정상 서명 게이트웨이를 거친 침해 정보는200. 정상 서명 AI 응답과 한도 초과는 P4에서 별도로 확인했다.
- 캡처: [AI401](self-check/P3-1.png), [침해 정보401](self-check/P3-2.png).

## P4. 실제 AI 호출 상한

- 2026-10-27 격리된 실제 PostgreSQL16:35개 동시 요청30허용/5거부, 별도 사용자 분리, DB 재시작 후 사용량 보존, anon/authenticated 테이블/RPC 거부, migration 재실행 확인. 운영 연결과 구분한다.
- 실제 Supabase: 서비스 전용 두 테이블/RPC 적용. 기존 notes6건 보존. RLS=true, anon read=false, authenticated cache write/RPC=false, service_role RPC=true. [권한 캡처](self-check/schema.png).
- 실제 새 배포의 키 미설정 실패는503 `AI_NOT_CONFIGURED`로 표시되며 운영 DB 예약0회·사용량 행0개를 확인했다. 성공으로 꾸미거나 일일 사용량을 초기화하지 않았다.
- 실제 클라우드: 새 서버 Jev에 가상 수치5개로 단1회 전송. 2026-10-27 14:08:30 KST 실제 완료 응답, 표시 확신도5.0%·사용량1/1·다음 초기화10월28일09:00 KST. 이후 정상 승인 요청은14:10:11 HTTP429 `AI_DAILY_LIMIT`, Retry-After67789초. 운영 DB는 사용량1행·예약1회·기존 notes6건·캐시3행을 확인했다.
- Mac 앱 재시작/새 소스 경로에서 정상 원래 자료 조회를 복구한 뒤14:35:14에도429·Retry-After66286초. 한도/시계/사용량을 초기화하지 않았고 추가 모델 전송을 하지 않았다. 토큰 갱신 직후 기기 승인 전401은 한도 판정과 구분했다.
- 근거: [초과 요청 뒤에도 사용자1명·예약1회인 실제 DB](self-check/P4-1.png), [실제 화면에서 추출한 성공 응답](self-check/P4-1.txt), [실제 초과 안내 화면](self-check/P4-2.png). 첫 PNG는 운영 DB 집계이며 성공 응답 화면을 합성한 이미지가 아니다.

## P5. 공식 침해 정보·수신 시각

- 2026-10-27 공식 HTTPS NVD/CISA JSON 실제 수신 성공. 원천별 시각·KEV catalogue1758건·Node 검색1216건 중 첫50/마지막16·jose50/93·Supabase43·esbuild3·Wazuh50/94 확인. 이 수신은 직접 reader 점검이며 배포 API/DB 캐시와 구분.
- 코드 시험: 캐시 재시작·6시간·동시 조회·독립 원천 시각·실패 시 성공 시각 보존·CPE 범위·복잡 조건/타 vendor 수동 검토.
- 실제 새 배포→Windows 서명 게이트웨이→기존 앱 UI200 확인. Wazuh4.14.9 검색 첫50/94건, NVD 실제 수신13:22:49·KEV13:22:48 KST, catalogue2026.10.26. 두 번째 수동 조회는 두 시각을 그대로 유지하며 DB의 6시간 저장 자료를 표시했다. CVE-2025-24016은 KEV 등재이며 선언4.14.9가 이 기록의 명시 범위 밖임을 원문과 대조했다. 전체 검색/전체 PC 안전 판정으로 확대하지 않는다.
- 캡처: [실제 조회](self-check/P5-1.png), [재조회·원래 수신시각 보존](self-check/P5-2.png).

## P7. 새 프로젝트 배포·첫 화면

- 새 프로젝트 `keshev-defense-package-20261027`, Production은 보완 브랜치만 추적. 기존 main 배포 보존. 실제 첫 화면 https://keshev-defense-package-20261027.vercel.app/ 200, nosniff, `/aleph.json`의 원격 커밋9ef95a64e1638f4016c0a5239cc951518894fde4 일치. 후속 코드235c87d639b709fc24031fa74811ccdbf8b38a6e도 실제 Production Ready·동일 커밋·첫 화면200·두 API401을 재확인했다.
- 다섯 환경변수(Supabase 세 값·TypeSafe 키·AI 한도1)를 Secret으로 저장하고 새 Production 배포 Ready 확인. 실제 Auth/DB 연결은 P3/P5와 기존 자료실 검증으로 확인했다. TypeSafe 키를 새 서버에만 저장한 배포에서 실제 모델 응답과429를 확인했다. 코드235c87d의 새 배포와 같은 커밋의 새 폴더 실행/재시작은 확인했다.
- 캡처: self-check/P7-1.png(값 없는 환경변수 이름), self-check/P7-2.png(Ready/커밋), self-check/P7-3.png(실제 첫 화면).

## 총공세·기존 보호

- 1~7일차·21/22 안내를 다시 정독해 요구별 구현/검증을 기록했다. setup.exe는 사용자 제외이며 현재 package-app 없는 시작 틀의 포장 생략 안내를 적용한다.
- Windows 현재 통합 앱을 작업 관리자에서 직접 대조했다. [실측과 차이](WINDOWS-COMPARISON.md)를 따른다. 무거운 PowerShell 조회와 CPU 표본이 겹치는 문제를 발견해 CPU를 먼저 측정하도록 보완했다. 같은235c87d를 Git에서 다시 받은 별도 폴더에서 의존성 설치·빌드·통합 앱 시작/종료/재시작을 확인했다. [재현 기록](REPRODUCTION.md)을 따른다. 이후 같은 코드에서 서버 AI 실응답·재시작 후 한도 보존도 확인했다. 개인 OAuth의 추가 모델 호출은 수행하지 않았다.
- 기존 정상 계정·기기 승인·본인 메모1건을 그대로 사용했다. 같은 로그인과 기기 서명으로 원래 공개 자료실 HTTP403, NetBird 경로 HTTP200을 실제 확인했다. 계정/자료를 새로 만들거나 삭제하지 않았다.
- 9ef95a6 전체 로컬120시험·실제 제한 격리 실행 통과(HTTP19회·읽기 Git6회). 키 없는 DB401과 유효 anon 권한 검증을 구분하고 미실행2항목을 명시했다. 후속235c87d 원본/새 폴더에서 각각 전체120시험, 새 폴더의 실제 제한 격리 실행도 통과(HTTP19·읽기 Git6·미실행2). 텍스트354파일 비밀 패턴0건, 공개 캡처 수동 검토. 이후 문서만 바뀐 커밋도 제출 전 원격/실제 배포 일치를 재대조한다.
- 미검증 조건이 모두 해소되기 전 CEX/메모리얼을 재제출하지 않는다.

## P1·P2·P6·P8 대조와 남은 접수 절차

| 조건 | 구현·실제 근거 |
|---|---|
| P1 | package/README·ARCHITECTURE·POLICIES·THREAT-INTEL·DEMO·SELF-CHECK 및 실제 증거 |
| P2 | 최신 추적 소스/제출 대상의 키·JWT·개인키 패턴 검사와 캡처 수동 검토. 과거 공개 키가 Git 이력에서 사라졌다고 하지 않음 |
| P6 | 원본 JWT/기기/owner/XDR/NetBird 서명을 서버에서 확인. 같은 정상 사용자·서명의 공개403/NetBird200 실측 |
| P8 | ARCHITECTURE·POLICIES가 실제 모듈/6판단기/지원 Agent/원천 조치와 일치. THREAT-INTEL의5개 선언 버전·CPE 조건·KEV 대조/한계를 기록 |

구현·실연결 검증과 심판 판정은 다르다. CEX는 커밋40자리를 받지만 메모리얼은 저장소 URL만 받는다. 잘못된 main 코드를 제출하지 않도록 최종 PR/배포 커밋을 먼저 대조한다. 제출 후에도 실제 접수번호·판정을 확인하기 전 통과로 보고하지 않는다.
