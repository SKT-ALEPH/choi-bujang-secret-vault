// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions }) {
      const root = document.createElement('section');
      const deviceStates = { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' };
      const sessionStates = { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' };
      const stateText = (value, labels) => `${labels[value] ?? labels.unknown} (${value ?? 'unknown'})`;
      const text = (parent, value, tag = 'p') => {
        const node = document.createElement(tag);
        node.textContent = value;
        parent.append(node);
        return node;
      };
      for (const [name, resource] of [['현재 계정', me], ['등록 기기', devices], ['현재 세션', sessions]]) {
        const section = document.createElement('section');
        root.append(section);
        text(section, name, 'h3');
        text(section, { demo: '예제 자료 (demo)', connected: '서버 연결 모드 (connected)',
          disconnected: '연결 없음 (disconnected)' }[resource?.mode] ?? '연결 상태 확인 불가 (unknown)');
        if (resource?.status === 'loading') {
          text(section, '불러오는 중');
        } else if (resource?.status === 'error') {
          text(section, `연결 실패 · 확인 불가: ${resource.error?.message ?? '정보를 불러오지 못했습니다.'}`).setAttribute('role', 'alert');
        } else if (resource?.status === 'ok' && name === '현재 계정' && resource.data) {
          const { user, device, session } = resource.data;
          text(section, `사용자: ${user?.label ?? '확인 불가'} · ID: ${user?.id ?? '확인 불가'}`);
          text(section, `현재 기기: ${device?.label ?? '확인 불가'} · ID: ${device?.id ?? '확인 불가'} · ${stateText(device?.status, deviceStates)}`);
          text(section, `현재 세션: ${session?.id ?? '확인 불가'} · ${stateText(session?.status, sessionStates)}`);
        } else if (resource?.status === 'ok' && Array.isArray(resource.data)) {
          if (resource.data.length === 0) text(section, name === '등록 기기' ? '등록된 기기가 없습니다.' : '현재 연결이 없습니다.');
          for (const item of resource.data) {
            text(section, name === '등록 기기'
              ? `기기: ${item.label ?? '확인 불가'} · ID: ${item.id} · ${stateText(item.status, deviceStates)}`
              : `세션: ${item.id} · ${stateText(item.status, sessionStates)}`);
          }
        } else {
          text(section, '현재 정보를 확인할 수 없습니다.');
        }
      }
      return root;
    },
    renderDecision() { return '학생 구현 대기: 서버의 판정과 이유를 연결하세요.'; },
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
