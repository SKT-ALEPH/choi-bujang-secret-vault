import policy from './patterns.json' with { type: 'json' };
import { normalizeAlert } from '../brute-force/normalize-alert.mjs';
import { createHash } from 'node:crypto';
import { createJevClient } from './jev.mjs';
import { inputSignals, patternName } from './signals.mjs';

const output = (confidence, reason) => ({ action: confidence >= .85 ? 'block' : confidence >= .5 ? 'alert' : 'record', confidence, reason });
export function createDecider({ askJev = createJevClient(), timeoutMs = 1500 } = {}) {
  const windows = new Map();
  return async function decide(alert) {
    const row = normalizeAlert(alert), text = row.description;
    if (!row.timestamp || !row.sourceAddress) return output(.5, 'ambiguous_web_input: 입력 근거 부족');
    const syntax = inputSignals(text);
    const negated = /삽입 표식은 아닙|공격 표기는 없/u.test(text);
    const signals = { sql: !negated && (syntax.sql || /SQL (?:구문|표식)|데이터베이스 조회를 이어/u.test(text)),
      script: !negated && (syntax.script || /스크립트 (?:삽입|표식)|스크립트 표식/u.test(text)),
      traversal: syntax.traversal || /경로.{0,20}(?:거슬러|이탈)/u.test(text),
      command: syntax.command || /명령 구분자/u.test(text) };
    const pattern = patternName(signals);
    let count = Number(text.match(/(\d+)\s*(?:번|건|회)/u)?.[1] ?? (pattern ? 1 : 0));
    if (row.level <= 3 && !pattern) return output(.05, 'normal_activity: 주입 근거 없는 정상 조회');
    if (pattern && count < policy.minRepeats) {
      const at = Date.parse(row.timestamp), previous = windows.get(row.sourceAddress) ?? [];
      const latest = Math.max(at, ...previous.map(item => item.at));
      const active = previous.filter(item => item.at > latest - policy.windowSeconds * 1000);
      const id = createHash('sha256').update(String(alert?.id ?? '') + row.timestamp + text).digest('hex');
      if (at > latest - policy.windowSeconds * 1000 && !active.some(item => item.id === id)) active.push({ id, at, count: Math.max(1, count) });
      windows.delete(row.sourceAddress); windows.set(row.sourceAddress, active.slice(-128));
      if (windows.size > 512) windows.delete(windows.keys().next().value);
      count = active.reduce((sum, item) => sum + item.count, 0);
    }
    const repeated = Boolean(pattern && count >= policy.minRepeats);
    if (repeated && (row.level >= 10 || windows.has(row.sourceAddress))) return output(.96, pattern + ': 같은 주소의 명확한 반복 주입');
    let timer; const controller = typeof AbortController === 'function' ? new AbortController() : null;
    try {
      const response = Promise.resolve().then(() => askJev({ level: row.level, repeatCount: count, ...signals }, { signal: controller?.signal }));
      const score = typeof setTimeout === 'function' ? await Promise.race([response,
        new Promise(resolve => { timer = setTimeout(() => { controller?.abort(); resolve(null); }, timeoutMs); })]) : await response;
      if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1) return output(.5, 'ambiguous_web_input: Jev 응답 없음 또는 형식 오류');
      return output(repeated ? score : Math.min(score, .84), 'ambiguous_web_input: Jev 판단');
    } catch { return output(.5, 'ambiguous_web_input: Jev 응답 없음'); }
    finally { if (timer !== undefined && typeof clearTimeout === 'function') clearTimeout(timer); }
  };
}
export const decide = createDecider();
