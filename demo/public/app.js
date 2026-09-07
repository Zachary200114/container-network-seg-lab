const $ = id => document.getElementById(id);
const nodes = ['frontend', 'api', 'db', 'mgmt', 'attacker'];
let ready = false;
let busy = false;
let expiresAt = null;
let poll;

function controls() {
  document.querySelectorAll('[data-ready]').forEach(el => { el.disabled = !ready || busy; });
  $('start').disabled = busy || Boolean(expiresAt);
  $('stop').disabled = busy || !expiresAt;
}

function session(data) {
  ready = data.state === 'ready';
  if (data.expiresAt) expiresAt = Date.parse(data.expiresAt);
  if (['stopped', 'failed'].includes(data.state)) {
    expiresAt = null; clearTimeout(poll);
    const row = document.createElement('tr'); const cell = td('No lab running.'); cell.colSpan = 3; row.append(cell);
    $('containers').tBodies[0].replaceChildren(row);
  }
  if (data.message) $('session-status').textContent = data.message;
  if (data.result?.nodes) renderContainers(data.result);
  controls();
}

async function request(body) {
  const response = await fetch('/api/lab', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (data.state) session(data);
  if (!response.ok) throw new Error(data.error || 'The lab request failed.');
  return data;
}

async function action(body, callback) {
  if (busy) return;
  busy = true;
  $('error').hidden = true;
  controls();
  try {
    const data = await request(body);
    if (callback) callback(data);
  } catch (error) {
    $('error').textContent = error.message;
    $('error').hidden = false;
  } finally { busy = false; controls(); }
}

function td(text, header = false) {
  const el = document.createElement(header ? 'th' : 'td');
  el.textContent = String(text);
  if (header) el.scope = 'row';
  if (text === 'OK') el.className = 'ok';
  if (['X', 'TO'].includes(text)) el.className = 'blocked';
  return el;
}

function renderContainers(result) {
  $('containers').tBodies[0].replaceChildren(...result.nodes.map(node => {
    const row = document.createElement('tr');
    row.append(td(node.name, true), td(node.running ? 'Running' : 'Stopped'), td(node.networks.join(', ')));
    return row;
  }));
  $('db-public').checked = result.dbPublic;
  $('firewall').checked = result.firewallEnabled;
}

function clearMeasurements() {
  for (const [id, count] of [['ping-matrix', 6], ['policy-checks', 6]]) {
    const row = document.createElement('tr');
    const cell = td('Network settings changed. Run connectivity tests for fresh results.');
    cell.colSpan = count;
    row.append(cell);
    $(id).tBodies[0].replaceChildren(row);
  }
  $('last-updated').textContent = 'Measurements need to be refreshed.';
  $('probe-result').textContent = 'Choose a container pair to test.';
}

async function pollReady() {
  if (!expiresAt) return;
  try {
    const data = await request({ action: 'status' });
    if (data.state === 'starting') poll = setTimeout(pollReady, 2500);
    else if (data.state === 'ready') $('session-status').textContent = 'Ready. Your five Docker containers are running.';
  } catch (error) {
    $('error').textContent = error.message;
    $('error').hidden = false;
    if (expiresAt) poll = setTimeout(pollReady, 5000);
  }
}

$('start').addEventListener('click', () => action({ action: 'start' }, () => { clearMeasurements(); poll = setTimeout(pollReady, 1500); }));
$('stop').addEventListener('click', () => action({ action: 'stop' }));
$('audit').addEventListener('click', () => action({ action: 'audit' }, ({result}) => {
  $('last-updated').textContent = new Date(result.measuredAt).toLocaleString();
  $('ping-matrix').tBodies[0].replaceChildren(...result.ping.map(entry => {
    const row = document.createElement('tr');
    row.append(td(entry.from, true), ...nodes.map(node => td(entry.to[node])));
    return row;
  }));
  $('policy-checks').tBodies[0].replaceChildren(...result.policy.map(entry => {
    const row = document.createElement('tr');
    row.append(td(entry.from, true), td(entry.to), td(entry.port), td(entry.declaredAllowed ? 'Yes' : 'No'), td(entry.status), td(entry.reason));
    return row;
  }));
}));
$('probe-form').addEventListener('submit', event => {
  event.preventDefault();
  action({ action: 'probe', from: $('from').value, to: $('to').value, port: Number($('port').value) }, ({result}) => {
    $('probe-result').textContent = `${result.from} → ${result.to}:${result.port} — ${result.status}: ${result.reason}. Measured in ${result.durationMs} ms. Policy declaration: ${result.declaredAllowed ? 'allowed' : 'not listed'}.`;
  });
});
for (const change of ['db-public', 'firewall']) $(change).addEventListener('change', event => {
  action({ action: 'experiment', change, enabled: event.target.checked }, () => clearMeasurements());
});
$('reset').addEventListener('click', () => action({ action: 'reset' }, () => clearMeasurements()));
setInterval(() => {
  if (!expiresAt) { $('timer').textContent = ''; return; }
  const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
  $('timer').textContent = `Session remaining: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  if (!remaining) session({ state: 'stopped', message: 'Your five-minute lab session has ended. Start a new lab to continue.' });
}, 1000);
// Restore an existing HttpOnly-cookie session after a page refresh without creating one.
request({ action: 'status' }).then(data => { if (data.state === 'starting') pollReady(); }).catch(() => {});
