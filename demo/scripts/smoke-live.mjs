import assert from 'node:assert/strict';
const origin = process.argv[2];
if (!origin || !origin.startsWith('https://')) throw new Error('Provide the deployed HTTPS origin.');
let cookie = '';
async function call(body) {
  const response = await fetch(`${origin}/api/lab`, {method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
  const setCookie = response.headers.get('set-cookie');
  if(setCookie) cookie = setCookie.split(';')[0];
  const data = await response.json();
  assert.equal(response.status,200,JSON.stringify(data));
  return data;
}
try {
  console.log('START',await call({action:'start'}));
  let ready;
  for(let i=0;i<70;i++) {
    await new Promise(resolve=>setTimeout(resolve,2000));
    ready=await call({action:'status'});
    if(ready.state==='ready') break;
    console.log(ready.message);
  }
  assert.equal(ready.state,'ready');
  assert.equal(ready.result.nodes.length,5);
  const check=async(from,to,port,status)=>{
    const {result}=await call({action:'probe',from,to,port});
    console.log('PROBE',result);
    assert.equal(result.status,status);
  };
  await check('frontend','api',5000,'OK');
  await check('frontend','api',80,'X');
  await check('api','db',5432,'OK');
  await check('attacker','db',5432,'X');
  await call({action:'experiment',change:'db-public',enabled:true});
  await check('attacker','db',5432,'OK');
  await call({action:'experiment',change:'firewall',enabled:true});
  await check('db','api',5000,'TO');
  await call({action:'reset'});
  await check('db','api',5000,'OK');
  await check('attacker','db',5432,'X');
  const {result}=await call({action:'audit'});
  assert.equal(result.policy.length,9);
  assert.equal(result.ping.length,5);
  console.log('AUDIT',JSON.stringify(result));
  const invalid=await fetch(`${origin}/api/lab`,{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({action:'probe',from:'attacker',to:'example.com',port:80})});
  assert.equal(invalid.status,400);
  console.log('PASS: live Docker connectivity, real network/firewall changes, reset, audit, input validation.');
} finally {
  if(cookie) console.log('STOP',await call({action:'stop'}));
}
