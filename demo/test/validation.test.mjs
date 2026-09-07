import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAction, sessionFromCookie, signSession } from '../lib/validation.mjs';
test('only fixed containers and actual service ports can be probed', () => {
  assert.deepEqual(validateAction({ action: 'probe', from: 'frontend', to: 'api', port: 5000 }), ['probe', 'frontend', 'api', '5000']);
  for (const fields of [{ from: 'example.com' }, { to: '127.0.0.1' }, { port: '5000;id' }, { port: 22 }, { to: 'frontend' }]) {
    assert.throws(() => validateAction({ action: 'probe', from: 'frontend', to: 'api', port: 5000, ...fields }));
  }
});
test('experiments require a fixed action and real boolean', () => {
  assert.deepEqual(validateAction({ action: 'experiment', change: 'firewall', enabled: false }), ['experiment', 'firewall', 'false']);
  assert.throws(() => validateAction({ action: 'experiment', change: 'firewall', enabled: 'false' }));
  assert.throws(() => validateAction({ action: 'shell', cmd: 'id' }));
});
test('session names expire and cannot address unrelated sandboxes', () => {
  const name = `seg-live-11111111-1111-4111-a111-111111111111-${Date.now()}`;
  const secret = 'test-secret-not-used-for-deployment';
  assert.equal(sessionFromCookie(`other=1; seg_lab=${signSession(name,secret)}`,secret), name);
  assert.equal(sessionFromCookie(`seg_lab=${signSession(name,secret)}`,'different-secret'), null);
  assert.equal(sessionFromCookie('seg_lab=someone-elses-sandbox',secret), null);
  assert.equal(sessionFromCookie(`seg_lab=${signSession(`seg-live-11111111-1111-4111-a111-111111111111-${Date.now()-310000}`,secret)}`,secret), null);
});
