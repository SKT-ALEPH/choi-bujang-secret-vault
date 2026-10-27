# 케셰브 · ZTNA·XDR 패키지

기존 자료실의 사용자·자료를 보존하면서 NetBird로 Mac→Windows의 지정 경로만 열고, 자료 권한·XDR·Agent의 실제 거부와 복구를 연결한다. PC 감시는 별도 Wazuh 서비스다. 이 문서는 현재 보완 브랜치의 설치 안내이며, [실측표](SELF-CHECK.md)에 미검증 항목이 남으면 제출하지 않는다.

## 준비물과 실행 경계

- 저장소: https://github.com/SKT-ALEPH/choi-bujang-secret-vault
- 보완 브랜치: `codex/defense-requirements-repair`. 기존 main과 기존 Vercel 프로젝트를 변경하지 않는다.
- 웹: GitHub·Vercel·Supabase 계정. 기존 Supabase 프로젝트의 Auth와 스키마를 재사용한다. 새 빈 DB를 쓰려면 루트 README의 2~12단계 스키마와 기기/게이트웨이 nonce 스키마를 먼저 적용하고 실제 계정·기기를 등록해야 한다. 이 문서의 P7은 새 Vercel 프로젝트 재현이며 빈 DB 이관 시험이 아니다.
- 통합 앱: Apple Silicon Mac, Parallels Windows 11 ARM64 일반 사용자 로그인, 두 기기에 Node **24.19.0**, Mac 홈 공유, 공식 NetBird 설치·등록. Mac→Windows TCP **54123** 한정 정책을 사용한다. 전체망 허용·SSH·RDP가 필요하지 않다.
- PC 감시: Docker Desktop의 전용 Wazuh manager와 두 OS의 공식 에이전트·송신량 센서. 관리자 설치는 [PC 감시 안내](../pc-security/README.md)를 따른다. 이 구성 없이도 자료실·NetBird·개인 AI를 쓸 수 있으나 PC 경보·새 OS 자동 대응은 제공되지 않는다.
- AI: 기존 개인 OpenAI OAuth와 클라우드 Jev API는 서로 다른 연결이다. 기존 승인을 임의로 복제하지 않는다. Jev API는 제공자 계정의 사용 한도를 소비한다.

## 서버 환경변수

실제 값은 서비스의 공식 입력란에만 넣는다. `.env`, 자격 파일, 키, 세션은 Git에 포함하지 않는다. `config/supabase-public.json`에는 URL만 있다. 이전 커밋의 공개 publishable key가 사라졌다고 주장하거나 Git 이력을 지우지 않는다.

| 이름 | 목적·발급 위치 |
|---|---|
| `SUPABASE_URL` | Supabase 프로젝트 URL. 기존 신원 발급자와 일치해야 함 |
| `SUPABASE_SECRET_KEY` | 서버 DB 접근. 같은 Supabase 프로젝트의 API 설정에서 발급 |
| `SUPABASE_PUBLISHABLE_KEY` | 기존 Auth 프록시가 상류 요청에만 붙이는 공개 키. Supabase API 설정에서 확인하며 이 패키지는 서버 환경변수로 보관 |
| `TYPESAFE_API_KEY` | 기존 TypeSafe/Jev 서버 클라이언트. TypeSafe 공식 계정에서 발급 |
| `PACKAGE_AI_DAILY_LIMIT` | 선택. 기본30, 범위1~1000. 검증 시1로 낮추면 실제 요청 한 번 뒤 다음 요청429를 확인 가능. UTC 자정 기준, 전 사용자에게 같은 서버 설정 적용 |

새로운 외부 통신 대상은 고정된 Jev API, NVD CVE API, CISA KEV JSON이다. AI에는 다섯 수치·불리언만 보낸다. 자료 본문·이메일·주소·키·자유 입력 프롬프트는 받지 않는다. NVD에는 고정된 공개 구성요소 검색어만 보낸다.

## 새 Vercel 프로젝트에 배포

