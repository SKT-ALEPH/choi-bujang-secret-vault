// Detect syntax combinations, never a bare topic word. Inputs are inspected only
// in memory; no payload, URL, memo or credential is returned or persisted.
export function inputSignals(value) {
  let text = typeof value === 'string' ? value.slice(0, 12000) : '';
  for (let i = 0; i < 2; i++) { try { const decoded = decodeURIComponent(text); if (decoded === text) break; text = decoded; } catch { break; } }
  return {
    sql: /\bunion\s+(?:all\s+)?select\b|['"]\s*(?:or|and)\s+(?:\d+\s*=\s*\d+|['"][^'"]*['"]\s*=)|;\s*(?:drop|select|insert|update|delete)\b|\b(?:sleep|pg_sleep)\s*\(/iu.test(text),
    script: /<\s*script\b|<[^>]{0,200}\bon(?:error|load|click)\s*=|javascript\s*:/iu.test(text),
    traversal: /(?:\.\.[/\\]){2,}/u.test(text),
    command: /(?:;|&&|\|\||`|\$\()\s*(?:cat|whoami|curl|wget|sh|bash|id)\b/iu.test(text),
  };
}
export function patternName(signals) {
  return signals.sql ? 'sql_injection' : signals.script ? 'script_injection'
    : signals.traversal ? 'path_traversal' : signals.command ? 'command_injection' : null;
}
