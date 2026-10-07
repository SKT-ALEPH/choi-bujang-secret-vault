import { createHmac, randomUUID } from 'node:crypto';
import { createDecider } from './decide.mjs';
import { createJevClient } from './jev.mjs';
import { inputSignals, patternName } from './signals.mjs';
import { trustedVercelSource } from '../brute-force/live.mjs';
import { activeDenyRule } from '../brute-force/guard.mjs';

export function createLiveWebXdr({ database, secret, getSource = trustedVercelSource,
  askJev = createJevClient({ enabled: true }), now = () => new Date().toISOString() }) {
  if (!secret) throw new Error('XDR_NOT_CONFIGURED');
  const sourceKey = source => createHmac('sha256', secret).update('xdr-02/source/' + source).digest('hex');
  async function check(request) {
    const source = getSource(request);
    const { data, error } = await database.from('xdr_web_sources').select('created_at,expires_at,confidence,evidence_ids')
      .eq('source_key', sourceKey(source)).maybeSingle().abortSignal(AbortSignal.timeout(10000));
    if (error) throw new Error('XDR_STORAGE_UNAVAILABLE');
    const rule = data && { ruleId: 'xdr.web_injection', sourceAddress: source, action: 'deny',
      createdAt: data.created_at, expiresAt: data.expires_at, confidence: data.confidence, evidenceAlertIds: data.evidence_ids };
    return rule && activeDenyRule([rule], source, now()) ? { code: 'xdr_web_injection', evidenceId: data.evidence_ids.at(-1),
      retryAfter: Math.max(1, Math.ceil((Date.parse(data.expires_at) - Date.parse(now())) / 1000)) } : null;
  }
  async function inspect(request, noteInput) {
    // Do not inspect authorization, password, refresh token or Auth body.
    // Query values named credentials are also excluded. Memo values stay in memory.
    const excluded = /token|password|secret|key|authorization|cookie|email/iu;
    const query = Object.entries(request.query ?? {}).filter(([name]) => !excluded.test(name))
      .flatMap(([, value]) => Array.isArray(value) ? value : [value]).filter(value => typeof value === 'string');
    const values = [...query, noteInput?.title, noteInput?.body].filter(value => typeof value === 'string');
    const signals = { sql: false, script: false, traversal: false, command: false };
    for (const value of values.slice(0, 64)) for (const [name, found] of Object.entries(inputSignals(value))) signals[name] ||= found;
    const pattern = patternName(signals);
    if (!pattern) return null;
    const key = sourceKey(getSource(request));
    const { data, error } = await database.rpc('xdr_web_observe', { p_source_key: key }).abortSignal(AbortSignal.timeout(10000));
    if (error || !Number.isInteger(data?.repeatCount)) throw new Error('XDR_STORAGE_UNAVAILABLE');
    const names = { sql_injection: 'SQL 구문', script_injection: '스크립트 삽입 표식', path_traversal: '경로 이탈 표기', command_injection: '명령 구분자 표기' };
    const out = await createDecider({ askJev, timeoutMs: 10000 })({ timestamp: data.at,
      sourceAddress: getSource(request), account: '[redacted]', level: data.repeatCount >= 8 ? 12 : 6,
      description: `같은 주소에서 ${names[pattern]}가 ${data.repeatCount}번 반복됐습니다.` });
    const applied = await database.rpc('xdr_web_apply', { p_source_key: key, p_window_started: data.windowStarted,
      p_alert_id: randomUUID(), p_action: out.action, p_confidence: out.confidence,
      p_reason: out.reason.split(':')[0], p_jev_answered: out.reason.endsWith('Jev 판단') }).abortSignal(AbortSignal.timeout(10000));
    if (applied.error) throw new Error('XDR_STORAGE_UNAVAILABLE');
    return out.action === 'block' ? check(request) : null;
  }
  return { check, inspect };
}
