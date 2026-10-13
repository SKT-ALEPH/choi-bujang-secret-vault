# 6단계 문제 제약 RULE

출처: 2026-10-13 ALEPH 방어전의 3차 침공 6단계 상세 안내를 직접 확인. 구현 전 DECIDER_REQUEST.md를 읽었다.

- R-S06-COMPLETE: 구현·로컬 검사·실제 배포 신원·bundle 모두 완료 후 제출하고 심판 결과를 별도로 확인한다. 로컬 연습을 실제 mTLS 방어 성공으로 보고하지 않는다.
- R-S06-CONTRACT: 엔진이 확인한 aleph.decision.v1의18필드만 사용한다. subjectId는 엔진 가명 주체이고 Supabase UUID와 비교하지 않는다. deviceRegistered는 엔진 확인 불리언이다. 브라우저 임의 역할/기기 필드를 추가하지 않는다. 응답5필드와 requestId 보존.
- R-S06-POLICY: RULE_IDS에 device_registered를 등록한다. deviceRegistered===true인 자료실 읽기만 allow, 미등록·누락·비불리언은 deny·device_not_registered. 나머지 범위는 기본 거부를 유지한다. 신규 권한/역할/기기서명 로직을 지어내지 않는다.
- R-S06-SECRETS: 인증서·CA·개인키·서명키를 만들거나 공유하지 않는다. 따로 설치할 접속 프로그램은 없다. 비밀번호·JWT·메모 원문·실제 개인정보를 로그·Git·묶음에 넣지 않는다.
- R-S06-PRESERVE: 기존 자료실 주소/화면, Auth·소유자 검사·직접DB 권한 회수, XDR 두 모듈과 실제 서버 연결, judgeIssuer는 보존한다. 과거 XDR 작업의 기본판정기 불변은6단계 전 범위이며 이번 사용자 지시로 기기 규칙만 확장한다. 기존 XDR guard의 deny/step_up 보존 성질은 유지한다.
- R-S06-VERIFY: npm run decider:test에서 등록 allow·미등록 deny를 확인하고 누락/문자열/다른서비스/쓰기 거부와 XDR 합성도 점검한다. README에 실행 순서·시험 범위를 기록한다. 미등록 인증서·mTLS·주체불일치 실제 공격은 심판 검증과 구분한다.
- R-S06-SAVE: 6단계 저장점 커밋, config.step=6과 배포 커밋·저장소 일치 확인 후 npm run bundle. 비밀값 검사 후 공개 파일을 커밋하며 생성 묶음은 제외한다. cold 고정본 보존.
- R-S06-WORK: 작업 트리·단위 기록 유지, 압축 때 재상기. 필수 실제 blocker만 중단하고 하위 작업 다음 단계는 자동 진행. 전체 트리와 최종 검증 통과 전 임시 기록 폐기 금지.

## 계약의 두 핵심 값
subjectId: 운영 엔진이 발급자·대상·반·프로젝트를 검증해 만든 가명 사용자 식별자다.
deviceRegistered: 운영 엔진이 확인한 기기 등록 상태다. 실제 릴레이는 미등록 기기를 판정기보다 먼저 차단하고 심판의 가상 요청은 false를 전달할 수 있다.
