# 기존 케셰브 통합 실행기

현재 통합 수정의 정본은 [기존 자료실·XDR·Agent의 NetBird 연결](../on-client/docs/STUDENT_NETBIRD.md)이다. 기존 자료실의 실제 차단·복구 검증과 원천별 관측 범위는 정본에 기록했다. 이전 별도 개인 경로의 완료 보고를 이번 통합 검증으로 재사용하지 않는다.

```sh
node personal-workspace/start.mjs
```

정확한 Node 24.19.0, 기존 Mac/Windows NetBird 등록·단방향 TCP54123 정책·Parallels Windows 사용자 로그인이 필요하다. http://127.0.0.1:5189/ 에서 **원래 Agent**를 열고, ‘기존 자료실 열기’로 원래 자료실에 접근한다. ChatGPT OAuth는 AI에만 사용한다.

이 디렉터리의 이름과 Windows SQLite 경로는 이미 저장된 감사·기기 권한·영수증과 예전 실험 자료를 보존하기 위해 유지한다. 예전에 추가한 별도 노트 화면과 `/workspace/api/notes`는 현재 업무 자료 경로로 제공하지 않는다. 기존 Supabase 메모와 사용자는 그대로 유지한다.

현재 단계·검증 결과·미완료 조건과 실행 경계는 위 정본 문서를 따른다. GitHub 배포나 심판 통과를 추정하지 않는다.
