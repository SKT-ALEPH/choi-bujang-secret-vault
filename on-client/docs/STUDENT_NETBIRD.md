# 케셰브 · 개인 NetBird 실제 연동

> **현재 개인 통합 앱 실행:** 저장소 루트에서 `node personal-workspace/start.mjs`로 Mac과 Windows 업무 서버를 함께 켠다. ChatGPT 계정·자료·접근 판정·기록·조치의 최신 안내는 [개인 운영 설명서](../../personal-workspace/README.md)다. 아래 내용은 앞서 검증한 PC/NetBird 단독 개발 실행 기록이며, 같은 포트에 두 실행기를 함께 켜지 않는다.

## 왜 만들었나

인터넷에 공개한 자료실의 로그인 검사와 별도로, 허용된 두 기기 사이에만 통신하는 사설 경로를 만든다. Mac의 케셰브가 Windows의 확인용 자원에 실제로 요청하고, 정책을 끄면 요청이 실패하며 다시 켜면 복구되는 것을 확인한다. 이를 통해 **기기 등록 → 접근 정책 → 암호화된 기기 간 통신 → 실제 자원 응답**의 차이를 관찰한다.

## 이번에 구성한 것

- 공식 NetBird 0.81.4를 Apple Silicon Mac과 Parallels Windows ARM64에 설치했다. 공급자 서명과 공식 릴리스 SHA-256을 확인했다.
- 사용자가 승인한 GitHub 계정으로 NetBird Free에 등록했다. 계정 약관/이메일 읽기와 두 기기 등록/포트 접근 승인은 별도로 받았다. 비밀번호·등록 키·토큰을 소스에 넣지 않았다.
- 두 기기는 `keshev-mac`, `keshev-windows`이다. 각각 하나만 담는 `keshev-mac-client`, `keshev-windows-resource` 그룹에 배정했다.
- `Default` 전체 기기/전체 프로토콜 정책은 **비활성화**했다. 사용 정책은 **Mac 그룹 → Windows 그룹 / 단방향 TCP 54123** 하나이다. SSH·파일 공유·원격 데스크톱·라우팅·전체 포트 접근은 허용하지 않았다. DNS와 클라이언트/서버 경로 수신도 설치 연결 시 껐다. Mac은 inbound 차단이다.
- `student/netbird-resource.mjs`는 Windows 자신의 NetBird IPv4에만 바인딩한다. 지정한 Mac 주소에서 오는 `GET /keshev-health`만 처리한다. 파일·명령·사용자 자료는 제공하지 않는다. 응답은 고정 자원 이름과 응답 시각이다.
- Mac의 케셰브 **보호 현황 → NetBird 연결과 자원 확인**이 공식 CLI의 관리/신호 서버 상태·정책에 보이는 기기 수를 읽고, 지정된 Windows 자원으로 실제 HTTP 요청을 보낸다. WireGuard 터널이 두 기기 사이 전송을 암호화한다. HTTP 서버를 LAN/공개 주소에 열지 않는다.

## 무엇을 의미하지는 않는가

이 연동은 개인 NetBird 연결과 비민감 확인 자원에 대한 실제 접근이다. 기존 ALEPH `/api/me` 신원·mTLS/JWT·판정·XDR API를 NetBird 연결로 대체하지 않았다. 상단의 **ALEPH 연결 없음**과 별도 패널의 **NetBird 연결됨**은 서로 다른 연결을 뜻한다. 기존 Vercel 자료실은 사설망으로 이전하지 않았고 기존 인증/소유자 검사와 배포를 유지한다. 자원 응답이 PC의 안전·침해 탐지·모든 업무 앱 허용을 뜻하지 않는다.

## 다시 실행

공식 Node.js **24.19.0**, NetBird 두 기기 연결, 위 접근 정책이 필요하다. NetBird 관리 화면의 Peers에서 두 기기의 **NetBird IPv4**를 확인한다. 주소·키를 Git에 쓰지 않는다. 아래 대괄호 값은 자리표시자이며 실제 값으로 바꾼다. 기존 ALEPH 계정·native 설정을 수정하지 않는다.

Windows PowerShell, 개인 개발 사본의 `on-client` 폴더:

```powershell
$env:KESHEV_NETBIRD_CLIENT_IP='[Mac의 NetBird IPv4]'
node student/netbird-resource.mjs
```

이 터미널을 유지한다. 자원은 Windows의 현재 NetBird 주소를 공식 CLI에서 읽으며, 임의 바인딩/파일 경로/명령을 입력받지 않는다. 다른 포트를 열기 위해 Windows 방화벽을 끄지 않는다.

