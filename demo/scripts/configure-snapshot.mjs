import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const {snapshotId} = JSON.parse(await readFile('.snapshot.json', 'utf8'));
const result = spawnSync('npm', ['exec','--yes','vercel','--','env','add','LAB_SNAPSHOT_ID','production,preview','--no-sensitive','--force','--yes','--scope','zachary200114s-projects'], {input:snapshotId,encoding:'utf8'});
console.log(result.stdout);
console.error(result.stderr);
process.exitCode = result.status;
