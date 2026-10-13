# XDR-03~06 영구 RULE
근거: 2026-10-14 ALEPH 각 과제 모든 접힌 안내 정독. 원문은 루트 artifacts/xdr-remaining/*-guide.txt. 사용자의 전체완료/지속진행/요구조건완전충족 지시 적용.

1. R-X36-READ: 각 과제 모든 안내를 읽고 요구별 코드/검증/판정을 대조한다. 미검증/미구현 상태 제출 금지. 한 과제 실제 만점 전 다음 과제 구현 금지(known-cve 표시 배점120, 상세 정규화100 여부는 실제판정 확인).
2. R-X36-PURE: xdr/<key>/decide.mjs는 export decide(alert) 독립 파일이며 import/파일/네트워크/환경변수/타이머/Node·웹도우미에 의존하지 않는다. 패턴상수는 파일 맨 위에 포함하고 patterns.json과 대조한다. 빈 ECMAScript VM 실행을 시험한다.
3. R-X36-OUTPUT: {action,confidence,reason}만 반환. 유한0~1 confidence, >=.85 block, >=.5 alert, 나머지record. reason은 근거패턴 이름 한 줄, 개인정보/원문을 넣지 않는다.
4. R-X36-EVIDENCE: 공식 fixture 수정/ID·정답·배열순서 하드코딩 금지. CVE/MITRE에 근거한 다중신호로 명확/애매/정상 구분. 심각도/기법코드만으로 공격 확정 금지. 정상오탐0 및 근거·ID·순서 변경 검사. 알려진취약점 문서구문은 다른 시스템에 전송하거나 실행하지 않는다.
5. R-X36-READER: Wazuh→시각/출발주소/계정/규칙수준/설명 5필드 읽기, 원본건수=읽은건수. 비밀값제거. decide는 reader를 import하지 않는다. 추가 정밀필드가 필요한 모듈은 원본/5필드의 관찰가능 정보차이를 명시하고, 추출에서 사라진 강한근거를 가짜로 복원하지 않는다.
6. R-X36-RESPOND: respond.mjs에서만 파일저장/알림/차단연결. 차단후보만 만료시각+근거경보ID로 추가deny. 애매/정상차단 금지. malformed규칙/신뢰값누락은 성공으로 취급하지 않는다. 로그/공개result에는 원본주소·계정·비밀값 금지, 규칙저장은서버전용.
7. R-X36-COMPOSE: src/decider.mjs 기존RULE_IDS/원본verify-login/judgeIssuer/18입력·5응답/deny·step_up/메모·공지·기기·복구·DB·기존XDR 보존. 신뢰된 서버측 경보와 요청대상만 연결하며 브라우저가 추가한IP·계정·기기·목적지 신뢰 금지. 출발지/PC/계정세션/목적지의 격리 대상을 구분한다.
8. R-X36-CHECK: 원본재생→응답저장→실제 기본판정기 추가guard→거부/정상통과→만료복귀를 함께 확인. 로컬재생/실제HTTP/심판을 구분하고 PC방화벽·실시간Wazuh·제공반엔진 설치를 완료했다고 주장하지 않는다. 미래엔진설치를 임의 필수 blocker로 만들지 않는다.
9. R-X36-DEPLOY: result.json 재생갱신, README 동작/재현/한계, 비밀검사 후 지정 저장점 커밋/push. 원격·배포커밋일치와 기존보호HTTP확인 뒤 심판 제출. 실패는 첫 오류와 해당커밋으로 재현·수정·재검증한다.
10. R-X36-PERSIST: 전체트리·최종E2E·4종심사완료 전 임시문서보존, 압축마다 재상기. 하위완료 후 자동진행, 사용자입력이 필수인 실제blocker만 중단. 완료후 임시과정문서만폐기하고 RULE/코드/검증/판정/cold 보존.
