# 케셰브 개인 ChatGPT 연결

개인 학습용 로컬 실행 모드입니다. OpenAI의 **Sign in with ChatGPT**로 본인 계정을 새로 연결합니다. ALEPH 수업용 AI 연결과 별개이며, 이 모드의 성공은 17단계 공식 통과를 뜻하지 않습니다. 기존 과제 파일·자료실·판정·보안 규칙은 변경하지 않습니다.

## 실행

Mac, Xcode Command Line Tools와 Node.js 24.19 이상이 필요합니다. 이 폴더에서:

```sh
npm ci
npm start
```

http://127.0.0.1:5191 을 엽니다. 최초 실행 시 작은 Mac 키체인 암호화 도구를 컴파일합니다. 포트 충돌 시 `KESHEV_PERSONAL_PORT=5192 npm start`로 실행합니다.

1. **AI 도우미**의 **계정 및 연결 설정**을 펼쳐 **Continue with ChatGPT** → **OpenAI 로그인 화면 열기**를 누릅니다.
2. OpenAI 공식 화면에서 본인 계정과 워크스페이스를 선택하고 이 앱의 ChatGPT 사용 권한을 검토합니다. 별도의 API 키를 입력하지 않습니다.
3. 원래 앱으로 돌아와 연결된 계정을 확인합니다. 로그인만 성공하고 AI 이용 권한이 없으면 설명 요청을 허용하지 않습니다.
4. **모델 불러오기** 후 모델을 직접 선택합니다. 설정 안의 **실제 응답 점검**은 짧은 모델 요청을 실행합니다. 목록 조회만으로 추론 성공이라고 표시하지 않습니다.
5. 입력 내용을 검토한 뒤 **AI 설명받기**를 누릅니다. 오른쪽에 설명이 표시됩니다. **로그인 실패 예시 넣기**는 입력란에 가상 사례만 넣으며 자동 전송하지 않습니다. 실제 보안 기록을 자동으로 수집하거나 전송하지 않습니다.

이용량은 본인 ChatGPT 계정의 한도에 반영됩니다. 계정별 모델·지원 여부는 실제 응답으로 확인합니다. [사용량과 앱 권한 관리](https://chatgpt.com/settings/usage)에서 확인할 수 있습니다.

## 보관과 경계

- 자격 정보는 `~/Library/Application Support/Keshev Personal AI`에 공식 SDK가 암호화해 저장합니다. 암호화 키는 이 앱 전용 Mac 키체인 항목에 있습니다. 브라우저나 Git에 토큰을 저장하지 않습니다.
- 기존 Codex·ChatGPT·ALEPH의 자격 파일을 읽거나 복사하지 않습니다. 이 앱의 별도 OAuth 등록을 사용합니다.
- 공식 SDK가 PKCE/state/nonce, ID 토큰 검증, 계정별 등록, 갱신, 해제를 처리합니다. 모델 요청은 공개 Responses API에 `store:false`, `stream:true`로 보내며 완료 이벤트까지 확인합니다.
- 앱은 `127.0.0.1`에만 열리고, 개인 경로에 Host·Origin·SameSite/HttpOnly 세션 검사를 적용합니다. 같은 Mac 사용자 권한을 가진 프로그램으로부터 완전히 격리하는 보안 경계는 아닙니다.
- 계정 변경·해제·취소 후 이전 결과를 폐기합니다. AI는 설명만 반환하며 보안 판정이나 대응 명령을 실행하지 않습니다.
- `npm test`는 HTTP 경계와 생명주기를 대역 클라이언트로 검증합니다. 실제 OpenAI 로그인·추론과 구분합니다. 실행 중 종료는 Ctrl+C입니다.

## 공식 SDK 출처

`vendor/siwc-local`은 [OpenAI 공식 devkit](https://github.com/openai/sign-in-with-chatgpt-devkit)의 `@siwc/local`을 원본에서 빌드한 복사본입니다. 출처 커밋과 파일 해시는 `vendor/provenance.json`, 라이선스와 의존성 고지는 SDK 폴더에 있습니다. SDK는 비상업적 용도의 라이선스이며 이 통합도 개인 학습용으로 작성했습니다.

[공식 연결 안내](https://developers.openai.com/siwc/token-sharing-open-source/sign-in) · [모델과 추론](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)

## 17단계 구성

[요구사항과 검증 대조](STAGE17.md)에 개인 OAuth의 구현 범위와 공식 연결과의 차이를 기록했습니다. 인증·권한·사용 한도·요청 제한·네트워크·시간 초과·취소를 구분하며 재요청은 수동입니다. 전체 요청은180초로 제한하고 취소·계정 변경 후 늦은 응답을 폐기합니다. 입력이 바뀌면 이전 설명을 지우고, 성공한 설명에 수동 입력 ID를 표시합니다. 이 ID는 운영 SDP 사건 ID가 아닙니다.
