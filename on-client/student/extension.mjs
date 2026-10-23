// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions }) {
      const root = document.createElement('section');
      root.className = 'identity-view';
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
    renderDecision({ status, mode, data, error, appId }) {
      const root = document.createElement('section');
      root.className = 'decision-view';
      const text = value => {
        const node = document.createElement('p');
        node.textContent = value;
        root.append(node);
        return node;
      };
      text({ demo: '예제 자료 (demo)', connected: '서버 연결 모드 (connected)',
        disconnected: '연결 없음 (disconnected)' }[mode] ?? '연결 상태 확인 불가 (unknown)');
      if (status === 'idle') {
        text('업무 앱을 골라 접속을 요청하세요. 아직 판정을 요청하지 않았습니다.');
      } else if (status === 'loading') {
        text(`판정 확인 중 · 업무 앱: ${appId ?? '확인 불가'}`);
      } else if (status === 'error') {
        text(`판정 요청 실패: ${error?.message ?? '판정을 불러오지 못했습니다.'}`).setAttribute('role', 'alert');
        text('요청 실패는 접근 거부 판정과 다릅니다. 접근 허용 여부를 확인할 수 없습니다.');
      } else if (status === 'ok') {
        const labels = { allow: '접근 허용', deny: '접근 거부', challenge: '추가 인증 또는 확인 필요', unknown: '판정 확인 불가' };
        const decision = Object.hasOwn(labels, data?.decision) ? data.decision : 'unknown';
        root.setAttribute('data-decision', decision);
        text(`${labels[decision]} (${decision})`);
        text(`업무 앱: ${data?.appId ?? appId ?? '확인 불가'}`);
        text(`판정 이유: ${data?.reason ?? '확인 불가'}`);
        text(`판정 시각: ${data?.checkedAt ?? '확인 불가'}`);
        if (decision === 'allow') text('서버 정책상 접근 허용입니다. 실제 업무 앱 접속 성공 여부는 별도입니다.');
        if (decision === 'challenge') text('추가 확인이 필요합니다. 이 앱이 인증 절차를 대신 수행하거나 완료한 상태가 아닙니다.');
        if (decision === 'unknown') text('접근을 허용한 것으로 해석할 수 없습니다. 확인 후 직접 다시 요청하세요.');
      } else {
        text('판정 확인 불가 (unknown). 직접 다시 요청해 현재 상태를 확인하세요.');
      }
      return root;
    },
    renderEvents({ status, mode, data, error }) {
      const root = document.createElement('section');
      root.className = 'events-view';
      const text = (parent, value, tag = 'p') => {
        const node = document.createElement(tag);
        node.textContent = value;
        parent.append(node);
        return node;
      };
      text(root, { demo: '예제 자료 (demo)', connected: '서버 연결 모드 (connected)',
        disconnected: '연결 없음 (disconnected)' }[mode] ?? '연결 상태 확인 불가 (unknown)');
      text(root, '서버가 전달한 본인 최근 기록 최대 40건을 표시합니다. 저장된 XDR 경보이며 이 화면에서 새로 탐지하지 않습니다.');
      if (status === 'loading') {
        text(root, '보안 기록을 불러오는 중입니다.');
        return root;
      }
      if (status !== 'ok' || !Array.isArray(data)) {
        text(root, `기록을 불러오지 못했습니다: ${error?.message ?? '응답을 확인할 수 없습니다.'}`).setAttribute('role', 'alert');
        return root;
      }
      if (data.length === 0) {
        text(root, '표시할 기록이 없습니다.');
        return root;
      }
      const records = [...data].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      const kinds = { access: '접속 기록', xdr: 'XDR 경보' };
      const states = {
        access: { allowed: '접근 허용', denied: '접근 거부', unknown: '확인 불가' },
        session: { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' },
        device: { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' },
      };
      const stateText = (kind, value) => Object.hasOwn(states[kind], value)
        ? `${states[kind][value]} (${value})` : '확인 불가 (unknown)';
      const filters = {};
      for (const [name, key, read] of [
        ['기록 종류', 'kind', event => event.kind],
        ['업무 앱', 'appId', event => event.appId],
        ['접속 상태', 'access', event => event.state?.access],
      ]) {
        const label = text(root, name, 'label');
        const select = document.createElement('select');
        select.setAttribute('aria-label', name);
        for (const value of ['all', ...new Set(records.map(read).filter(value => typeof value === 'string'))]) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value === 'all' ? '전체' : key === 'kind'
            ? `${kinds[value] ?? '확인 불가'} (${value})` : key === 'access' ? stateText('access', value) : value;
          select.append(option);
        }
        select.value = 'all';
        select.addEventListener('change', () => draw());
        label.append(select);
        filters[key] = select;
      }
      const count = text(root, '');
      const list = document.createElement('ul');
      const detail = document.createElement('section');
      detail.setAttribute('aria-label', '선택한 보안 기록 상세');
      root.append(list, detail);
      const showDetail = event => {
        detail.replaceChildren();
        detail.setAttribute('data-student-event-detail', event.id);
        text(detail, `사건 ID: ${event.id}`, 'h3');
        text(detail, `업무 앱: ${event.appId || '앱 확인 불가'}`);
        for (const [title, entries] of [['근거', event.evidence], ['규칙', event.rules]]) {
          text(detail, title, 'h4');
          if (!entries?.length) text(detail, `${title} 정보가 없습니다.`);
          for (const entry of entries ?? []) text(detail, `${entry.id}: ${entry.text}`);
        }
        for (const [key, label] of [['access', '접속 상태'], ['session', '세션 상태'], ['device', '기기 상태']]) {
          text(detail, `${label}: ${stateText(key, event.state?.[key])}`);
        }
        for (const action of event.supportedActions ?? []) {
          const button = text(detail, `${action} 미지원`, 'button');
          button.type = 'button';
          button.className = 'btn';
          button.disabled = true;
          button.setAttribute('aria-disabled', 'true');
          text(detail, '아직 지원하지 않는 조치입니다. 조치 실행 연결은 준비 중입니다.');
        }
      };
      function draw() {
        list.replaceChildren();
        detail.replaceChildren();
        detail.removeAttribute('data-student-event-detail');
        const filtered = records.filter(event =>
          (filters.kind.value === 'all' || event.kind === filters.kind.value)
          && (filters.appId.value === 'all' || event.appId === filters.appId.value)
          && (filters.access.value === 'all' || event.state?.access === filters.access.value));
        count.textContent = `표시 ${filtered.length}건 / 받은 기록 ${records.length}건`;
        if (!filtered.length) text(list, '필터에 맞는 기록이 없습니다.', 'li');
        for (const event of filtered) {
          const row = document.createElement('li');
          row.setAttribute('data-student-event-id', event.id);
          text(row, `사건 ID: ${event.id} · 시각: ${event.at}`);
          text(row, `종류: ${kinds[event.kind] ?? '확인 불가'} (${event.kind}) · 업무 앱: ${event.appId || '앱 확인 불가'}`);
          text(row, event.summary);
          const button = text(row, `${event.id} 상세`, 'button');
          button.type = 'button';
          button.className = 'btn';
          button.addEventListener('click', () => showDetail(event));
          list.append(row);
        }
      }
      draw();
      return root;
    },
    renderStatus({ devices, sessions, notifications, diagnostics, mode }) {
      const root = document.createElement('section');
      root.className = 'status-view';
      const text = (parent, value, tag = 'p') => {
        const node = document.createElement(tag);
        node.textContent = value;
        parent.append(node);
        return node;
      };
      const modeText = value => ({ demo: '예제 자료 (demo)', connected: '서버 연결 모드 (connected)',
        disconnected: '연결 없음 (disconnected)' }[value] ?? '연결 상태 확인 불가 (unknown)');
      const states = {
        devices: { compliant: '보안 기준 충족', noncompliant: '보안 기준 미충족', unknown: '확인 불가' },
        sessions: { active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가' },
      };
      const stateText = (key, value) => Object.hasOwn(states[key], value)
        ? `${states[key][value]} (${value})` : '확인 불가 (unknown)';
      const failure = (parent, name, resource) => {
        const timeout = /TIMEOUT|TIME_OUT|DEADLINE/iu.test(resource?.error?.code ?? '');
        text(parent, `${name} 조회 실패${timeout ? ' · 시간 초과' : ''}: ${resource?.error?.message ?? '정보를 확인할 수 없습니다.'}`).setAttribute('role', 'alert');
        text(parent, name === '진단 정보'
          ? '연결 상태를 확인하세요. 진단 정보 다시 시도는 제공 화면의 도움정보 불러오기 버튼을 직접 누르세요.'
          : '연결 상태를 확인하세요. 다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요. 자동으로 다시 요청하지 않습니다.');
      };
      text(root, modeText(mode));
      for (const [key, name, resource] of [['devices', '기기 정보', devices], ['sessions', '세션 정보', sessions]]) {
        const section = document.createElement('section');
        root.append(section);
        text(section, name, 'h3');
        text(section, modeText(resource?.mode ?? mode));
        if (resource?.status === 'loading') text(section, `${name}를 불러오는 중입니다.`);
        else if (resource?.status === 'error') failure(section, name, resource);
        else if (resource?.status === 'ok' && Array.isArray(resource.data)) {
          if (!resource.data.length) text(section, key === 'devices' ? '등록된 기기가 없습니다.' : '현재 연결이 없습니다.');
          for (const item of resource.data) {
            text(section, `${key === 'devices' ? `${item.label ?? '기기 이름 확인 불가'} · ` : ''}ID: ${item.id} · ${stateText(key, item.status)}`);
            if ((key === 'devices' && item.status === 'noncompliant') || (key === 'sessions' && ['expired', 'revoked'].includes(item.status))) {
              text(section, '주의가 필요한 상태입니다. 현재 연결과 보안 상태를 확인하세요.');
            }
          }
        } else text(section, `${name}를 확인할 수 없습니다.`);
      }
      text(root, '세션 조회는 현재 검증된 연결 1건을 대상으로 합니다. 과거 세션 전체 목록이 아닙니다.');
      text(root, '알림', 'h3');
      if (!Array.isArray(notifications)) text(root, '알림 상태를 확인할 수 없습니다.');
      else if (!notifications.length) text(root, '주의할 알림이 없습니다.');
      else for (const notification of notifications) {
        text(root, `자료: ${notification.resource} · 코드: ${notification.code} · ${notification.message}`);
      }
      text(root, '도움 요청용 진단 정보', 'h3');
      const copy = text(root, '도움정보 복사', 'button');
      copy.type = 'button';
      copy.className = 'btn';
      copy.disabled = true;
      const copyStatus = text(root, '도움 요청에 필요한 정보만 직접 확인한 뒤 복사합니다. 자동으로 복사하거나 전송하지 않습니다.');
      copyStatus.setAttribute('aria-live', 'polite');
      if (diagnostics?.status === 'loading') text(root, '진단 정보를 불러오는 중입니다.');
      else if (diagnostics?.status === 'error') failure(root, '진단 정보', diagnostics);
      else if (diagnostics?.status === 'ok' && diagnostics.data) {
        const info = diagnostics.data;
        // Copy only this explicit allowlist, never the complete diagnostics object.
        const safeValue = value => typeof value === 'string' ? value : '확인 불가';
        const safe = { requestId: safeValue(info.requestId), component: safeValue(info.component), version: safeValue(info.version),
          checkedAt: safeValue(info.checkedAt), engine: { mode: safeValue(info.engine?.mode), code: safeValue(info.engine?.code) } };
        for (const [key, value] of Object.entries(safe)) {
          if (key !== 'engine') text(root, `${key}: ${value ?? '확인 불가'}`);
        }
        text(root, `engine.mode: ${safe.engine.mode ?? '확인 불가'}`);
        text(root, `engine.code: ${safe.engine.code ?? '확인 불가'}`);
        copy.disabled = false;
        copy.addEventListener('click', async () => {
          copy.disabled = true;
          try {
            await navigator.clipboard.writeText(JSON.stringify(safe, null, 2));
            copyStatus.textContent = '도움 요청용 진단 정보를 복사했습니다. 전달 전 내용을 확인하세요.';
          } catch {
            copyStatus.textContent = '복사하지 못했습니다. 화면의 도움정보를 직접 확인해 복사하세요.';
          } finally { copy.disabled = false; }
        });
      } else text(root, '진단 정보 확인 전입니다. 제공 화면의 도움정보 불러오기 버튼을 직접 누르세요.');
      return root;
    },
    renderVulnerabilities({ status, mode, data, error }) {
      const root = document.createElement('section');
      root.className = 'vulnerabilities-view';
      const text = (parent, value) => {
        const node = document.createElement('p');
        node.textContent = value;
        parent.append(node);
        return node;
      };
      text(root, {demo:'예제 자료 (demo)', connected:'서버 연결 모드 (connected)', disconnected:'연결 없음 (disconnected)'}[mode]
        ?? '연결 상태 확인 불가 (unknown)');
      if (status === 'idle') text(root, '설치 패키지 조회 전(idle)입니다.');
      else if (status === 'loading') text(root, '설치 패키지 조회 중(loading)입니다. 이전 표는 현재 결과가 아닙니다.');
      else if (status === 'error') {
        text(root, `조회 실패: ${error?.code ?? 'CONTRACT_MISMATCH'} · ${error?.message ?? '조회 결과를 확인할 수 없습니다.'}`).setAttribute('role', 'alert');
        text(root, '실패는 취약점이 없다는 뜻이 아닙니다. 이전 결과를 현재 결과로 표시하지 않습니다. 제공 화면에서 직접 다시 조회하세요.');
      } else if (status === 'ok' && data) {
        const labels = {
          complete: '모두 조회(complete) · 승인된 조회 범위의 결과입니다.',
          partial: '일부 조회 실패(partial) · 이미 받은 취약점 항목은 유지합니다.',
          not_checked: '아직 조회 안 함(not_checked) · 승인된 공개 조회 대상이 없어 미조회 상태입니다.',
          not_configured: '조회 대상 프로젝트 설정 필요(not_configured) · 담당자가 대상 경로를 준비해야 합니다.',
          unverifiable: 'lock 파일 확인 불가(unverifiable) · 설치 목록을 검증할 수 없어 조회 결과를 확인할 수 없습니다.',
        };
        text(root, labels[data.status] ?? `조회 확인 불가(${data.status ?? 'unknown'})`);
        for (const key of ['lockfileVersion', 'lockfileHash', 'checkedAt']) {
          if (data[key] != null) text(root, `${key}: ${data[key]}`);
        }
        if (data.code != null) text(root, `코드: ${data.code}`);
        const list = document.createElement('ul');
        root.append(list);
        for (const pkg of data.packages ?? []) {
          const row = document.createElement('li');
          row.setAttribute('data-student-package-name', pkg.name);
          row.setAttribute('data-student-package-version', pkg.version);
          text(row, `패키지: ${pkg.name} · 설치된 정확한 버전: ${pkg.version}`);
          const label = {known_vulnerabilities:'알려진 항목 있음',none_found:'알려진 항목 없음',unverifiable:'조회 확인 불가'}[pkg.status] ?? '조회 확인 불가';
          text(row, `${label} (${pkg.status})`);
          text(row, `출처(source): ${pkg.source}`);
          text(row, `패키지 조회 시각(checkedAt): ${pkg.checkedAt}`);
          if (pkg.status === 'unverifiable' && pkg.vulnerabilities?.length) text(row, '일부 확인·전체 조회 확인 불가. 받은 취약점 ID는 유지합니다.');
          if (pkg.status === 'none_found') text(row, '조회 시점과 조회 범위에서 알려진 항목이 없다는 뜻이며, 안전을 보장하지 않습니다.');
          for (const finding of pkg.vulnerabilities ?? []) text(row, `취약점 ID: ${finding.id} · 수정 시각(modified): ${finding.modified}`);
          list.append(row);
        }
        if (!data.packages?.length) text(root, '표시할 패키지 조회 결과가 없습니다. 미조회·확인 불가를 취약점 없음으로 해석하지 마세요.');
      } else text(root, '조회 결과를 확인할 수 없습니다. 직접 다시 조회하세요.');
      text(root, 'OSV는 알려진 취약점 정보입니다. 조회 결과만으로 패키지나 앱 전체가 안전하다고 보장할 수 없습니다.');
      return root;
    },
    renderAiConnection({ status, mode, data, error, checkedAt }) {
      const root = document.createElement('section');
      const text = value => {
        const node = document.createElement('p');
        node.textContent = value;
        root.append(node);
        return node;
      };
      text({ demo: '예제 자료 (demo)', connected: '서버 연결 모드 (connected)',
        disconnected: '연결 없음 (disconnected)' }[mode] ?? '연결 상태 확인 불가 (unknown)');
      text('다시 점검하려면 제공 화면의 「AI 연결 점검」(현재 API 연결 점검) 버튼을 직접 누르세요. 자동으로 다시 요청하지 않습니다.');
      if (status === 'idle') text('AI 연결 점검 전입니다. 이전 점검 결과는 현재 결과가 아닙니다.');
      else if (status === 'loading') text('AI 연결 점검 중입니다. 취소는 제공 화면의 취소 버튼을 누르세요.');
      else if (status === 'ok') {
        text({ test: '시험 연결 점검(test)', verified: '앱 권한 확인 후 점검(verified)' }[data?.audienceAuthorization]
          ?? '앱 권한 확인 불가');
        text(`응답 모델 수: ${data?.modelCount ?? '확인 불가'}`);
        text(`점검 시각: ${checkedAt ?? '확인 불가'}`);
        text('연결과 모델 목록만 점검했습니다. 사건 설명은 아직 실행하지 않았습니다. 보안 기록에서 사건을 선택해 별도로 요청하세요.');
      } else {
        text(`AI 연결 점검 실패: ${error?.code ?? 'AI_REQUEST_UNVERIFIED'} · ${error?.message ?? '현재 연결 결과를 확인할 수 없습니다.'}`).setAttribute('role', 'alert');
        const code = error?.code ?? '';
        if (['ON_AI_PROVISIONING_PENDING', 'ON_AI_AUTHORIZATION_CHANGED', 'AI_REQUEST_UNVERIFIED', 'SUBJECT_SCOPE_UNVERIFIED'].includes(code)) {
          text('권한 준비 중이거나 계정·앱 권한을 확인할 수 없습니다. 학생 코드의 잘못으로 단정하지 않으며 담당자에게 계정 연결과 앱 권한 준비를 요청하세요.');
        } else if (code === 'WB_CLCO_AUTH_REQUIRED') text('인증 실패입니다. 계정 연결과 앱 승인을 다시 확인하고 담당자에게 문의하세요. 열쇠를 직접 입력하거나 복사하지 마세요.');
        else if (code === 'WB_CLCO_ACCESS_BLOCKED') text('AI 접근이 제한됐습니다. 담당자에게 현재 이용 권한과 운영 상태를 확인하세요.');
        else if (['WB_CLCO_COHORT_BUDGET_EXHAUSTED', 'WB_CLCO_LIMIT_REACHED'].includes(code)) text('반 사용량 또는 이용 한도에 도달했습니다. 담당자에게 한도를 확인하세요.');
        else if (code === 'WB_CLCO_SESSION_CLOSED') text('현재는 AI 이용 시간이 아닙니다. 담당자에게 이용 시간을 확인하세요.');
        else if (['WB_CLCO_CANCELLED', 'CANCELLED', 'REQUEST_CANCELLED'].includes(code)) text('점검이 취소됐습니다. 이전 응답은 현재 결과가 아닙니다. 필요하면 직접 다시 점검하세요.');
        else if (['MODEL_NOT_CONFIGURED', 'ON_AI_MODEL_LIST_EMPTY'].includes(code)) text('쓸 수 있는 모델이 없습니다. 담당자에게 앱의 모델 허용 설정을 확인해 달라고 요청하세요.');
        else if (['WB_CLCO_RATE_LIMITED', 'WB_CLCO_TIMEOUT', 'REQUEST_TIMEOUT', 'ENGINE_TIMEOUT', 'TIMEOUT', 'WB_CLCO_NETWORK_ERROR'].includes(code)) text('요청 제한·시간 초과·네트워크 상태를 확인한 뒤 잠시 후 직접 다시 점검하세요.');
        else text('현재 결과를 확인할 수 없습니다. 담당자에게 안전한 오류 코드와 점검 시각을 알려 주세요.');
      }
      return root;
    },
    renderExplanation({ event, explanation, checkedAt }) {
      const root = document.createElement('section');
      root.className = 'explanation-view';
      const text = value => {
        const node = document.createElement('p');
        node.textContent = value;
        root.append(node);
        return node;
      };
      const failure = (code, message) => {
        text(`AI 설명 실패: ${code} · ${message}`).setAttribute('role', 'alert');
        text('기존 기록은 그대로 유지됩니다. AI 연결이나 응답 문제는 과제 실패를 뜻하지 않습니다. 필요하면 직접 다시 요청하세요.');
      };
      // A rejected/insufficient event may be null; show its error before selection help.
      if (explanation?.status === 'error') {
        failure(explanation.error?.code ?? 'AI_REQUEST_UNVERIFIED', explanation.error?.message ?? '응답을 확인할 수 없습니다.');
      } else if (!event) text('보안 기록에서 설명할 사건을 먼저 선택하세요.');
      else if (explanation?.status === 'ok') {
        const data = explanation.data;
        const evidence = new Map((event.evidence ?? []).map(row => [row.id, row.text]));
        const referencesMatch = ids => Array.isArray(ids) && ids.length > 0
          && new Set(ids).size === ids.length && ids.every(id => evidence.has(id));
        if (!evidence.size || !event.rules?.length) {
          failure('ON_AI_INVALID_INPUT', '설명에 필요한 사건 근거 또는 규칙이 부족합니다. 기존 기록을 확인하세요.');
        } else if (!data || data.executed !== false || data.requiresHumanConfirmation !== true) {
          failure('ON_AI_INVALID_OUTPUT', 'AI가 이미 실행했다고 답했거나 사람 확인·미실행 상태를 확인할 수 없어 이 설명을 사용할 수 없습니다.');
        } else if (!referencesMatch(data.evidenceIds) || data.evidenceIds.length !== evidence.size
          || !Array.isArray(data.proposals) || data.proposals.some(proposal =>
            !referencesMatch(proposal.evidenceIds) || !event.supportedActions?.includes(proposal.action))) {
          failure('ON_AI_INVALID_OUTPUT', '현재 사건의 근거 ID 또는 지원 조치와 맞지 않아 이 설명을 사용할 수 없습니다.');
        } else {
          root.setAttribute('data-student-explanation-event', event.id);
          text(`사건 ID: ${event.id}`);
          text('AI 설명(참고용)');
          text(data.summary);
          text(`설명 확인 시각: ${checkedAt ?? '확인 불가'}`);
          text('인용 근거');
          for (const id of data.evidenceIds) text(`${id} — ${evidence.get(id)}`);
          text('적용 규칙');
          for (const rule of event.rules) text(`${rule.id} — ${rule.text}`);
          text('확인 불가 상태');
          const unknown = [['access', '접속'], ['session', '세션'], ['device', '기기']]
            .filter(([key]) => event.state?.[key] === 'unknown');
          if (!unknown.length) text('없음');
          for (const [, label] of unknown) text(`${label}: 확인 불가(unknown)`);
          if (!data.proposals.length) text(event.supportedActions?.length
            ? 'AI가 제안한 조치가 없습니다.' : '연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).');
          for (const proposal of data.proposals) {
            text(`제안 조치: ${proposal.action} · 이유: ${proposal.reason}`);
            text(`제안 근거 ID: ${proposal.evidenceIds.join(', ')}`);
            text('사람 확인이 필요하며 실행되지 않았습니다.');
          }
          text('AI 설명은 참고용 해석입니다. 실제 조치를 실행한 결과가 아닙니다.');
        }
      } else if (explanation?.status === 'loading') text(`사건 ${event.id}의 AI 설명을 요청하는 중입니다.`);
      else if (explanation?.status === 'idle') text(`사건 ${event.id}의 AI 설명 요청 전입니다.`);
      else {
        failure('AI_REQUEST_UNVERIFIED', '응답을 확인할 수 없습니다.');
      }
      return root;
    },
    renderAction({ status, event, actionId, target, receipt, observation, message, confirmationExpiresAt, error }) {
      const root = document.createElement('section');
      root.className = 'action-view';
      const text = value => {
        const node = document.createElement('p');
        node.textContent = value;
        root.append(node);
        return node;
      };
      const mismatched = receipt && ((receipt.eventId != null && receipt.eventId !== event?.id)
        || (receipt.actionId != null && receipt.actionId !== actionId));
      const currentStatus = mismatched ? 'unknown' : status === 'succeeded' && observation?.effectApplied !== true ? 'unknown' : status;
      const labels = {
        idle: '아직 미실행(idle). AI의 조치 제안은 실제 집행이 아닙니다.',
        loading: '조치 준비 또는 결과 조회 중(loading). 현재 상태를 확인하고 있습니다.',
        prepared: '준비됨·미실행(prepared). 실제 대상과 확인 기한을 읽고 제공 화면에서 사람이 확인해야 합니다.',
        executing: '서버에 전달 중(executing). 처리 결과는 아직 확인되지 않았습니다.',
        pending: '서버 접수·처리 중(pending). ACK는 요청을 받았다는 응답이며 실제 효과를 뜻하지 않습니다.',
        succeeded: '효과 확인(succeeded)',
        denied: '연동 시스템 거절(denied)',
        failed: '연동 시스템 실패(failed)',
        unknown: '결과 불명(unknown). 성공이나 효과 없음으로 판단하지 마세요. 제공 화면에서 결과만 직접 재조회하세요.',
        expired: '확인 기한 지남(expired). 현재 사건에서 조치를 다시 준비하고 실제 대상을 확인하세요.',
        error: '요청이 처리되지 않았습니다(error). 안전한 오류와 현재 연결 상태를 확인하세요.',
      };
      text(labels[currentStatus] ?? `결과 불명(unknown). 받은 상태: ${status ?? '확인 불가'}. 결과만 직접 재조회하세요.`);
      if (mismatched) text('현재 사건·조치와 영수증이 일치하지 않아 이 결과를 현재 조치의 효과로 사용할 수 없습니다.');
      if (!mismatched) {
        if (event?.id != null) root.setAttribute('data-student-action-event', event.id);
        if (receipt?.requestId != null) root.setAttribute('data-student-action-request', receipt.requestId);
      }
      if (event?.id != null) text(`사건 ID: ${event.id}`);
      for (const evidence of event?.evidence ?? []) text(`근거 ID: ${evidence.id}`);
      if (actionId != null) text(`조치 ID: ${actionId}`);
      if (target?.id != null) text(`실제 대상 ID: ${target.id}`);
      if (target?.generation != null) text(`대상 세대(generation): ${target.generation}`);
      if (receipt && !mismatched) {
        for (const key of ['requestId', 'receiptId', 'eventId', 'actionId', 'status', 'version']) {
          if (receipt[key] != null) text(`영수증 ${key}: ${receipt[key]}`);
        }
        if (receipt.replayed === true) text('중복 요청의 기존 영수증입니다(replayed: true). 새로 집행한 결과가 아닙니다.');
        if (receipt.superseded === true) text('이전 조회는 최신 결과를 대신하지 않습니다(superseded: true). 결과만 재조회하세요.');
      }
      if (currentStatus === 'prepared') text(`사람 확인 기한: ${confirmationExpiresAt ?? '확인 불가'}`);
      if (currentStatus === 'succeeded' && observation?.effectApplied === true) {
        text(`관측 시각: ${observation.observedAt ?? '확인 불가'}`);
        text('effectApplied: true');
      }
      if (message) text(message);
      if (error) text(`오류: ${error.code ?? 'ACTION_RESULT_UNVERIFIED'} · ${error.message ?? '결과를 확인할 수 없습니다.'}`).setAttribute('role', 'alert');
      if (event && !event.supportedActions?.length) text('연동 시스템이 지원하는 조치가 없어 조치 준비 버튼이 없는 것이 정상입니다.');
      text('조작은 제공 화면의 버튼을 사용하세요. 자동으로 집행하거나 재전송하지 않습니다. 「조치 화면 취소」는 이미 전달된 조치 효과를 되돌리지 않습니다.');
      return root;
    },
  };
}
