# 케셰브 새 폴더 재현·버전 기록

학생 기록 버전은 **student-22-preview.1(검증 중)**이다. 제공 on-client package 버전은 **0.2.14**, 개인 ChatGPT package는 **0.1.0**이다. 이 문서의 버전은 제공 서버나 package 버전을 바꾸지 않는다. 실제 운영 연결과 19단계 원천 집행은 미완료이며 v1.0으로 발행하지 않는다.

## 제출 소스와 확인 수준

- 저장소: https://github.com/SKT-ALEPH/choi-bujang-secret-vault · 브랜치: main.
- 출발 커밋: `9d72fa22ff8179c79d0d0cb69e502484aa459c07`(21단계 공식 원문 심사 통과). 아래 사전 실행은 이 커밋의 **별도 Git clone**에서 했다.
- 최종 커밋: 이 문서·상대 경로의 13~16 합성 검사·원문 해시 목록을 포함해 커밋한 뒤, **그 40자리 SHA 자체**를 새 폴더로 받아 다시 확인하고 같은 SHA를 포털에 제출한다. 실제 식별자는 제출 화면과 새 사본의 `git rev-parse HEAD` 출력이다. 커밋 안에 자기 자신의 SHA를 만들어 적지 않는다.
- 실행 원문: [STUDENT_RELEASE_SOURCE.json](STUDENT_RELEASE_SOURCE.json)에 224개 실행·설정·시험 파일의 SHA-256을 기록했다. 묶음 지문은 `a2c04a2ef59f5bf13cd6d313f59eea2f0b0050e7eb65d14c6c7ef1b0dc478392`다. 문서는 지문 대상에서 제외하며, 문서 수정과 실행 코드 수정을 구별한다. 최종 사본의 해당 파일 모두가 이 목록과 같은지 검사한다.
- 이전 단계별 통과 커밋은 **역사 기록**이다. 과거의 서로 다른 통과 결과를 최종 커밋 전체의 실행 성공으로 합산하지 않는다. 이번 실행 결과는 아래 범위에 한정한다.
- ALEPH의 22단계 판정은 AI가 원문과 이 학생 기록의 일관성을 읽는 심사다. 서버가 명령을 실행했다는 증거가 아니며 운영 인증·실집행·제품 안전성 인증이 아니다.

## 환경과 이동 가능한 실행 순서

2026-10-23 사전 확인: macOS 26.5.1 / arm64 / Node.js v24.19.0 / npm 11.19.1 / Git 2.49.0 / Codex 내장 브라우저. 새 운영체제 설치가 아닌 **같은 Mac의 새 빈 작업 폴더**다. 기존 Mac 앱5191과 Windows 작업 폴더·자격·자료는 그대로 보존했다. Windows 새 PowerShell 실행은 [21단계 설명서](STUDENT_RUNBOOK.md)의 기존 관측이며, 이번 Mac 실행을 Windows 재현으로 쓰지 않는다.

다른 사람도 접근 가능한 경로만 선택하고, 아래 `$commit`에 포털에서 확인할 **실제 40자리 최종 SHA**를 넣는다. 기존 폴더에서 초기화하거나 덮어쓰지 않는다. 다음은 PowerShell의 새 사본 준비 절차이며, 이번 Mac에서는 같은 Git 명령을 터미널에서 실행했다.

```powershell
$commit = '<포털에 제출할 실제 40자리 SHA>'
git clone https://github.com/SKT-ALEPH/choi-bujang-secret-vault.git keshev-reproduce
Set-Location keshev-reproduce
git checkout --detach $commit
git rev-parse HEAD
git status --short
node --version
```

출력 SHA와 입력 SHA가 같고 작업 트리가 깨끗한지 확인한다. 런타임은 Node24.19.0을 사용한다. 재현 시각·OS·아키텍처·버전을 새 기록에 남긴다. 설치하지 않은 환경을 지원한다고 쓰지 않는다. Git 복제는 추적 소스만 가져오며 `.env`, `.local`, node_modules, 외부 자격 저장소와 운영 데이터를 복사하지 않는다.

1. **직원 앱 실행**: `on-client`에는 외부 npm 의존성과 lock이 없으므로 별도 설치가 필요 없다. 해당 폴더에서 실행한다.

```sh
node src/server.mjs --demo
```

기본 주소는 http://127.0.0.1:5189/ 이다. 이번에는 기존 앱을 보존하기 위해 Mac 터미널에서 `ON_PORT=5198 node src/server.mjs --demo`로 실행하고 http://127.0.0.1:5198/ 을 확인했다. Windows는 같은 앱 폴더에서 `powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\start-alekov.ps1 -Demo -Port 5198`을 사용할 수 있으며, 이번 새 폴더 검사는 Windows에서 이 명령을 다시 실행한 것은 아니다. 공식 계정 연결을 준비하는 기본 옵션과 `-NoNativeHost`의 차이는 21단계 설명서를 따른다.

