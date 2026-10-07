import { decide as baseDecide, RULE_IDS as baseRuleIds } from './decider.mjs';
import { createXdrGuard } from '../xdr/brute-force/guard.mjs';
import { readDenyRules } from '../xdr/brute-force/rule-store.mjs';

// Operator entry point. The engine supplies its registered reason codes, rule
// storage and trusted source lookup. No browser-supplied fields are added.
export function connectXdrDecider(operatorBinding = {}) {
  const { rulesPath = new URL('../xdr/brute-force/deny-rules.json', import.meta.url),
    ...binding } = operatorBinding;
  const decide = createXdrGuard(baseDecide, { ...binding,
    getRules: binding.getRules ?? (async () => [...await readDenyRules(rulesPath), ...await readDenyRules(new URL('../xdr/web-injection/deny-rules.json', import.meta.url))]) });
  return Object.freeze({ decide,
    RULE_IDS: Object.freeze([...baseRuleIds, 'xdr.brute_force', 'xdr.web_injection']) });
}
