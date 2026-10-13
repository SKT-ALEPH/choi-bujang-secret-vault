// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기 시작점입니다.
// 6단계: 엔진이 확인한 등록 기기의 자료실 읽기만 허용합니다.
// 요청 본문의 userId, role, 기기 키, 토큰을 별도로 믿거나 저장하지 마세요.
export const RULE_IDS = Object.freeze(['starter.deny', 'device_registered']);

export async function decide(request) {
  const registered = request.deviceRegistered === true;
  const read = request.service === 'notes' && request.method === 'GET'
    && ['GET /notes', 'GET /notes/:id'].includes(request.route);
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision: registered && read ? 'allow' : 'deny',
    reasonCode: !registered ? 'device_not_registered' : read ? 'approved' : 'starter_not_ready',
    ruleIds: [!registered || read ? 'device_registered' : 'starter.deny'],
  };
}
