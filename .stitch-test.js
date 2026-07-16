const { spawn } = require('child_process');

const child = spawn('npx', ['-y', 'stitch-mcp'], {
  env: { ...process.env, GOOGLE_CLOUD_PROJECT: 'jets-1b5fa' },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buffer = '';
child.stdout.on('data', (d) => {
  buffer += d.toString();
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (line.startsWith('{')) {
      try {
        const msg = JSON.parse(line);
        console.log('RESP:', JSON.stringify(msg, null, 2));
      } catch (e) {}
    }
  }
});
child.stderr.on('data', (d) => process.stderr.write('[stderr] ' + d.toString()));

function send(obj) {
  child.stdin.write(JSON.stringify(obj) + '\n');
}

send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'test', version: '1.0.0' },
}});

setTimeout(() => {
  send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
}, 3000);

setTimeout(() => { child.kill(); process.exit(0); }, 12000);
