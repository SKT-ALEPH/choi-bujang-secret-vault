// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 8단계: 등록 기기의 선언된 구역 입장을 판정하고, 자료 권한은 최종 API가 강제합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['starter.deny', 'device_registered', 'step_up_required', 'resource_scope']);

const REQUEST_KEYS = 'at,classId,deviceId,deviceRegistered,method,path,policyRevision,projectId,queryLength,querySha256,recentEvents,requestId,route,schema,service,signals,stepUp,subjectId';

// Admission to a declared API route is not permission to its stored data.
// notes.js and announcements.js must enforce owner/editor authorization again.
// Both engine-logical paths and the actual /api paths have exact route shapes.
function declaredResourceRoute(request) {
  if (typeof request.path !== 'string') return false;
  const match = /^(\/api)?\/(notes|announcements)(?:\/(demo|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}))?$/iu.exec(request.path);
  if (!match || request.service !== match[2]) return false;
  const [, prefix = '', service, id] = match;
  const methods = id ? (service === 'notes' ? ['GET', 'PUT', 'DELETE'] : ['GET', 'PUT'])
    : (service === 'notes' ? ['GET', 'POST'] : ['GET']);
  return methods.includes(request.method)
    && request.route === `${request.method} ${prefix}/${service}${id ? '/:id' : ''}`;
}

// Optional additional ACLs come from a trusted installer, never from requests.
// An explicit empty/invalid ACL denies everything; undefined uses route admission.
export function createDecider(resourceGrants) {
  const grants = resourceGrants === undefined ? null : Array.isArray(resourceGrants) ? resourceGrants.map(grant => ({
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
    const subjectKnown = ['subjectId', 'classId', 'projectId'].every(key =>
      typeof request[key] === 'string' && request[key].length > 0 && request[key].length <= 160)
      && Number.isSafeInteger(request.policyRevision) && request.policyRevision >= 1;
    const scoped = subjectKnown && request.queryLength === 0
      && request.querySha256 === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
      && /^[a-f0-9]{16}$/u.test(request.deviceId)
      && declaredResourceRoute(request)
      && (grants === null || grants.some(g => ['none', 'judge_fixture'].includes(g.source)
        && g.source === request.signals?.source && g.classId === request.classId
        && g.policyRevision === request.policyRevision && g.projectId === request.projectId && g.subjectId === request.subjectId
        && g.deviceId === request.deviceId && g.service === request.service
        && g.path === request.path
        && g.methods.includes(request.method)));
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

const resourceDecide = createDecider();
export async function decide(request) { return resourceDecide(request); }
