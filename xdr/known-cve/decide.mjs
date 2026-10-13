// Standalone offline evaluator. Pattern names/conditions mirror patterns.json.
const PATTERNS = Object.freeze({
  log4shell_remote_lookup: '완전한 원격 JNDI 조회 또는 신뢰 경보의 명시적 악용 형태',
  possible_cve_probe: '불완전한 조회·취약점 점검 흔적은 알림만',
  normal_activity: '악용 근거 없는 정상 활동',
});
export function decide(alert) {
  const raw = alert?.rule !== undefined || alert?.data !== undefined;
  const description = String((raw ? alert?.rule?.description : alert?.description) ?? '').slice(0, 2000);
  const level = Number(raw ? alert?.rule?.level : alert?.level);
  const data = raw && alert?.data && typeof alert.data === 'object' ? alert.data : {};
  // Inspect only HTTP request fields, never passwords, cookies or arbitrary objects.
  const input = ['url', 'useragent', 'query', 'request_uri'].map(k => typeof data[k] === 'string' ? data[k].slice(0, 8192) : '').join(' ');
  let decoded = input;
  for (let i = 0; i < 2; i++) { try { decoded = decodeURIComponent(decoded); } catch { break; } }
  const syntax = /\$\{\s*jndi\s*:\s*(?:ldap|ldaps|rmi|dns|iiop):\/\/[^\s{}]+\}/iu.test(decoded);
  const absent = /(?:조회|악용)\s*구문[은이가]?\s*없|완전한 구문은 아닙|잘린|글자만|단어/u.test(description);
  const explicit = !absent && (/(?:원격\s*조회\s*구문|CVE-2021-44228\s*형태|문서용\s*조회\s*구문)/iu.test(description))
    && /(?:있|들어|반복|그대로|같이|함께|표기)/u.test(description);
  let confidence = 0.1, name = 'normal_activity';
  if (syntax || explicit) { confidence = 0.98; name = 'log4shell_remote_lookup'; }
  else if (level >= 5 && /cve-|jndi|취약점|조회|라이브러리|중괄호|점검\s*도구/iu.test(description + ' ' + decoded)) {
    confidence = 0.6; name = 'possible_cve_probe';
  }
  return { action: confidence >= 0.85 ? 'block' : confidence >= 0.5 ? 'alert' : 'record', confidence, reason: name + ': ' + PATTERNS[name] };
}
