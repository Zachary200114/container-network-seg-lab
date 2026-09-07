import { Sandbox, Snapshot } from '@vercel/sandbox';
console.log('SANDBOXES',JSON.stringify((await Sandbox.list({limit:50})).sandboxes.map(x=>({name:x.name,status:x.status,tags:x.tags}))));
console.log('SNAPSHOTS',JSON.stringify((await Snapshot.list({limit:50})).snapshots.map(x=>({id:x.id,status:x.status,size:x.sizeBytes}))));
