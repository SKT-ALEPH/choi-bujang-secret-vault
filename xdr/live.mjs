import { createClient } from '@supabase/supabase-js';
import config from '../aleph.config.json' with { type: 'json' };
import { createLiveXdr } from './brute-force/live.mjs';
import { createLiveWebXdr } from './web-injection/live.mjs';
let runtime;
export function getLiveXdr() {
  if (runtime) return runtime;
  const url = process.env.SUPABASE_URL, secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !secret || url !== new URL(config.identityProvider.issuer).origin) throw new Error('XDR_NOT_CONFIGURED');
  const database = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (target, options) => fetch(target, { ...options, redirect: 'error' }) } });
  const brute = createLiveXdr({ database, secret }), web = createLiveWebXdr({ database, secret });
  runtime = { check: async request => await brute.check(request) ?? await web.check(request),
    failure: brute.failure, inspect: web.inspect };
  return runtime;
}
