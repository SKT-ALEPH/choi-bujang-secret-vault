# 12단계 요구사항 대조표

2026-10-14(한국시간) ALEPH 12단계의 전체 접힌 안내를 읽은 기준. 영구 RULE은 STAGES7-12_RULES.md의 R-S12 항목이다.

| 요구 | 구현 | 검증 근거 |
|---|---|---|
| 실제 판정 규칙 요약 | operationsReport → RULE_IDS | API rules와 화면 숫자/문자열 대조 |
| 탐지 사건·회수 상태 | 고정120/121사건 detect 실행 + 실제 회수 뒤 자료 거부 영수증 | 가상 사건/실제 API 표시를 구분. 제공 엔진 집행은 심판 범위 |
| 복구 버전 | loadSafePolicy 사본/고정SHA 검증, 실제복원 요청 영수증 | 정책 verified/버전과 복원200/타인404 |
| 본문 미표시·서버 기록 일치 | config/operations-verification.json의 허용 항목만 공개 | requestId/checkedAt/상태만 기록, UI textContent와 모든 행 대조 |
| 1~11 정상·금지 요청 표 절차 | runDeviceCheck(step12) 기록 + src/stage12-check.mjs | 11단계 모두 normal/forbidden, 기대/실제/서버ID/시각 완전성 검사 |
| 41종 미실행 구분 | fullAssault total41/executed0/passednull/statusnot_run | 대표 회귀 숫자를41종 통과로 사용하지 않음 |
| 검사커밋·설치·실행·중지·복구 | README 12단계 절, sourceHashes | 새 사본 npm install와 소스해시 대조 |
| 학생/제공 엔진 출처 | README/작전실 설명 | ALEPH SDP 엔진 출처 및 책임 범위 명시 |
| 기본 판정기 계약 보존 | 원본 decider/verify-login/judgeIssuer 보존 | 빈VM/18필드/5필드/RULE_IDS 기존 보안 시험 |
| 단계12 저장점/bundle/실제 심판 | aleph.config step12,20항목(19GET 관측+쓰기not_run1) | 배포커밋 일치·실패시중단·실제100은 별도판정 |

실측 원본은 Git 제외 public/stage12-live-proof.json에 생성된다. 성공/정리/영수증/단계 커버리지가 모두 확인된 기록만 공개용 config/operations-verification.json에 옮긴다. 현재 운영 DB 전체의 사건/사용자 현황을 조회한 것으로 표현하지 않는다.
