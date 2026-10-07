# XDR-02 웹 입력 조작 RULE

출처: 2026-10-07 ALEPH 보너스 「웹 주입 공격을 잡아 냅니다」 제작1~5·제출 전 확인. 사용자는 전체 구현·배포·검증·제출을 승인했다.

- **R-X02-COMPLETE**: 실제 Jev·저장·추가 거부 연결·배포·동작 검증까지 끝낸 뒤 제출한다. 인터페이스/모의 시험/대체 응답만으로 완성이라 하지 않는다.
- **R-X02-TREE**: 작업/하위 작업 트리와 각 단위의 구현·검증·근거를 임시 작업 문서에 기록한다. 압축 후 다시 읽는다. 하위 완료는 대화 종료가 아니다. 전체 트리와 최종 end-to-end가 통과해야만 임시 문서를 폐기한다.
- **R-X02-INPUT**: 원본 fixture는 보존한다. 읽기 모듈은 시각·출발 주소·가명 계정·규칙 수준·설명 5필드만 반환하며 건수 동일, 비밀값 제거. 원본과 추출형 모두 같은 판정. ID·배열 위치 암기 금지.
- **R-X02-PATTERN**: MITRE T1190 근거로 SQL 구문·스크립트 삽입·경로 이탈·명령 구분자 주입을 기록한다. 패턴별 이름·조건·근거 한 줄 필수. 단어 select/script/up 또는 따옴표만으로 명확한 공격이라 하지 않는다.
- **R-X02-DECIDE**: decide(alert) → {action,confidence,reason}, 확신도 .85 이상 block/.5 이상 alert/미만 record. 명확한 반복 공격은 block, 애매한 것은 Jev, 정상은 record. Jev 오류·형식 오류·시간 초과·미설정은 alert. 원본 입력을 Jev로 보내지 않고 수치/불리언만 전달한다.
- **R-X02-REPEAT**: 같은 신뢰된 출발 주소의 반복 근거가 있어야 차단 후보가 된다. 구현 정책은 120초 내 8회 이상 명확한 주입이다. 반복 없는 AI 높은 점수는 .84 상한으로 알림에 남긴다. 이 수치는 과제의 임의 정답이라고 주장하지 않고 구현 정책으로 공개한다.
- **R-X02-PORTABLE**: decide.mjs는 외부 import·파일·process·fetch·TextEncoder·AbortController·timer가 없는 빈 격리 VM에서도 전체 경보를 처리해야 한다. 원본 analyze와 생성 평가기를 함께 커밋한다.
- **R-X02-GUARD**: 추가 거부만 적용하며 기존 deny/step_up 보존. 기존 src/decider.mjs·verify-login.mjs·judgeIssuer 및 18필드 계약 불변. 후보는 만료(15분)·근거 경보 ID를 포함하고 만료 시 미적용. 운영 IP는 Vercel이 덮어쓰는 서버 헤더만 신뢰한다.
- **R-X02-PRIVACY**: 키·JWT·비밀번호·사용자 메모·원본 URL/IP/이메일을 Git/로그/제출/AI에 남기지 않는다. 후보 fixture의 연습 IP와 ID는 가상임을 표시한다. 운영 상태는 HMAC 출발 주소·숫자·UUID만 저장한다. 인증 비밀번호/토큰 본문을 주입 감지 입력으로 사용하지 않는다.
- **R-X02-VERIFY**: fixture 실행(result.json), 정상 차단0, 후보 재생·만료·저장 장애·빈 VM·회귀, 실제 Jev 응답 및 실제 HTTP 거부/복귀를 구분해 검증한다. 실시간 Wazuh 수집/PC 방화벽/미래 반 엔진까지 설치됐다고 주장하지 않는다.
- **R-X02-SUBMIT**: 결과 재생 후 「보너스 xdr-02 저장점」으로 커밋한다. 키 검색0·clean·원격/배포 커밋 일치 후 배포/공개 저장소 주소 제출. 심판 접수와 성공 판정 구분. 첫 오류는 원인을 재현한 뒤 수정한다.

근거: [MITRE ATT&CK T1190](https://attack.mitre.org/techniques/T1190/), [TypeSafe 공식 API](https://docs.typesafe.ai/api), [Vercel 요청 헤더](https://vercel.com/docs/headers/request-headers). T1190은 공개 앱 악용의 범주이며 정규식이 모든 취약점을 탐지한다는 보장은 아니다.
