import { decide as baseDecide, RULE_IDS as baseRuleIds } from './decider.mjs';
import { createXdrGuard } from '../xdr/brute-force/guard.mjs';

// Operator entry point. The engine supplies its registered reason codes, rule
// storage and trusted source lookup. No browser-supplied fields are added.
export function connectXdrDecider(operatorBinding) {
  const decide = createXdrGuard(baseDecide, operatorBinding);
  return Object.freeze({ decide,
    RULE_IDS: Object.freeze([...baseRuleIds, 'xdr.brute_force']) });
}
