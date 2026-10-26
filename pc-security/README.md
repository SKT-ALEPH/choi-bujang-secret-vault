# 기존 케셰브의 PC 감시

기존 자료실·계정·NetBird·Agent를 유지하면서 Mac과 Windows의 Wazuh 감시를 연결한다. PC 관측을 특정 Supabase 사용자의 행동으로 추정하지 않는다. 새 자료실이나 별도 사용자 앱을 만들지 않는다.

## 실제 경로

공식 Wazuh 4.14.9 에이전트 → Mac의 전용 Wazuh manager → 기존 케셰브 **보호 현황 → 두 PC의 감시와 송신 차단**. Wazuh는 시스템 기록, 기본 설정의 중요 경로 파일 무결성, 설치 프로그램·프로세스·네트워크 구성을 수집한다. 모든 사용자 파일의 내용이나 모든 디렉터리를 감시하는 설정은 아니다.

Windows의 별도 SYSTEM 센서는 Microsoft TraceEvent 4.0.0으로 커널 TCP/UDP 송신 메타데이터를 읽는다. Mac의 root 센서는 기본 제공 `nettop`의 소켓 송신량을 표본 관측한다. 120초 안에 같은 미승인 목적지·포트·프로토콜로 50,000,000바이트 이상, 서로 다른 연결 5개 이상을 관측하면 Wazuh 규칙 100121이 해당 기기의 native active response를 실행한다.

차단 범위는 그 목적지·포트·프로토콜이다. Windows는 Windows Firewall, Mac은 기존 `com.apple/*` 아래의 독립 PF anchor를 쓴다. 기본 방화벽·NetBird 정책을 끄거나 전체 PF 상태를 지우지 않는다. 차단 기한은 900초다. root/SYSTEM 원천 근거를 대조한 뒤 실제 OS 규칙을 읽어 성공 여부를 확인한다. 재시작 시 Wazuh의 조기 delete는 기한 전에 적용하지 않고, 센서도 만료를 재확인한다.

기존 OpenAI 업무에 필요한 `chatgpt.com`, `ab.chatgpt.com`, `auth.openai.com`, `api.openai.com`은 현재 DNS로 확인된 주소의 443번만 예외다. 1분마다 조회하고 5분이 넘은 결과는 신뢰하지 않는다. 다른 주소·포트나 임의 도메인을 예외로 만들지 않는다. 정상 ChatGPT 송신이 대량 지표만으로 차단된 실제 오탐을 확인한 뒤 사용자 관리자 적용으로 추가했다. 이 예외는 DNS/IP 기준이며 TLS 호스트·내용 검사가 아니다. 같은 CDN 주소를 공유하는 다른 서비스까지 구분할 수 있는 DLP로 주장하지 않는다. 다른 정상 업무의 대량 송신도 승인 목적지 정책 검토가 필요하다.

## 현재 PC에서 실행