2. **화면 확인**: 보호 현황 → 다시 불러오기 → 업무 앱에서 세 앱 각각 접속 요청 → 보안 기록에서 종류 필터·event-01 상세 → 원본 기록과 AI·대응 도구 → AI 설명 요청 → 보호 현황의 도움정보 불러오기·AI 연결 점검·설치 패키지 조회를 직접 누른다. 아래 표의 예제·미연결 결과와 구분한다. 새 계정 승인이나 실제 유료 모델 요청·조치 집행은 이 절차에 포함하지 않는다.
3. **종료·재시작**: 실행 터미널의 Ctrl+C로 **이번 서버만** 종료한다. 이번 관측은 종료 후5198 연결 거절을 확인했다. 같은 폴더에서 `ON_PORT=5198 node src/server.mjs`로 다시 실행하고 브라우저를 새로고침해 연결 없음과 이전 예제 제거를 확인했다. 마지막에는 이 서버도 Ctrl+C로 종료했다. Windows Background 종료 방법은 21단계 설명서를 따른다.
4. **합성 계약 검사**: 저장소 루트에서 다음을 실행한다. 직원 앱의 운영 연결을 만들지 않고 DOM·오류·세대·근거 결속·조치 상태·OSV 부분 결과를 검사한다. 개인 검사는 실제 OAuth·모델 호출 대신 주입된 대역 클라이언트를 쓴다.

```sh
cd personal-ai
npm ci
cd ..
node --test test/on-client-stages13-16.test.mjs test/on-client-stage17.test.mjs test/on-client-stage18.test.mjs test/on-client-stage19.test.mjs test/on-client-stage20.test.mjs personal-ai/server.test.mjs
```

9개 시험이 통과했다. 13~16은 기존 격리 DOM 검사를 저장소 안으로 옮겨 상대 경로로 실행한다. 17~20과 개인4시험은 같은 저장소의 현재 구현을 읽는다. 시험 sentinel은 실행 중 생성하고 실제 자격·외부 요청을 쓰지 않는다. 이전 폴더에만 있는 검사나 인증 파일을 가져올 필요가 없다.

기존1~12·XDR의 시험까지 실행하려면 **루트에서 별도로** `npm ci`가 필요하다. 사전 새 사본에서는 루트13개, personal-ai9개 설치가 끝났다. 루트 npm은 esbuild 후설치 승인 안내를 냈으며 이번 화면·계약 검사에는 그 빌드 스크립트가 필요 없어 추가 승인하지 않았다. npm의 감사 결과를 20단계 실제 OSV 조회 성공으로 쓰지 않는다.

## 단계별 관측

아래 시각은 한국시간 2026-10-23, 별도 사본의 사전 브라우저 관측이다. 최종 제출 사본에도 같은 실행 코드 지문·합성 검사와 시작/종료/재시작을 대조한다. 결과 칸은 **운영 연결 기준**이고 예제 표시는 비고에 분리했다.

| 단계 | 확인한 기능 | 결과 | 확인 시각 | 근거·비고·미확인 원인 |
|---|---|---|---|---|
|13|보호 현황·신원/기기/세션·다시 불러오기|연결 없음|18:00~18:04|demo에서는 practice-user/PC/active와 unknown 표시를 관측. 실제 본인 신원은 호스트 미연결. 합성 검사에서는 갱신·이전 값 제거·빈 목록·독립 오류 통과|
|14|세 앱 접속 요청·판정 이유와 시각|연결 없음|18:01:23~24|예제 자료에서 library allow / repository deny / approval challenge. 실제 업무 앱 접속이나 운영 판정 재현이 아님. unknown/예상 밖 값/요청 실패는 합성 검사로 구분|
|15|기록 필터·event-01 상세·근거·규칙|연결 없음|18:01~18:02|예제 access 1건/e-01/rule-01/denied/active/unknown 확인. 실제 XDR 수집·본인 기록 수신 없음. 종류·앱·상태·빈 목록·오류는 합성 검사|
|16|알림·도움정보·실패와 재시도|연결 없음|18:02~18:04|DEMO_ONLY 도움정보와 미연결 오류 안내 관측. 합성 검사에서 만료·빈 화면·시간 초과·복구·안전한 수동 복사·미지원 조치 확인. 운영 진단 전달은 하지 않음|
|17|AI 연결 점검·안전한 오류|확인 불가|18:02:02|실제 화면 ON_AI_PROVISIONING_PENDING. 합성 검사에서 한도·권한·취소·초기화·수동 회복 구분. 이번 새 폴더에서 공식 AI나 개인 유료 응답 재호출 안 함|
|18|사건 설명 요청·기록 보존|확인 불가|18:01~18:02|권한 미준비 오류, 기존 예제 기록 유지. 같은 코드의 합성 검사에서 근거/규칙 결속·불일치 거절·unknown 확인. 운영 사건의 실제 설명 미확인|
|19|미실행·조치 미지원·효과 판정 경계|확인 불가|18:01~18:02|원천 supportedActions 없음/집행 버튼 비활성/idle 관측. 합성 ACK≠효과·재전송·영수증·실패·만료 검사 통과. 실제 집행은 제공 원천 미지원|
|20|설치 패키지 조회·미설정 구분|확인 불가|18:02:02|PROJECT_NOT_CONFIGURED/not_configured 관측. 합성 검사에서 정확한 버전·출처·시각·부분 오류 유지. 실제 승인 프로젝트·OSV 외부 조회 없음|
|21|설명서대로 설치·시작·브라우저·종료·재시작|재현됨(로컬 실행 절차)|18:00~18:04|새 폴더의 demo/기본 실행·loopback·정상 시작 신호와 연결 거절 확인. 이 행은 실행 절차이며 운영 연결 성취가 아님|

