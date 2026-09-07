import { Sandbox } from '@vercel/sandbox';
import { readFile, readdir, writeFile } from 'node:fs/promises';
let source;
for(const file of ['.snapshot.json','.snapshot-debug.json']) {
  try { source = {type:'snapshot',snapshotId:JSON.parse(await readFile(file,'utf8')).snapshotId}; break; } catch {}
}
const sandbox = await Sandbox.create({ name: `seg-build-${Date.now()}`, source, persistent: false, timeout: 600000, resources: { vcpus: 2 }, tags: { app: 'segmentation-build' } });
console.log('Sandbox:', sandbox.name);
try {
  await sandbox.runCommand('mkdir', ['-p', 'lab']);
  const files = (await readdir('lab',{withFileTypes:true})).filter(e=>e.isFile()&&!e.name.startsWith('.')).map(e=>e.name);
  await sandbox.writeFiles(await Promise.all(files.map(async path => ({ path: `lab/${path}`, content: await readFile(`lab/${path}`) }))));
  const result = await sandbox.runCommand({ cmd: 'sh', args: ['lab/provision.sh'], sudo: true, stdout: process.stdout, stderr: process.stderr });
  if (result.exitCode !== 0) throw new Error('Docker provisioning failed');
  const audit = await sandbox.runCommand({cmd:'python3',args:['lab/control.py','audit'],sudo:true});
  console.log('REAL_AUDIT',await audit.stdout());
  if(audit.exitCode) throw new Error(await audit.stderr());
  const clean = await sandbox.runCommand({cmd:'sh',args:['-c','docker rm -f frontend api db mgmt attacker; docker network rm public_net private_net mgmt_net; rm -f /vercel/ready /vercel/failed; kill $(cat /var/run/docker.pid)'],sudo:true});
  if(clean.exitCode) throw new Error(await clean.stderr());
  const snapshot = await sandbox.snapshot({ expiration: 0 });
  await writeFile('.snapshot.json', JSON.stringify({snapshotId:snapshot.snapshotId},null,2));
  console.log('SNAPSHOT',snapshot.snapshotId);
} catch(error) {
  const debug = await sandbox.runCommand({cmd:'sh',args:['-c','docker ps -a; tail -25 dockerd.log'],sudo:true});
  console.log(await debug.stdout());
  const snapshot = await sandbox.snapshot({expiration:24*60*60*1000});
  await writeFile('.snapshot-debug.json',JSON.stringify({snapshotId:snapshot.snapshotId}));
  throw error;
} finally { if(sandbox.status==='running') await sandbox.stop(); }
