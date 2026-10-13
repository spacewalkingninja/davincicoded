// PTY sidecar for the OpenCode Terminal panel.
// Runs under the system Node (not Electron) so node-pty matches the Node ABI.
// Speaks newline-delimited JSON over stdio with the Electron main process:
//   in:  { t: "start", shell, command, cwd, env, cols, rows, autoStart }
//        { t: "in", d: "<keystrokes>" }
//        { t: "resize", cols, rows }
//        { t: "kill" }
//   out: { t: "out", d: "<terminal bytes>" }
//        { t: "error", message }
//        { t: "exit", code }

const path = require('path');

let pty;
try {
  pty = require('node-pty');
} catch (err) {
  process.stdout.write(JSON.stringify({
    t: 'error',
    message: 'node-pty is not installed. Run "npm install" in the plugin folder. (' + err.message + ')'
  }) + '\n');
  process.exit(1);
}

let child = null;
let startOptions = null;

function emit(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function startShell(options) {
  startOptions = options || {};

  const shell = startOptions.shell || process.env.ComSpec || 'cmd.exe';
  const cwd = startOptions.cwd || process.env.USERPROFILE || process.cwd();
  const cols = Math.max(1, startOptions.cols || 80);
  const rows = Math.max(1, startOptions.rows || 24);

  const env = Object.assign({}, process.env, startOptions.env || {});
  const npmBin = path.join(process.env.APPDATA || '', 'npm');
  if (npmBin) {
    env.Path = npmBin + ';' + (env.Path || env.PATH || '');
    env.PATH = env.Path;
  }
  env.TERM = 'xterm-256color';

  try {
    child = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: cols,
      rows: rows,
      cwd: cwd,
      env: env,
      useConpty: true
    });
  } catch (err) {
    emit({ t: 'error', message: 'Failed to spawn shell "' + shell + '": ' + err.message });
    return;
  }

  child.onData(function (data) { emit({ t: 'out', d: data }); });
  child.onExit(function (event) {
    emit({ t: 'exit', code: event && event.exitCode });
    child = null;
  });

  if (startOptions.autoStart !== false && startOptions.command) {
    // Give the shell a moment to draw its prompt, then launch OpenCode.
    setTimeout(function () {
      if (child) {
        try { child.write(startOptions.command + '\r'); } catch (err) { /* ignore */ }
      }
    }, 700);
  }
}

function handle(message) {
  switch (message.t) {
    case 'start':
      if (!child) startShell(message);
      break;
    case 'in':
      if (child) { try { child.write(String(message.d)); } catch (err) { /* ignore */ } }
      break;
    case 'resize':
      if (child) {
        try { child.resize(Math.max(1, message.cols), Math.max(1, message.rows)); } catch (err) { /* ignore */ }
      }
      break;
    case 'kill':
      shutdown();
      break;
    default:
      break;
  }
}

function shutdown() {
  if (child) {
    try { child.kill(); } catch (err) { /* ignore */ }
    child = null;
  }
  process.exit(0);
}

process.stdin.setEncoding('utf8');
let buffer = '';
process.stdin.on('data', function (chunk) {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, index);
    buffer = buffer.slice(index + 1);
    if (!line.trim()) continue;
    let message;
    try { message = JSON.parse(line); } catch (err) { continue; }
    handle(message);
  }
});

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', function (err) {
  emit({ t: 'error', message: 'sidecar exception: ' + (err && err.message) });
});