17단계의 과거 개인 OAuth 실제 응답·취소 관측은 [개인 모드 안내](../../personal-ai/README.md)의 별도 역사다. 이번 새 폴더의 합성 시험을 실제 모델 응답으로 표시하지 않는다.

### 전체 저장소 검사와 남은 제한

사전 사본에서 `node --experimental-vm-modules --test test/*.test.mjs personal-ai/server.test.mjs`는 **91개 중89통과·2실패**였다. 전체 통과나 운영 제품 완료로 기록하지 않는다.

- `test/package-starter.test.mjs`: 원본 패키징 기준표가 API 두 개만 기대하지만 기존 자료실 API가 추가되어 목록 불일치. 루트 README에도 기록된 기존 미완료 범위다. 기준표나 이전 API를 지워 통과로 맞추지 않았다.
- `test/stage12-sandbox.test.mjs`: Git에서 제외한 `bundle-notes.json`이 새 사본에 없어 ENOENT. 별도 배포/제출 자기점검 준비물이 필요한 시험이다. 원래 폴더의 제출 메모·비밀 설정을 복사하거나 실제 HTTP 증거를 꾸며 넣지 않았다. 22단계 직원 앱 검사의 선행 설치 명령이 아니다.
- 13~16 검사 추가 후 전체 범위를 다시 실행할 경우 총 시험 수는1개 늘어난다. 위91개는 추가 전 실제 관측이며, 위 두 항목의 성공을 주장하지 않는다.

운영 SDP·XDR, 공식 native 계정/AI 승인, 현재 운영 사건의 AI 설명, 실제 조치 집행/효과 재조회, 승인 프로젝트의 실제 OSV 대조, Windows 새 사본 브라우저와 다른 OS 지원은 **기다림(UNV)**이다. 다른 커밋의 공식 심사·모의 결과로 이 항목을 채우지 않는다.

## 데이터 보존·백업·복구 계획

이번 재현은 새 사본의 가상 데이터만 사용한다. 원래 작업 폴더·기존 실행 앱·외부 자료실 DB·계정·자격 저장소를 삭제·초기화·이동하지 않았다. 소스와 데이터·자격은 각각 다른 보존 대상이다.