Node 24.19.0으로 저장소에서 `node personal-workspace/start.mjs`를 실행하고 [기존 케셰브](http://127.0.0.1:5189/)를 연다. 시작기는 이미 설치된 전용 manager를 준비한다. 공식 에이전트와 센서는 OS 서비스/예약 작업으로 실행된다. Docker가 내려가면 화면은 확인 불가로 바뀌며 이전 정상 상태를 재사용하지 않는다.

처음 설치는 현재 장비와 설치 경로를 확인한 뒤 다음 순서다. 이 파일들만 복제해 모든 PC에 무인 설치되는 패키지로 주장하지 않는다. setup.exe는 만들지 않는다.

1. 공식 패키지의 버전·SHA512·공급자 서명을 확인하고, 전용 `setup-manager.py`로 manager를 준비한다.
2. .NET 10 SDK로 `dotnet publish pc-security/windows-sensor/Keshev.Sensor.csproj -c Release -r win-arm64 -o .local/pc-security/windows`를 실행한다.
3. Windows 관리자 채널에서 `setup-windows.ps1`을 적용한다. 해당 경로의 자체 센서·대응 프로그램만 갱신하고 둘의 해시가 같은지 검사한다. PowerShell 실행 정책은 바꾸지 않는다.
4. Mac 사용자가 `sudo /bin/bash pc-security/setup-macos.sh`로 관리자 인증한다. 암호를 코드나 채팅에 입력하지 않는다. `configure_macos.py`는 Wazuh 고유의 raw `&&` 명령문을 보존하고 연결 블록과 자체 로그 경로만 수정한다.

manager 등록 포트 1514/1515는 루프백과 현재 Parallels 사설 브리지에만 게시한다. 기존 자료실은 계속 NetBird TCP 54123을 이용한다. Docker API·Wazuh API·새 인터넷 포트를 공개하지 않는다. 기존 자료실이 연결됐다는 증거는 이 등록 포트의 연결 여부와 별개다.

## 데이터와 상태

- 서버의 Wazuh 원문은 이 Mac의 전용 Docker volume에 있다. 앱에는 허용한 시각·규칙·수치·기기 가명·현재 상태만 내보낸다. 계정명·목적지 주소·파일 경로·원문 설명을 내보내지 않는다.
- 센서는 패킷 본문·명령행·파일 내용을 수집하지 않는다. 기본 Wazuh 로그에는 OS 자체 로그의 계정·경로 등이 포함될 수 있으며, 원문을 외부 AI로 보내지 않는다. 기존 자료실 AI 동의 범위를 PC 원문 전송 동의로 확대하지 않는다.
- 등록 비밀은 Git에서 제외된 `.local/pc-security/`와 endpoint 전용 보호 파일에만 둔다. Mac은 root:wazuh 읽기, Windows는 SYSTEM/Administrators ACL을 적용한다. CA 개인키는 manager 밖으로 내보내지 않는다.
- 과거 대응 영수증과 현재 OS 상태를 구분한다. 현재 상태 관측이 45초를 넘으면 확인 불가로 표시한다. 조회 버튼은 이전 자료를 비우고 다시 읽으며, 자동 해제 예정 시각을 현재 해제 성공으로 표시하지 않는다.

## 검증 범위와 한계

실제 검증에는 두 기기 등록, inventory/FIM 수집, Windows 중요 경로의 비민감 시험 파일 추가·제거, 생성한 바이트를 상대 사설 기기로 송신, Wazuh 경보, OS 차단, 같은 포트 거부·옆 포트 허용, 서비스/manager 재시작, 원래 기한의 자동 복구를 포함한다. 원래 자료실의 정상 인증·기기 승인·자료 조회 및 동일 증명의 직접 Vercel403/NetBird200도 다시 확인한다. 최신 결과는 `docs/PC_SECURITY_VERIFICATION.md`를 본다.

Mac의 표본 관측은 짧은 연결을 놓칠 수 있다. PF는 새 연결을 막으며 이미 열린 연결의 강제 종료를 보장하지 않는다. 이 구현을 모든 외부 유출을 방지하는 DLP, 내용 검사, 모든 악성 프로그램의 제거, 전체 PC 재부팅 시험 완료로 표현하지 않는다. Wazuh indexer·취약점 탐지 모듈은 이번 manager에 구성하지 않았으며 기존 프로젝트 OSV 조회와 구분한다.

시험 수신기는 `verify-egress.mjs`이고 지정 사설 주소·58443/58444·상대 기기만 받는다. 사용자 파일을 보내지 않으며 크기/시간 제한이 있다. 검증 후 자체 수신 프로세스와 Windows 시험용 inbound 규칙을 제거한다. 실제 인터넷 수신지로 자료를 보낸 시험은 하지 않는다.

## 중지와 복구

정상 차단은 기한이 지나면 해제된다. 원인을 확인하지 않고 방화벽 전체를 끄거나 전체 PF 상태를 삭제하지 않는다. Windows의 관리자용 `keshev-sensor.exe recover <사건 UUID>`는 현재 대응의 사건과 일치할 때만 자체 규칙을 해제하며, 다른 사건의 과거 복구 명령은 거부한다. 이것은 앱의 Supabase 접근 복구 버튼과 다른 범위다.

manager는 `docker stop keshev-wazuh-manager` / `docker start keshev-wazuh-manager`로 중지·복구한다. volume을 지우면 등록·감사 정보가 사라지므로 삭제하지 않는다. 센서는 Windows `KeshevSecuritySensor` 작업과 Mac `app.keshev.pc-security` LaunchDaemon이다. Mac 센서는 PF가 비활성이면 자체 enable 참조를 다시 확보하고, 미만료 자체 규칙을 복원할 때 원래 해제 시각을 유지한다. 실제 전원 재부팅 시험은 수행하지 않았으며, 기존 Apple wildcard anchor가 없는 환경을 자동으로 덮어쓰지 않는다.

공식 자료: [Wazuh 패키지](https://documentation.wazuh.com/current/installation-guide/packages-list.html), [active response 계약](https://documentation.wazuh.com/current/user-manual/capabilities/active-response/custom-active-response-scripts.html), [Windows 에이전트](https://documentation.wazuh.com/current/installation-guide/wazuh-agent/wazuh-agent-package-windows.html), [Mac 에이전트](https://documentation.wazuh.com/current/installation-guide/wazuh-agent/wazuh-agent-package-macos.html), [Microsoft TraceEvent](https://github.com/microsoft/perfview).
