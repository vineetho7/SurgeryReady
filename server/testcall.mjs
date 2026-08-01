import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:8080/agent');
let audioBytes = 0;
const t = setTimeout(() => { console.log(`\n(timeout) audio bytes received: ${audioBytes}`); process.exit(0); }, 30000);
ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'start', mode: 'patient', subject: 'Maria Santos',
    context: 'Maria Santos, colonoscopy tomorrow at 07:30, sedation planned. Readiness: not yet called.',
  }));
});
ws.on('message', (d, isBin) => {
  if (isBin) { audioBytes += d.length; return; }
  const m = JSON.parse(d.toString());
  if (m.type === 'ready') {
    console.log('handshake ok, injecting patient utterance...');
    setTimeout(() => ws.send(JSON.stringify({
      type: 'inject', text: 'I was planning to have coffee with a little milk in the morning before I come in.',
    })), 1500);
  }
  if (m.type === 'turn') console.log(`  [${m.speaker}] ${m.text}`);
  if (m.type === 'tool') console.log(`  <tool: ${m.name}>`);
  if (m.type === 'error') console.log('  ERROR:', m.message);
});
ws.on('error', e => { console.log('ws error', e.message); process.exit(1); });