| 대상·실제 코드 경계 | 보존·백업 | 복구 순서·제한 |
|---|---|---|
|추적 소스·학생 문서·lock·버전|원본은 커밋/push로 보존. Git 밖 개인 보관 위치에서 `git bundle create keshev-source.bundle HEAD`와 `git bundle verify`로 오프라인 소스 백업 가능|새 빈 폴더에 bundle 또는 origin을 clone → 기록한40SHA checkout → `git status`/원문 해시 대조 → 재설치·실행. bundle은 Git 추적 내용만 포함하며 DB·미커밋 파일·계정 복구가 아님|
|on-client 화면과 예제|`src/engine.mjs`의 예제와 UI 상태는 운영 자료가 아니다. 화면의 필터·선택·AI 결과는 재시작 시 새로 불러옴|서버 재시작 → 신원과 기록 다시 조회. 이전 화면 성공을 현재 상태로 복구하지 않음|
|운영 SDP/XDR 사건·학생 데이터|원천 호스트가 소유. 브라우저·이 저장소·Git clone이 로그 백업을 대신하지 않음. 원천 담당자가 허용한 암호화 백업·접근/보관 정책 필요|원천 담당자 절차로 별도 복구 환경 확인 → 현재 계정/프로젝트 범위와 기록 건수/시각 확인 → 본인 조회만 재연결. 이번 작업에서 실제 원천 백업·복원 미실행|
|자료실 Supabase notes/공지/기기/복구 데이터|기존1~12 DB와 RLS·서버권한은 보존. 담당자가 DB와 스키마/정책을 함께 안전한 별도 위치에 백업; CSV/JSON을 Git에 올리지 않음|먼저 별도 프로젝트에서 정책·소유자 접근·익명 거부 확인 후 승인된 복구 절차 사용. 운영 DB 덮어쓰기·권한 확대·기존 데이터 삭제를 자동 실행하지 않음. 이번 DB 복원 미실행|
|조치 SQLite 원장(`src/actions/store.mjs`)|명시적으로 제공된 기존 DB에 intents/state/audit를 추가하는 계약. 현재 기본 실행은 미지원이며 새 DB를 임의 생성하지 않음. 호스트 관리자가 일관된 SQLite 백업을 책임짐|열린 DB 파일 하나만 무작정 복사하거나 intent/audit를 지워 초기화하지 않음. 복구 후 원천 효과/영수증을 먼저 대조하고 결과만 재조회. 백업 복구를 집행 재전송으로 사용하지 않음. 실제 원장 복구 미확인|
|Windows native 설정/앱 자격|프로젝트 밖 사용자별 호스트 registry/vault, Windows 보호·신원 결속. Git·제출물·공개 백업에서 제외|새 경로·PC에는 파일을 복사해 인증을 우회하지 않고 공식 계정 연결/앱 승인 재확인. 복구 권한·설정은 담당자 절차. 이번에는 읽거나 복사하지 않음|
|Mac 개인 OAuth 자격|프로젝트 밖 `~/Library/Application Support/Keshev Personal AI` 암호화 저장소와 별도 Mac Keychain 항목. 코드만으로 복원 불가|기존 계정 저장소를 원문으로 열거나 Git/bundle에 포함하지 않음. 새 Mac은 앱 실행 후 본인 OAuth 재승인. OS 백업을 사용할 때도 해당 사용자·Keychain 보호가 필요하며 이 문서는 복호화/이식 절차를 제공하지 않음. 새 폴더 검사는 기존 자격을 복사/변경하지 않음|

소스 백업만으로 실제 자료가 복구됐다고 보고하지 않는다. 운영 자료·자격 복구는 별도 미검증 작업이며, 담당자가 승인한 환경에서 검증한 뒤 그 시각·대상·결과를 추가한다. 원본을 되돌릴 때도 `reset --hard`나 폴더 덮어쓰기를 사용하지 않는다. 필요하면 새 폴더에서 이전 커밋을 확인하고 변경을 검토한다.

## 최종 제출 전 같은 커밋 대조

문서 저장 후 커밋을 고정한다. 최종40SHA로 다른 빈 폴더를 만들고 이 문서의 설치·검사·화면·종료·재실행을 반복한다. 다음은 저장소 루트에서 실행하는 원문 대조다. 값·자격을 출력하지 않고 파일 지문만 비교한다.

```sh
node --input-type=module - <<'JS'
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha = b => createHash('sha256').update(b).digest('hex');
const m = JSON.parse(await readFile('on-client/docs/STUDENT_RELEASE_SOURCE.json','utf8'));
for (const f of m.files) assert.equal(sha(await readFile(f.path)), f.sha256, f.path);
assert.equal(sha(m.files.map(f => f.path+'\0'+f.sha256+'\n').join('')),m.sourceDigest);
console.log('실행·시험 원문 '+m.files.length+'개 일치');
JS
```

위 here-document는 Mac 터미널 명령이다. Windows는 같은 JavaScript를 별도 임시 `.mjs` 파일에 저장해 `node <파일>`로 실행할 수 있으며, 그 변형 명령은 이번에 실행하지 않았다. 40자리 SHA·관측 시각·원문 지문·검사 로그·화면 증빙은 제출한 최종 커밋에 대응하는 별도 작업 기록으로 보관한다. 이 문서 밖의 로그를 서버가 직접 읽었다고 주장하지 않는다.

최신 포털의 21·22단계 직접 저장소·커밋 제출과 공식 원문 도구 순서를 따른다. 원문 수신과 AI 통과를 구별하고, 판정이 확인되지 않았으면 완료로 표시하지 않는다. 이 문서 작성 시점에 21은 공식 통과했고22는 제출 전이다. 이후 최종 판정은 포털 기록을 기준으로 확인한다.
