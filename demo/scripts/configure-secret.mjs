import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const key = randomBytes(48).toString('hex');
const result = spawnSync('npm', ['exec', '--yes', 'vercel', '--', 'env', 'add', 'LAB_SESSION_SECRET', 'production,preview', '--sensitive', '--yes', '--force', '--scope', 'zachary200114s-projects'], { input: key, encoding: 'utf8' });
console.log(result.stdout);
console.error(result.stderr);
process.exitCode = result.status;
