# 케셰브 로컬 서버 중심 구성

기존 자료실에 **접근자 → 서버 A ↔ 서버 B → 같은 서버 A → 웹서버** 경로를 추가한다. 새로운 B 평가가 필요한 요청은 결과가 돌아오기 전 웹서버에 전달하지 않는다. B는 필요한 경우에만 AI를 사용하며 A가 최종 집행한다.

## 실행 배치

| 주체 | 로컬 구성 |
| --- | --- |
| 접근자 | 기존 자료실 화면. 로컬 진입점 `http://127.0.0.1:5289/`은 접근자 NetBird 피어를 통해서만 A로 전달한다. 접근 결정 기능은 없음 |
| 서버 A | Linux 컨테이너의 NetBird 피어, 게이트웨이, 현재 권한 검사, 요청별 B 응답 검증, SQLite 제한·예산·감사 큐, 공식 Wazuh 에이전트 |
| 서버 B | 별도 Linux 컨테이너의 NetBird 피어, 인증된 평가·사건 수집, XDR, Wazuh 등록 레지스트리, AI 중계, 중앙 감사 기록 |
| 웹서버 | 기존 Vercel 자료실 API·Supabase Auth·DB. 기존 로그인·기기 서명·자료 소유권과 공지 편집 권한·본인 메모 백업 복원 유지 |
| AI | OpenAI 모델. 로컬 OAuth 전송 어댑터는 Mac Keychain의 기존 인증을 사용하며 자격을 컨테이너로 복사하지 않음 |

NetBird의 Management·Signal·Relay는 별도 로컬 관리형 컨테이너로 구성한다. 기존 Mac·Windows의 클라우드 NetBird 망은 변경하지 않는다. 접근자→A TCP8080과 A→B TCP8091만 허용하며 기본 전체 허용 정책은 이 로컬 망에서 제거한다. A/B 앱은 NetBird 주소에만 바인딩하고 B의 업무 포트는 Mac에 공개하지 않는다.

기존 `keshev-wazuh-manager`와 그 볼륨은 보존한다. 새 Linux A의 에이전트를 해당 manager에 등록하고 B는 관리자 볼륨의 **alerts 하위 경로만 읽기 전용**으로 연결한다. 레지스트리에 등록된 회사 A 에이전트의 정해진 메타데이터만 사용한다. 기존 직원 Mac·Windows의 상태를 A의 권한 근거로 사용하지 않는다.

