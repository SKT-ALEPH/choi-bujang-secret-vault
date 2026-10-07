// https://docs.typesafe.ai/api — only whitelisted numerical/boolean evidence.
export function createJevClient({ enabled = typeof process !== 'undefined' && process.env?.XDR_JEV_LIVE === '1',
  getApiKey = () => typeof process !== 'undefined' ? process.env?.TYPESAFE_API_KEY : undefined,
  fetchImpl = globalThis.fetch, onStatus = () => {} } = {}) {
  return async function askJev(summary, { signal } = {}) {
    if (!enabled) { onStatus('disabled'); return null; }
    const key = getApiKey();
    if (typeof key !== 'string' || !key.trim()) { onStatus('missing_key'); return null; }
    const state = { level: Number.isInteger(summary.level) ? summary.level : 0,
      repeatCount: Number.isFinite(summary.repeatCount) ? summary.repeatCount : 0,
      sql: summary.sql === true, script: summary.script === true,
      traversal: summary.traversal === true, command: summary.command === true };
    try {
      const response = await fetchImpl('https://api.typesafe.ai/v1/systemone', {
        method: 'POST', redirect: 'error', signal,
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'jev-latest', state, questions: {
          is_web_injection: { type: 'noul',
            instructions: 'Does this numerical evidence show repeated exploitation attempts against a public web application under MITRE ATT&CK T1190? A lone quote, topic word or missing evidence is uncertainty, not proof.',
            criteria: { true: 'Repeated concrete SQL, script, path traversal or shell syntax attempts from the same source.',
              false: 'Ordinary requests, isolated ambiguous fragments or classroom topic words without repeated attack syntax.' } },
        } }),
      });
      if (!response.ok) { onStatus(`http_${response.status}`); return null; }
      const answer = (await response.json())?.answers?.is_web_injection;
      const valid = answer?.type === 'noul' && typeof answer.noul === 'number' && Number.isFinite(answer.noul) && answer.noul >= 0 && answer.noul <= 1;
      onStatus(valid ? 'answered' : 'invalid_response'); return valid ? answer.noul : null;
    } catch { onStatus('request_failed'); return null; }
  };
}
