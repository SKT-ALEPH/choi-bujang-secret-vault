// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계: 엔진이 확인한 등록 기기의 자료실 읽기만 허용합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['starter.deny', 'device_registered', 'step_up_required', 'resource_scope']);

export async function decide(request) {
  const reply = (decision, reasonCode, ruleIds) => ({ schema: 'aleph.decision.v1',
    requestId: request.requestId, decision, reasonCode, ruleIds });
  const registered = request.deviceRegistered === true;
  const item = /^\/notes\/[a-zA-Z0-9_-]{1,100}$/u.test(request.path ?? '')
    && !['export', 'announcements', 'admin'].includes(request.path.split('/').at(-1));
  const read = request.service === 'notes'
    && ((request.method === 'GET' && request.path === '/notes' && request.route === 'GET /notes')
      || (item && ['GET', 'PUT'].includes(request.method) && request.route === request.method + ' /notes/:id'));
  if (!registered) return reply('deny', 'device_not_registered', ['device_registered']);
  if (!read) return reply('deny', 'starter_not_ready', ['resource_scope']);
  const s = request.signals;
  const fixture = s?.source === 'judge_fixture';
  const absent = s?.source === 'none' && s.region === 'unknown' && s.network === 'unknown';
  const valid = Number.isInteger(s?.hour) && s.hour >= 0 && s.hour < 24
    && Array.isArray(request.recentEvents)
    && (absent || (fixture && ['usual', 'unusual'].includes(s.network)
      && ['local', 'foreign'].includes(s.region)));
  const burst = Array.isArray(request.recentEvents) && request.recentEvents.some(e => e.kind === 'risk_signal'
    && Number.isFinite(e.ageSeconds) && e.ageSeconds >= 0 && e.ageSeconds <= 600
    && Number.isInteger(e.count) && e.count >= 20);
  const risk = !valid || (fixture && s.network === 'unusual' && (s.hour < 6 || s.hour >= 22) && burst);
  const confirmed = request.stepUp?.verified === true && Number.isFinite(request.stepUp.authAgeSeconds)
    && request.stepUp.authAgeSeconds >= 0 && request.stepUp.authAgeSeconds <= 900;
  if (risk && !confirmed) return reply('step_up', 'step_up_required', ['step_up_required']);
  return reply('allow', 'approved', ['device_registered']);
}
