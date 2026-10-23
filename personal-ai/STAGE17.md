# 17단계 · 개인 OpenAI OAuth 구현 대조

## 범위와 결과

사용자 요청에 따라 ALEPH 수업용 게이트 대신 **Sign in with ChatGPT**를 쓰는 개인 학습용 실행 모드를 구성했다. 공식 17단계의 원래 입력 계약과 학생 함수는 보존한다. 개인 OAuth에 ALEPH의 `audienceAuthorization: verified` 또는 `test`를 부여하지 않는다. 개인 응답은 항상 `provider: personal-chatgpt`, `alephApproved: false`다.

최신 포털의17 전체 안내와 제공 문서 `on-client/docs/STUDENT_PROMPTS.md`의17, `AI_SETUP_GUIDE.md`를 읽고 대조했다. 포털은 운영 수업용 연결을 요구하고 대체 연결 추가를 허용하지 않는다고 적고 있다. 개인 연결 요청은 구현했지만 이 차이의 공식 수용과 심판 통과는 확인되지 않았다. **이 문서는 공식 조건 전체 충족이나 제출 완료 증명서가 아니다.**

## 필수 기준 대조

| 공식 기준 | 구현·확인 근거 | 개인 연결에서 확인한 범위 |
|---|---|---|
| student-source-changed | `on-client/student/extension.mjs`의 두17 함수, `test/on-client-stage17.test.mjs` | 공식 입력의 idle/loading/ok/error, 안전한 오류·기본 설명 표시 회귀 통과 |
| ai_transport_checked | `personal-ai/server.mjs` models, `public/personal.js` | 실제 계정 모델7개, 모델 수·시각 표시. 목록을 추론이나 사건 설명 성공으로 표시하지 않음 |
| ai_model_called | 서버 check/explain, 완료 이벤트 확인은 공식 SDK | GPT-6-Luna 실제 응답과 가상 로그인 실패 기록 설명 확인. 수동 입력 ID를 응답에 결속. 운영 SDP 사건 자동 연결은 아님 |
| ai_auth_error | 서버 `safeError`, UI 오류 영역 | 인증 만료·앱 권한·이용 자격을 안전한 한국어/코드로 구분. 대역 HTTP 검증 |
| ai_limits | 사용 한도·rate limit·서비스/네트워크/timeout 분류 | ChatGPT 한도와 요청 빈도 제한을 구분. 반 예산·수업 시간은 개인 OAuth에 없는 정책이므로 만들어 표시하지 않음 |
| ai_manual_recovery | 버튼으로만 models/check/explain | 실제 취소 뒤 목록 재조회와 설명 성공. 자동 추론 재시도 없음 |
| ai_generation_reset | 서버 generation/profile 검증, UI epoch/statusEpoch | 계정 변경·해제·입력 변경·모델 변경·목록 재조회·취소 시 이전 결과 폐기. 계정 경계는 대역, 입력 변경은 실제 UI 확인 |
| secret_absence | Keychain 암호화와 프로젝트 밖 저장, 서버 오류 화이트리스트 | 브라우저/소스/Git에 자격 정보 없음. 원문 SDK 오류·응답진단은 외부 응답에서 제외. 비밀값 형태 검사와 원본 해시 별도 확인 |
| ai_timeout_cancel | 전체 요청180초, AbortSignal+race, 최종 공개 전 재검증 | 실제 요청 취소 UI 확인. 취소를 무시하는 대역의 늦은 응답 폐기·전체 timeout·수동복구·동시요청 거부 시험 통과 |

## 역할 구분

- Workbench 수업용 AI: 학생이 코드를 작성하는 개발 도구다.
- 앱 안 개인 ChatGPT: 사용자가 검토해 입력한 내용을 OpenAI에 보내 설명을 받는다. 접근 승인·차단·대응 명령을 실행하지 않는다.
- ALEPH 과제 판정 AI: 제출한 저장소 커밋을 과제 기준과 대조하는 외부 심판이다. 개인 앱의 응답 성공과 다르다.

## 재실행과 검증

Mac에서 `cd personal-ai && npm ci && npm start` 후 http://127.0.0.1:5191/ 에서 사용한다. 계정 설정 → Continue with ChatGPT로 본인 권한을 승인한 뒤 모델을 불러와 직접 선택한다. 연결만 보려면 실제 응답 점검, 기록을 설명받으려면 입력 검토 후 AI 설명받기를 누른다. 가상 예시 버튼은 자동 전송하지 않는다.

저장소 루트에서 `node --test personal-ai/server.test.mjs test/on-client-stage17.test.mjs`를 실행한다. 자동 시험5개는 대역/DOM 회귀 시험이며 실제 OpenAI 확인은 별도다. 실제 한도 소진이나 자격 정보 훼손을 유발하는 시험은 하지 않았다. 원격 push·배포·공식 제출·공식 판정은 수행하지 않았다.

실제 결과 증빙은 공개 Git에서 제외한 작업 폴더 `artifacts/personal-stage17/`에 보존한다. 로그인 정보나 자격 파일은 증빙에 포함하지 않는다.