Mac 터미널, 저장소의 `on-client` 폴더:

```sh
KESHEV_NETBIRD_TARGET_IP='[Windows의 NetBird IPv4]' node student/start-daily.mjs
```

**http://127.0.0.1:5189/** → **보호 현황 → NetBird 연결과 자원 확인**을 누른다. 이 요청은 PC 상태를 자동 전송하거나 자동 폴링하지 않는다. 해당 버튼은 NetBird CLI를 조회하고 고정된 자원에만 요청한다. 앱 종료는 Ctrl+C이며 Windows 자원 터미널도 별도로 종료한다. 두 OS의 NetBird 시스템 서비스는 계속 실행한다. 재부팅 후에는 위 앱/자원 명령을 다시 실행한다. 자동 시작 작업은 등록하지 않았다.

Windows PC 대시보드는 별도 터미널에서 기존 `node student/start-daily.mjs`로 실행할 수 있다. 대상 주소를 지정하지 않은 Windows 대시보드의 자원 카드는 **대상 설정 전**으로 표시한다. Windows가 자기 자신에 응답한 것을 Mac→Windows 성공으로 세지 않는다.

## 정상 / 실패 확인

| 조건 | 확인한 결과 |
|---|---|
| 전용 정책 켜짐, 두 기기 연결, Windows 자원 실행 | Mac 케셰브에서 관리/신호 서버 연결, 기기 1/1, Windows 실제 응답 시각 확인 |
| 전용 정책 일시 꺼짐, 기본 정책도 꺼짐 | Mac의 같은 고정 주소 요청 시간 초과, 정책에 보이는 상대 기기 0. Windows 자원은 계속 실행됨 |
| 전용 정책 다시 켜짐 | 같은 요청 HTTP 200과 유효한 자원 응답으로 복구 |
| Windows 자원에 로컬 Windows 자신이 요청 | 허용 Mac이 아니므로 403. 바인딩만 확인하고 성공으로 세지 않음 |
| CLI 읽기 실패 / 대상 미설정 / 정책에서 상대가 안 보임 | 각각 확인 불가 / 대상 설정 전 / 상대 기기 확인 불가. 임의 허용·거부 판정 없음 |
| 다른 사이트·세션 없음·POST로 로컬 NetBird API 요청 | 403 또는 405. 자원/기기 조회 안 함 |

단순 요청 실패만으로 정책 거부라고 확정하지 않는다. 이번 차단 확인은 **정책 UI의 비활성화, 실제 요청 실패, 상대 자원 실행 유지, 정책 복구 후 동일 요청 성공**을 함께 대조했다. 권한 없는 다른 포트를 실제 스캔하지 않았다.

## 구현 경계와 검증 근거

- 공식 CLI `status --json`만 읽는다. NetBird native 설정·개인키·계정/토큰 파일을 읽지 않는다. 결과에는 주소·이메일·키·CLI 오류 원문을 내보내지 않는다.
- 자원 목적지는 실행 환경에서만 지정하며 CGNAT IPv4와 현재 NetBird peer 목록에 동시에 있어야 요청한다. 포트/경로는 고정, 리다이렉트 금지, 2.5초 제한·응답 2KiB 상한이다. 브라우저가 임의 주소·명령을 넘길 수 없다.
- 기존 실행기의 정확한 Host, 로컬 HttpOnly/SameSite 쿠키, same-origin 요청, 읽기 제한을 유지했다. 이 쿠키는 ALEPH 인증을 대신하지 않는다.
- Mac의 실제 UI/HTTP와 Windows 일반 사용자 CLI/HTTP를 검증했다. 정책 차단·복구 근거 및 설치 확인은 저장소 밖 `artifacts/final-assault-2026-10-26/`에 보관한다. 이 개인 연결을 심판 통과나 공식 설치형 패키지로 보고하지 않는다.
- `node --test test/final-assault-netbird.test.mjs test/final-assault-pc.test.mjs test/final-assault-connections.test.mjs test/on-client-stages13-16.test.mjs test/on-client-stage17.test.mjs test/on-client-stage18.test.mjs test/on-client-stage19.test.mjs test/on-client-stage20.test.mjs`를 저장소 루트에서 실행한다. 자동 시험과 실제 연결 확인은 별개다.

공식 참조: [CLI](https://docs.netbird.io/get-started/cli), [그룹·접근 정책](https://docs.netbird.io/manage/access-control), [macOS 설치](https://docs.netbird.io/get-started/install/macos), [Windows 설치](https://docs.netbird.io/get-started/install/windows).