`setup-manager-monitor.mjs`는 관리자 컨테이너의 [Wazuh Command 모듈](https://documentation.wazuh.com/current/user-manual/reference/ossec-conf/wodle-command.html)에 고정된 상태 확인 명령을 등록한다. 등록된 회사 에이전트의 연결 상태·최종 수신 시각만 10초마다 원자적으로 게시하고 B는 이를 읽기 전용으로 확인한다. 정책 v2에서는 게시가 30초, 에이전트 수신이 90초보다 오래되거나 연결을 확인하지 못하면 위험을 `unknown`으로 처리해 자료 제공을 거절한다. 이 값은 로컬 검증용이다. 기존 에이전트 키는 보존하며 새 자동 등록은 닫아 이전 직원 기기의 등록 비밀번호로 서버 A를 대체하지 못하게 한다. 신규 회사 서버 등록은 운영자가 명시적으로 준비해야 한다.

## 보호 경로

1. A는 고정 API·메서드·크기·헤더만 허용하고, 웹서버의 서명된 게이트웨이 컨텍스트 경로에서 로그인·현재 기기 승인·자료 권한을 매 요청 확인한다. 기존 기기 nonce는 실제 작업 때 한 번만 소비한다.
2. A는 요청·주체·세션·접속 자격·자료·정책·본문 지문을 결속해 B에 평가를 요청한다. 원문 메모·토큰·비밀번호·IP는 B의 평가 입력이나 AI에 전달하지 않는다.
3. B→A 응답은 별도 서버 키로 서명한다. A는 출처·nonce·요청 지문·정책·대상·기한을 검사하고 현재 권한을 다시 조회한다. 낮은 위험은 권한 부여나 기존 차단 해제 명령이 아니다.
4. 원자적 SQLite 예약으로 동시성·누적 제공량을 확보한 뒤, A가 최대 자료 건수까지 결속한 v2 경유 증명을 발급한다. 웹서버가 소유권을 최종 검사한다.
5. 웹서버는 직접 만든 처리 결과에 서명한다. A는 이를 B에 전달하고 B의 검증·수신 확인 후에만 응답을 제공한다. A·B의 감사 기록에는 메모 본문과 인증값을 저장하지 않는다.
6. 보안 제한 복구 요청은 검토 접수이며, 직원 화면에서 차단을 직접 해제하지 않는다. 기존 **본인 메모 백업 복원** API와 보안 차단 해제는 별개다.

과제 판단기 계약과 기존 Windows 망·자료는 보존한다. 자료실·공지·백업 복원·기기 등록·게이트웨이 컨텍스트는 `centralRequiredPaths`에 선언해 **중앙 A 키만 수락**한다. 직원 Windows에 남아 있는 이전 키로 이 경로를 우회할 수 없다. 이전 키는 기존 Auth·과제용 AI·위협 정보 호환 경로에만 남으며 자료실의 새 진입점은 `5289`다. 새 중앙 경로에서는 이전 웹 XDR의 공유 egress IP 차단 대신 A의 NetBird 접속 주체별 로그인 제한 및 B의 검증된 사용자·세션·자원별 제한을 적용한다. 임의 요청 헤더만으로 이 경로를 선택할 수 없다.

## 시작과 관리

Docker Desktop과 기존 Wazuh manager가 켜진 상태에서 저장소 루트의 Node24로 실행한다.

```sh
node server-security/bootstrap.mjs
docker build -t keshev-server-security:local -f server-security/Dockerfile .
docker compose --env-file .local/server-redesign/runtime/compose.env -f server-security/compose.yaml up -d server-a server-b accessor
node server-security/finish-setup.mjs
node server-security/setup-manager-monitor.mjs
```

`finish-setup`은 A의 **공개키만** 기존 웹서버의 신뢰 설정에 추가한다. 새 경로가 검증되기 전 기존 Windows 공개키를 폐기하지 않는다. 변경한 웹 API와 공개키는 기존 Vercel 프로젝트에 배포해야 한다. 첫 로그인·기기 승인은 기존 자료실 계정과 공식 인증 흐름을 사용한다.

비밀번호를 모르는 경우 로컬 자료실에서 본인 이메일을 입력하고 **로그인 메일 받기**를 누른다. 메일의 인증 링크 또는 코드를 넣고 **인증 완료**를 누르면 같은 이메일의 정상 인증 세션만 연결한다. 신규 계정은 **가입 메일 받기**로 준비한다. 비밀번호를 임의 재설정하거나 이메일 확인을 건너뛰지 않는다. 메일 요청 수락은 수신·로그인 완료를 의미하지 않으며, 화면 세션은 브라우저 종료 후 보존하지 않는다.

기존 OAuth 연결의 로컬 전송 어댑터는 Mac에서 별도로 실행한다.

```sh
node server-security/oauth-risk-bridge.mjs
```

이 어댑터의 실제 모델 검증은 영속 저장된 **1회 상한**을 사용한다. 이미 사용한 상한을 자동 초기화하지 않는다. 추가 상시 AI 사용량과 중앙 서버용 인증 방식은 운영 배포 전에 별도로 정한다. 필수 AI가 불가하면 해당 요청은 거절된다. 정상 요청이 AI를 항상 호출하는 것은 아니다.

현재 제한 목록은 운영자의 Docker 콘솔에서만 확인한다.

```sh
docker compose --env-file .local/server-redesign/runtime/compose.env -f server-security/compose.yaml exec -T server-a node server-security/control.mjs list
```

검토 후 특정 제한만 해제하려면 `recover <restriction-id> --confirm-local-operator`를 사용한다. 해제 응답은 승인 사실만 기록하며, 실제 자료 요청이 다시 성공해야 복구 검증이 끝난다. 로컬 Docker 콘솔 소유자 권한은 회사 관리자 계정의 MFA를 대신하지 않는다.

복구 승인은 A의 제한 갱신·감사·전송 큐를 같은 트랜잭션에 저장하며 B에도 서명된 `recovery-approved` 사건으로 전달한다. 이는 승인 기록이며 실제 자료 복구 성공 기록과 구분한다. 본인 메모의 백업 복원은 기존 **최초 버전 1** 계약을 따르며 최신 편집본으로 바뀌지 않는다.

로컬 접근자 피어의 연결 복구가 필요하면 저장 볼륨을 보존한 채 `docker compose --env-file .local/server-redesign/runtime/compose.env -f server-security/compose.yaml up -d --force-recreate --no-deps netbird-accessor accessor`로 피어와 전달자를 함께 재연결한다. 단절 중에는 보호 자료가 반환되지 않아야 하고, 재연결 후 실제 자료 조회까지 성공해야 복구다.

## 보존과 검증 범위

운영 정책으로 오해하지 않도록 `policy.local.json`의 수치와 임계값은 로컬 검증용으로 명시했다. A/B 개인키는 각자의 전용 Docker 볼륨에만 생성한다. 로컬 NetBird 비밀과 설정은 Git에서 제외된 `.local/server-redesign/runtime/`에 둔다. 감사 보관본은 B의 별도 볼륨에 AES-GCM으로 암호화하며 복원에 B의 보호된 키가 필요하다.

동일 Mac의 Docker는 기능 검증 환경이다. Mac 관리자에게서 A/B를 분리하지 못하며 서버 A의 관측도 Linux 컨테이너 범위다. 독립 회사 서버, 관리자 MFA, 별도 장비의 감사·키 보관, 운영 부하·보존·AI 예산을 검증하기 전 기업 운영 보안 경계가 완성됐다고 표시하지 않는다. 기존 과정의 제출 승인 기록은 새 설계의 검증 증거가 아니다.