1. Node24.19.0에서 `npm ci`를 실행한다. Supabase SQL Editor에서 `sql/package-services.sql`을 적용한다. 기존 notes·Auth 사용자를 수정하지 않으며 서비스 전용 사용량/캐시 두 테이블과 원자적 한도 함수만 추가한다. RLS·anon/authenticated 접근 회수를 확인한다.
2. Vercel에서 **새 프로젝트**를 만들어 위 저장소를 연결한다. Import가 main만 표시하면 새 프로젝트 생성 뒤 Settings → Environments → Production → Branch Tracking에 `codex/defense-requirements-repair`를 저장하고, 그 브랜치의 배포만 실제 검증 대상으로 삼는다. 기존 프로젝트의 Production Branch를 바꾸지 않는다. Root Directory는 `./`, Application Preset은 **Other**다. 자동 감지되는 `on-client`/`personal-ai` 다중 서비스 제안을 적용하지 않는다. 두 폴더는 PC용이며 클라우드 웹의 대체물이 아니다.
3. 위 환경변수를 새 프로젝트의 Production에 설정한다. 이전 프로젝트에서 자동 복사됐다고 가정하지 않는다. 키가 없으면 Auth/AI는 정상처럼 응답하지 않는다. 값이 보이지 않는 환경변수 이름 화면을 `self-check/P7-1.png`로 남긴다.
4. 저장소 `vercel.json`의 빌드 `npm run build`, 출력 `public`을 사용한다. **Vercel이 제공하는 저장소·커밋·배포 URL 정보**가 자동 입력돼야 한다. 시스템 변수를 손으로 위조하거나 로컬 빌드로 배포 신원을 대신하지 않는다. 로컬 정적 확인만 `npm run build -- --local`을 쓴다.
5. 배포 완료 화면과 실제 새 주소의 첫 화면을 `self-check/P7-2.png`, `self-check/P7-3.png`로 저장한다. `/aleph.json`의40자리 commit을 GitHub 원격과 비교한다. 비로그인 두 API401, 가짜 토큰401, 직접 우회403, 정상 NetBird API200은 각각 따로 확인한다.
6. 새 주소가 확인되면 `aleph.config.json`의 선택적 `packageServicesUrl`에 **그 HTTPS origin만** 지정한다. Windows 게이트웨이의 두 패키지 API에만 적용되고 원래 자료실의 `publicAppUrl`과 로그인·메모 경로는 유지된다. 앱을 재시작해 현재 승인된 자료실 계정·기기로 검증한다.

검증 프로젝트의 할당 도메인: https://keshev-defense-package-20261027.vercel.app/ (아직 실제 배포 전). 첫 화면과 실제 커밋 확인: [SELF-CHECK](SELF-CHECK.md)의 P7 기록을 따른다. 아직 확인하지 않은 주소를 기입하지 않는다.

## 통합 앱 시작과 사용

저장소 루트에서 `node personal-workspace/start.mjs`를 실행하고 http://127.0.0.1:5189/ 를 연다. 자세한 기기 등록·키 보관·초기 준비는 [NetBird 안내](../on-client/docs/STUDENT_NETBIRD.md), [AI 안내](../personal-ai/README.md), [전체 실행 설명](../personal-workspace/README.md)을 따른다. 설명서만으로 다른 폴더에서 재현한 결과는 실측표에 별도로 기록한다.

1. 기존 자료실 열기 → 원래 계정 로그인 → 기기 승인 → 본인 자료 조회. 인증·기기·서버 권한이 없으면 거부돼야 한다.
2. Windows 상태 다시 조회 → CPU·메모리·디스크의 시각/단위와 이전 성공값 비교. 읽지 못한 값은 확인 불가다. System/Application 건수는 공격 판정이 아니다.
3. 공식 침해 정보에서 구성요소·페이지를 선택해 조회. NVD/KEV 각 수신 시각, 캐시 여부, 현재 페이지 범위와 버전 대조를 읽는다.
4. 서버 AI 검증을 펼쳐 고정된 가상 수치 요약을 전송. 실제 응답·사용량·429를 확인한다. 이 버튼은 개인 OAuth 설명이나 실제 공격 탐지를 대신하지 않는다.
5. 보안 기록의 실제 근거를 읽고 Agent가 지원하는 조치를 사람 확인 후 실행한다. 결과는 원천에서 재조회한다. 조치 범위를 PC 전체나 모든 공격으로 확대하지 않는다.

## 중지·복구

앱은 Ctrl+C로 중지한다. NetBird·Wazuh 에이전트·OS 차단 서비스는 별도이며 앱 종료로 없어지지 않는다. 이미 적용된 자체 차단은 원래 기한까지 남는다. 장애 시 정상 커밋의 앱/게이트웨이 소스와 Vercel 배포를 복원하되 기존 Supabase 자료·Windows 감사 DB·DPAPI 키·Wazuh volume을 지우지 않는다. 추가 DB 테이블은 서비스 전용으로 남겨 사용량 우회·캐시 유실을 막는다. 키 오류는 공식 설정에서 수정하며 출력하지 않는다. setup.exe와 서명·스토어 배포는 사용자 요청으로 제외한다.
