// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계: 엔진이 확인한 등록 기기의 자료실 읽기만 허용합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['starter.deny', 'device_registered', 'step_up_required', 'resource_scope']);

// The only built-in grant is the published starter's *virtual* resource.
// It is scoped to the fixture source/class/project/device and never grants live access.
export const PRACTICE_RESOURCE_GRANTS = Object.freeze([Object.freeze({
  source: 'judge_fixture', classId: 'class_fixture', projectId: 'project_fixture',
  subjectId: 'learner_fixture', deviceId: 'aaaaaaaaaaaaaaaa', service: 'notes',
  policyRevision: 1, path: '/notes/demo', methods: Object.freeze(['GET', 'PUT']),
})]);
const REQUEST_KEYS = 'at,classId,deviceId,deviceRegistered,method,path,policyRevision,projectId,queryLength,querySha256,recentEvents,requestId,route,schema,service,signals,stepUp,subjectId';

// Grants come from trusted server configuration, never from the request body.
export function createDecider(resourceGrants = []) {
  const grants = Array.isArray(resourceGrants) ? resourceGrants.map(grant => ({
    ...grant, methods: Array.isArray(grant?.methods) ? [...grant.methods] : [],
  })).filter(g => ['classId','projectId','subjectId','deviceId','service','path'].every(key =>
    typeof g[key] === 'string' && g[key].length > 0 && g[key].length <= 160)
    && Number.isSafeInteger(g.policyRevision) && g.policyRevision >= 1) : [];
  return async function decide(request) {
    const reply = (decision, reasonCode, ruleIds) => ({ schema: 'aleph.decision.v1',
      requestId: request?.requestId, decision, reasonCode, ruleIds });
    if (request?.deviceRegistered !== true) return reply('deny', 'device_not_registered', ['device_registered']);
    if (!request || Object.keys(request).sort().join(',') !== REQUEST_KEYS
        || request.schema !== 'aleph.decision.v1') return reply('deny', 'starter_not_ready', ['resource_scope']);
    const subjectKnown = typeof request.subjectId === 'string' && request.subjectId.length > 0
      && request.subjectId.length <= 160;
    const scoped = subjectKnown && request.queryLength === 0
      && request.querySha256 === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      && /^[a-f0-9]{16}$/u.test(request.deviceId)
      && ((request.service === 'notes' && ['GET', 'PUT'].includes(request.method)
        && request.route === request.method + ' /notes/:id')
        || (request.service === 'announcements' && request.method === 'PUT'
          && request.route === 'PUT /announcements/:id'))
      && grants.some(g => ['none', 'judge_fixture'].includes(g.source)
        && g.source === request.signals?.source && g.classId === request.classId
        && g.policyRevision === request.policyRevision && g.projectId === request.projectId && g.subjectId === request.subjectId
        && g.deviceId === request.deviceId && g.service === request.service
        && typeof g.path === 'string' && /^\/(?:notes|announcements)\/(?:demo|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/iu.test(g.path)
        && g.path === request.path
        && g.methods.includes(request.method));
    if (!scoped) return reply('deny', 'starter_not_ready', ['resource_scope']);
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
    return reply('allow', 'approved', ['device_registered', 'resource_scope']);
  };
}

const practiceDecide = createDecider(PRACTICE_RESOURCE_GRANTS);
export async function decide(request) { return practiceDecide(request); }
