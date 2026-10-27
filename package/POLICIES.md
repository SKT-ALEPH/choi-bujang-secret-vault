# 실제 검문소·탐지 규칙

| 구현 규칙·위치 | 대상과 거부 | 검증·근거 |
|---|---|---|
| `starter.deny`, `device_registered`, `step_up_required`, `resource_scope` / `src/decider.mjs` | 원래18필드 입력·5필드 결과. 미등록/구역 밖 거부, 복합 신호 추가 확인, 미제공 신호를 정상으로 만들지 않음 | 기존 단계·`test/stage6.test.mjs` 등. 현재 배포 전체의 실연동 완료와 구분 |
| 원본 JWT·소유자 원자 필터 / `api/notes.js`, `api/my/notes.js` | 무로그인401, 타인 조회/수정/삭제404, 본문 owner 위조400 | 기존 실제 A/B 검사와 NetBird 통합 증거; 현재 브랜치 회귀 별도 기록 |
| 서비스 전용 DB 권한 / `sql/stage5-revoke.sql` | 자료·권한 DB에 브라우저 직접 접근 거부 | `anon`/`authenticated` 권한 및 실제 유효 신원 검사. 키 없는401을 유효 anon 검사로 보고하지 않음 |
| 기기 승인·P256·nonce / `src/device-session.mjs` | 미승인·재사용·변조·다른 사용자 기기 증명403 | 기존 기기/자료 통합 검사 |
| NetBird 단방향 TCP54123 + `src/netbird-gateway.mjs` | 지정 Mac→Windows만, 공개 API의 직접 우회·서명 재사용403 | 같은 유효 증명 직접403/NetBird200의 기존 실측; 최신 배포 재검증은 SELF-CHECK |
| 기존 XDR6종 / `xdr/` | 무차별 로그인·입력 조작·알려진 CVE·지속성·권한 상승·유출의 원래 입력/판단 계약 유지 | 실제 지원 원천/Agent 조치와 순수 판정기 시험 구분. OS의 모든 사건을 사용자 신원에 임의 결속하지 않음 |
| 사용자별 서버 AI 상한 / `api/ai.js`, `sql/package-services.sql` | 검증된 사용자·UTC일별 기본30. 한도 초과429, DB 장애503. 실패한 상류 요청도 횟수 소비 | 실제 PostgreSQL35동시요청30허용/5거부·재시작 보존·역할 거부 확인. 실제 클라우드200→429는 SELF-CHECK |
| 공식 침해 정보 / `src/threat-intel.mjs` | 고정 NVD/KEV만; arbitrary URL·중복 쿼리 거부. 소스 오류를0건/안전으로 대체하지 않음 | 공식 실제 수신 기록 및 캐시·시간·실패 경로 시험 |
| PC 송신 규칙 / `pc-security/` | 미승인 목적지·포트·프로토콜120초5연결/50MB. 해당 경로900초 차단·기한 복구 | 두OS 실측·Wazuh/서비스 재시작·정상 서비스 예외 검증. [실제 기록과 한계](../docs/PC_SECURITY_VERIFICATION.md) |

화면 경고 건수는 공격 판정이 아니다. AI 확신도는 접근 판정이 아니다. 버전 대조/KEV는 현재 침해의 증거가 아니다. 조치 결과는 원천 재조회와 원래 해제 시각으로 확인한다. 가상 입력 시험·예전 심판100점·현재 브랜치 실측을 서로 바꾸어 보고하지 않는다.
