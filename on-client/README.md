# 내 보안 Agent 시작 틀 0.2.14

이 보안 Agent는 회사 직원이 자기 로그인 상태, 업무 앱 접속 결과, 최근 접속 기록과 보안 경보를 보는 보안 앱입니다. 13단계부터 22단계까지 이 프로젝트 하나로 화면을 채워 가며 완성합니다. 처음이라면 docs/GETTING_STARTED_STUDENT.md부터 읽습니다. 무엇을 왜 만드는지와 단계별 순서가 그 문서에 있습니다.

이 시작 틀을 받은 것만으로 단계를 통과하지 않습니다. 단계마다 docs/STUDENT_PROMPTS.md의 안내를 수업용 AI에 붙여 넣어 student/extension.mjs를 고치고, 화면에서 확인하고, 커밋한 뒤 ALEPH에 제출합니다. 제출하면 서버가 그 커밋의 코드를 받아 AI가 단계 과제 기준으로 읽고 판정합니다. 코드를 실행해서 판정하지 않습니다.

## 켜기

검수 환경은 Node.js 24.19.0이며 외부 npm 의존성이 없습니다. 이 폴더의 PowerShell에서 아래를 실행하고 PC 브라우저로 http://127.0.0.1:5189 를 엽니다. 자세한 켜기·끄기·다시 켜기는 docs/STUDENT_LAUNCH_GUIDE.md에 있습니다.

    powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1

npm start도 같은 서버를 켭니다. 기본 실행은 실제 회사 시스템(기존 엔진)에 연결되지 않은 상태입니다. npm run demo는 예제 자료로 화면을 보여 줄 뿐이며 실제 연결이나 성취가 아닙니다. npm run check는 student/extension.mjs의 문법만 확인합니다.

## 지킬 것

- 기존 1~3차 프로젝트와 학생 파일은 지우거나 덮어쓰지 않습니다. 새 폴더에서 시작하거나, 이미 하던 프로젝트를 이어 씁니다.
- AI 열쇠·비밀번호·토큰을 코드, 커밋, 캡처, 도움정보에 넣지 않습니다. 주소나 열쇠를 직접 입력하는 칸도 만들지 않습니다.
- .env.example에는 비밀 없는 설정만 있습니다.

## 더 읽을 곳

- 단계별 안내와 AI에 붙여 넣을 문장: docs/STUDENT_PROMPTS.md
- 단계별 확인 항목: docs/CURRICULUM.json, docs/IMPLEMENTATION_CONTRACT.md
- 오류 코드별 해결: docs/CONNECTION_TROUBLESHOOT.md
- 시작 틀 업데이트(내 파일 보존): docs/STARTER_UPDATE.md
- 실제 회사 시스템(SDP)·앱 안 AI 연결은 담당자가 따로 안내할 때만 씁니다: docs/SDP_HOST_CONNECTION.md, docs/AI_SETUP_GUIDE.md. 이 연결은 앱을 처음 켜고 13~16단계 화면을 만들거나 공식 AI 코드 판정을 받기 위한 전제 조건은 아닙니다. 다만 17단계 이후의 실제 연결과 새 환경 재현은 해당 단계의 기준에 따라 따로 확인합니다.

## 화면 디자인

직원 앱과 기존 자료실은 Soft UI Evolution 공통 디자인을 사용합니다. 기준은 [디자인 시스템](../design-system/keshev/MASTER.md)입니다. `public/style.css`가 테마 원본이며, 저장소 루트에서 `npm run build -- --local`을 실행하면 기존 자료실과 오프라인 안내에도 동기화됩니다. 화면 구조를 바꾸더라도 원래 버튼 ID·접근 가능한 이름·학생 data 속성과 예제/미연결 구분을 유지하세요.

## 단계별 구현·확인

17단계는 `e4bbeaa98cb0b671cdedba0672f2af2ab3a82bca`에서 공식 원문 심사9항목을 통과했습니다. 이는 개인 OAuth의 수업용 권한 승인이나 운영 SDP 연결을 검증한 결과와 다릅니다.

18단계의 `renderExplanation`은 현재 사건의 근거·규칙·unknown 상태와 참고용 AI 요약을 함께 표시합니다. 근거 부족·불일치·이미 실행됐다는 응답은 거부하며 성공 표식은 검증된 설명에만 붙입니다. 제안은 이유·사람 확인 필요·미실행을 표시하고 실행 버튼은 만들지 않습니다. 새 기록·초기화·오류에는 이전 성공 표시가 남지 않습니다.

검사: 저장소 루트에서 `node --test test/on-client-stage17.test.mjs test/on-client-stage18.test.mjs`. 자동 검사는 합성 입력의 렌더링 계약입니다. 제공 앱 예제 화면에서 실제 AI 미연결 오류 뒤에도 기록·업무 앱 판정이 유지되고 새로고침으로 설명이 초기화되는 것을 확인했습니다. 운영 SDP 사건으로 실제 AI 설명을 생성하는 경로는 아직 확인하지 않았습니다.

18단계는 `57f2120d65dab8db70a846656b83cab022e9064b`에서 공식8항목 통과를 확인했습니다. 19단계 `renderAction`은 제안·준비·전달·ACK·실제 효과 관측을 구분하고 현재 사건/근거/조치/대상 세대/요청/영수증을 표시합니다. 효과 관측 없는 succeeded는 결과 불명이며, 중복 영수증은 새 집행으로 표시하지 않습니다. 실제 운영 집행은 아직 미연결(UNV)입니다. 학생 함수에 POST·집행 버튼·확인 티켓을 추가하지 않았습니다.

19단계 상태 시험은 `node --test test/on-client-stage19.test.mjs`입니다. 합성 화면에서11상태와 효과 없는 succeeded의 거부, 새 입력의 이전 값 제거를 확인했고 제공 앱 예제에는 지원 조치가 없어 준비 버튼이 없는 정상 상태를 확인했습니다. 실제 보안 집행을 시험 삼아 실행하지 않았습니다.

19단계는 `2709a0df82d093ed33bb097077d29c592d7fecd4`에서 공식8항목을 통과했습니다. 20단계 `renderVulnerabilities`는 정확한 설치 버전, OSV 출처·확인 시각·취약점 ID/modified, 전체 및 패키지별 조회 상태를 표시합니다. 일부 실패에도 받은 ID를 보존하고 미조회·조회 불가를 알려진 항목 없음과 구분합니다. hash와 표는 현재 입력으로 교체됩니다.

20단계 검사: `node --test test/on-client-stage20.test.mjs`. 기본 예제 앱의 not_configured 표시와, 외부 조회 없는 합성 scanner를 연결한 제공 UI의 오류→수동 재조회→취소→부분 결과 복구 및 지연 응답 폐기를 확인했습니다. 개인 앱에 실제 설치된 jose 6.2.13 / openai 7.43.0을 lock·설치 메타데이터·합성 조회 화면과 대조했습니다. 이는 실제 OSV의 취약점 판정 결과가 아닙니다. 의존성·lock·공개 조회 허용 목록·대상 프로젝트 설정은 변경하지 않았습니다.
