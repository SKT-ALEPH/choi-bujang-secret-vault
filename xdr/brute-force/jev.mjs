// Official API: https://docs.typesafe.ai/api
export function createJevClient({ enabled = typeof process !== 'undefined' && process.env?.XDR_JEV_LIVE === '1',
  getApiKey = () => typeof process !== 'undefined' ? process.env?.TYPESAFE_API_KEY : undefined, fetchImpl = globalThis.fetch,
  onStatus = () => {} } = {}) {
  return async function askJev(summary, { signal } = {}) {
    if (!enabled) { onStatus('disabled'); return null; }
    const apiKey = getApiKey();
    if (typeof apiKey !== 'string' || !apiKey.trim()) { onStatus('missing_key'); return null; }
    // Whitelist evidence again at the provider boundary. Never transmit raw alerts.
    const state = {
      level: Number.isInteger(summary.level) ? summary.level : 0,
      failureCount: Number.isFinite(summary.failureCount) ? summary.failureCount : 0,
      accountCount: Number.isFinite(summary.accountCount) ? summary.accountCount : 0,
      multiAccount: summary.multiAccount === true,
      samePassword: summary.samePassword === true,
    };
    try {
      const response = await fetchImpl('https://api.typesafe.ai/v1/systemone', {
        method: 'POST', redirect: 'error', signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'jev-latest', state, questions: {
          is_brute_force: { type: 'noul',
            instructions: 'Does the supplied authentication evidence indicate a brute-force or password-spraying attack under MITRE ATT&CK T1110? Missing evidence is uncertainty, not proof of attack.',
            criteria: { true: 'Repeated automated credential guessing or the same password attempted across accounts.',
              false: 'Ordinary low-frequency user errors or insufficient evidence of automated guessing.' } },
        } }),
      });
      if (!response.ok) { onStatus(`http_${response.status}`); return null; }
      const body = await response.json();
      const answer = body?.answers?.is_brute_force;
      const valid = answer?.type === 'noul' && typeof answer.noul === 'number'
        && Number.isFinite(answer.noul) && answer.noul >= 0 && answer.noul <= 1;
      onStatus(valid ? 'answered' : 'invalid_response');
      return valid ? answer.noul : null;
    } catch { onStatus('request_failed'); return null; }
  };
}
