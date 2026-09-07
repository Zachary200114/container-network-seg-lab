import { Sandbox } from '@vercel/sandbox';
import { randomUUID, createHmac } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { validateAction, sessionFromCookie, signSession } from '../lib/validation.mjs';

const LAB_DIR = path.join(process.cwd(), 'lab');
const timeout = 300000;

async function uploadLab(sandbox) {
  await sandbox.runCommand('mkdir', ['-p', 'lab']);
  const files = (await readdir(LAB_DIR, { withFileTypes: true })).filter(entry => entry.isFile() && !entry.name.startsWith('.') && !entry.name.endsWith('.crt')).map(entry => entry.name);
  await sandbox.writeFiles(await Promise.all(files.map(async name => ({ path: `lab/${name}`, content: await readFile(path.join(LAB_DIR, name)) }))));
}

async function status(sandbox) {
  if (sandbox.status !== 'running') return { state: 'stopped', message: 'This lab session has ended. Start a new lab to continue.' };
  const failed = await sandbox.readFileToBuffer({ path: 'failed' });
  if (failed) return { state: 'failed', message: 'The Docker lab could not start. Stop this session and try again.' };
  const ready = await sandbox.readFileToBuffer({ path: 'ready' });
  const progress = await sandbox.readFileToBuffer({ path: 'progress.txt' });
  return { state: ready ? 'ready' : 'starting', message: progress?.toString().trim() || 'Starting your isolated Docker environment…', expiresAt: sandbox.expiresAt?.toISOString() };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  if (req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) throw new Error('origin'); }
    catch { return res.status(403).json({ error: 'Open the lab from its own website.' }); }
  }
  if (!req.headers['content-type']?.startsWith('application/json')) return res.status(415).json({ error: 'Send JSON.' });
  let args;
  try { args = validateAction(req.body); } catch (error) { return res.status(400).json({ error: error.message }); }
  let sandbox;
  try {
    const secret = process.env.LAB_SESSION_SECRET;
    if (!secret || secret.length < 32) return res.status(503).json({ error: 'The live lab is not configured yet.' });
    const previous = sessionFromCookie(req.headers.cookie, secret);
    if (previous) {
      try { sandbox = await Sandbox.get({ name: previous, resume: false }); } catch { /* Expired sessions are replaced only on an explicit Start. */ }
    }
    if (args[0] === 'start') {
      if (sandbox?.status === 'running') return res.json(await status(sandbox));
      const snapshot = process.env.LAB_SNAPSHOT_ID;
      if (!snapshot || !/^snap_[A-Za-z0-9]+$/.test(snapshot)) return res.status(503).json({ error: 'The prepared Docker environment is not configured. Please try again later.' });
      const live = await Sandbox.list({ tags: { app: 'segmentation-demo' }, limit: 50 });
      if (live.sandboxes.filter(x => ['running', 'pending'].includes(x.status)).length >= 3) return res.status(429).json({ error: 'All three lab sessions are in use. Try again in a few minutes.' });
      const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      const visitor = createHmac('sha256', secret).update(ip || 'unknown').digest('hex').slice(0, 24);
      const recent = live.sandboxes.filter(x => Date.now() - x.createdAt < 60 * 60 * 1000);
      if (recent.length >= 30 || recent.filter(x => x.tags?.visitor === visitor).length >= 6 || live.sandboxes.some(x => x.tags?.visitor === visitor && ['running', 'pending'].includes(x.status))) return res.status(429).json({ error: 'This visitor has an active lab or has reached the session limit. Wait for the current lab to expire before trying again.' });
      const name = `seg-live-${randomUUID()}-${Date.now()}`;
      sandbox = await Sandbox.create({ name, persistent: false, timeout, resources: { vcpus: 2 }, tags: { app: 'segmentation-demo', visitor }, source: { type: 'snapshot', snapshotId: snapshot }, networkPolicy: 'deny-all' });
      try {
        await uploadLab(sandbox);
        await sandbox.runCommand({ cmd: 'sh', args: ['lab/provision.sh'], sudo: true, detached: true });
      } catch (error) { await sandbox.stop(); throw error; }
      res.setHeader('Set-Cookie', `seg_lab=${signSession(name, secret)}; HttpOnly; Secure; SameSite=Strict; Path=/api/lab; Max-Age=300`);
      return res.json({ state: 'starting', message: 'Starting your isolated Docker lab…', expiresAt: sandbox.expiresAt?.toISOString() });
    }
    if (!sandbox || sandbox.status !== 'running') return res.status(410).json({ error: 'Your lab session has ended. Start a new lab.', state: 'stopped' });
    if (args[0] === 'stop') {
      await sandbox.stop();
      res.setHeader('Set-Cookie', 'seg_lab=; HttpOnly; Secure; SameSite=Strict; Path=/api/lab; Max-Age=0');
      return res.json({ state: 'stopped', message: 'Lab stopped. Its containers and session data have been discarded.' });
    }
    const current = await status(sandbox);
    if (args[0] === 'status') {
      const observed = current.state === 'ready' ? await sandbox.readFileToBuffer({ path: 'last-state.json' }) : null;
      return res.json({ ...current, ...(observed ? { result: JSON.parse(observed.toString()) } : {}) });
    }
    if (current.state !== 'ready') return res.status(409).json({ ...current, error: 'Wait for the Docker lab to finish starting.' });
    const command = await sandbox.runCommand({ cmd: 'python3', args: ['lab/control.py', ...args], sudo: true });
    if (command.exitCode !== 0) {
      console.error('Lab operation failed:', args[0], (await command.stderr()).slice(-1600));
      return res.status(503).json({ error: 'The live Docker operation failed. Retry, or start a new lab session.' });
    }
    return res.json({ ...current, result: JSON.parse(await command.stdout()) });
  } catch (error) {
    console.error('Sandbox request:', error?.status || error?.statusCode || '', error.message);
    return res.status(503).json({ error: 'The live lab is temporarily unavailable. Its hosting allowance may be in use; please try again later.' });
  }
}
