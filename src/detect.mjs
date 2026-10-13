// Only engine-verified, pseudonymous events may reach this separate detector.
// Identity/device revocation is proposed here and enforced by the supplied engine.
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 120;

export function detect(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');
  const reads = [];
  for (const event of events) {
    const subject = event?.identity?.sub;
    if (event?.method !== 'GET' || typeof event.at !== 'string'
        || typeof subject !== 'string' || !/^[a-zA-Z0-9_.:-]{1,160}$/u.test(subject)) continue;
    const at = Date.parse(event.at);
    if (Number.isFinite(at)) reads.push({at, subject});
  }
  reads.sort((a, b) => a.at - b.at || (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0));
  const windows = new Map();
  for (const {at, subject} of reads) {
    if (!windows.has(subject)) windows.set(subject, {times: [], start: 0});
    const window = windows.get(subject);
    window.times.push(at);
    // Half-open ten-minute windows: an event exactly ten minutes old has expired.
    while (at - window.times[window.start] >= WINDOW_MS) window.start += 1;
    if (window.times.length - window.start > LIMIT) {
      return {action: 'propose_revocation', reasonCode: 'burst_read', subject};
    }
  }
  return {action: 'observe'};
}
