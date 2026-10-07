import policy from './patterns.json' with { type: 'json' };
import { normalizeAlert } from './normalize-alert.mjs';
import { createHash } from 'node:crypto';
import { createJevClient } from './jev.mjs';

const patterns = new Map(policy.patterns.map(pattern => [pattern.name, pattern]));
const failure = /실패|여러 계정.{0,80}같은 비밀번호.{0,40}(?:연속|반복)/u;

function evidence(alert) {
  const normalized = normalizeAlert(alert);
  const { description, level } = normalized;
  const failures = Number(description.match(/실패(?:가)?\s*(\d+)\s*건/u)?.[1] ?? 0);
  const accounts = Number(description.match(/계정\s*(\d+)\s*개/u)?.[1] ?? 0);
  return { ...normalized, failures, accounts, hasFailure: failure.test(description),
    hasSuccess: /성공/u.test(description) && !/성공(?:은|이)?\s*없|성공하지/u.test(description),
    multiAccount: /여러 계정|서로 다른 계정|계정 이름을 바꿔|계정\s*\d+\s*개/u.test(description),
    samePassword: /같은 비밀번호/u.test(description),
    automated: /같은 간격|계정 이름을 바꿔|연속|이어졌|이어졌습니다/u.test(description),
    valid: Boolean(normalized.timestamp && normalized.sourceAddress), level };
}

function decision(confidence, reason) {
  return { action: confidence >= policy.thresholds.block ? 'block'
    : confidence >= policy.thresholds.alert ? 'alert' : 'record', confidence, reason };
}

// Offline by default; live evaluation requires an explicit flag and server key.
export function createDecider({ askJev = createJevClient(), timeoutMs = 1500 } = {}) {
  const windows = new Map();
  return async function decide(alert) {
    const signal = evidence(alert);
    if (!signal.valid) return decision(0.5, 'ambiguous_authentication_failures: 입력 근거 부족');
    const key = signal.sourceAddress + '/' + signal.account;
    if (signal.hasSuccess) windows.delete(key);
    if (!signal.hasFailure) return decision(0.05, 'normal_activity: 공격 실패 신호 없음');
    for (const name of ['password_spraying', 'repeated_password_guessing', 'automated_multi_account_attempts']) {
      const pattern = patterns.get(name);
      if (signal.level < pattern.minLevel) continue;
      const match = name === 'password_spraying' ? signal.multiAccount && signal.samePassword && (signal.automated || signal.accounts >= 8)
        : name === 'repeated_password_guessing' ? signal.failures >= pattern.minFailures
        : signal.accounts >= pattern.minAccounts && signal.automated;
      if (match) return decision(pattern.confidence, name + ': 반복 인증 실패 근거');
    }
    if (!signal.hasSuccess && signal.failures > 0 && signal.account !== '[redacted]') {
      const pattern = patterns.get('correlated_failure_burst');
      const at = Date.parse(signal.timestamp);
      const previous = windows.get(key) ?? [];
      const newest = Math.max(at, ...previous.map(row => row.at));
      const active = previous.filter(row => row.at >= newest - pattern.windowSeconds * 1000);
      const id = createHash('sha256').update(String(alert?.id ?? '') + signal.timestamp + signal.description).digest('hex');
      if (at >= newest - pattern.windowSeconds * 1000 && !active.some(row => row.id === id)) {
        active.push({ id, at, count: signal.failures });
      }
      windows.delete(key); windows.set(key, active.slice(-128));
      if (windows.size > 512) windows.delete(windows.keys().next().value);
      if (active.reduce((total, row) => total + row.count, 0) >= pattern.minFailures) {
        return decision(pattern.confidence, 'correlated_failure_burst: 같은 주소·계정의 시간 창 합산');
      }
    }
    if (signal.failures <= 1 && signal.level <= 3) return decision(0.1, 'normal_activity: 낮은 빈도의 실패');
    // Send numerical/boolean evidence only; exclude source, account and text.
    const summary = { pattern: 'ambiguous_authentication_failures', level: signal.level,
      failureCount: signal.failures, accountCount: signal.accounts,
      multiAccount: signal.multiAccount, samePassword: signal.samePassword };
    let timer;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    try {
      const response = Promise.resolve().then(() => askJev(summary, { signal: controller?.signal }));
      const score = typeof setTimeout === 'function' ? await Promise.race([response,
        new Promise(resolve => { timer = setTimeout(() => { controller?.abort(); resolve(null); }, timeoutMs); }),
      ]) : await response;
      if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1) {
        return decision(0.5, 'ambiguous_authentication_failures: Jev 응답 없음 또는 형식 오류');
      }
      return decision(score, 'ambiguous_authentication_failures: Jev 판단');
    } catch {
      return decision(0.5, 'ambiguous_authentication_failures: Jev 응답 없음');
    } finally { if (timer !== undefined && typeof clearTimeout === 'function') clearTimeout(timer); }
  };
}

export const decide = createDecider();
