import { createHmac, timingSafeEqual } from 'node:crypto';
export const NODES = ['frontend', 'api', 'db', 'mgmt', 'attacker'];
export function signSession(name, secret) { return `${name}.${createHmac('sha256', secret).update(name).digest('hex')}`; }
export function validateAction(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Send a JSON action.');
  const action = body.action;
  if (!['start', 'stop', 'status', 'audit', 'probe', 'experiment', 'reset'].includes(action)) throw new Error('Unsupported lab action.');
  if (action === 'probe') {
    if (!NODES.includes(body.from) || !NODES.includes(body.to) || body.from === body.to) throw new Error('Choose two different lab containers.');
    if (![80, 5000, 5432].includes(body.port)) throw new Error('Choose a lab port: 80, 5000, or 5432.');
    return ['probe', body.from, body.to, String(body.port)];
  }
  if (action === 'experiment') {
    if (!['db-public', 'firewall'].includes(body.change) || typeof body.enabled !== 'boolean') throw new Error('Unsupported lab experiment.');
    return ['experiment', body.change, String(body.enabled)];
  }
  return [action];
}
export function sessionFromCookie(cookie = '', secret) {
  const value = cookie.split(';').map(x => x.trim()).find(x => x.startsWith('seg_lab='))?.slice(8);
  if (!secret || !value || !/^seg-live-[a-f0-9-]{36}-\d{13}\.[a-f0-9]{64}$/.test(value)) return null;
  const name = value.split('.')[0];
  if (!timingSafeEqual(Buffer.from(value), Buffer.from(signSession(name, secret)))) return null;
  const createdAt = Number(name.slice(-13));
  if (createdAt > Date.now() || Date.now() - createdAt > 300000) return null;
  return name;
}
