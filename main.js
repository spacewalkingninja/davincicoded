// OpenCode Terminal for DaVinci Resolve - Electron main process.
// Follows Blackmagic's recommended (sandboxed + context-isolated) plugin model:
// Resolve APIs and child processes live here; the renderer only talks to a
// narrow contextBridge surface exposed by preload.js.

const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const PLUGIN_DIR = __dirname;
const PLUGIN_ID = 'com.opencode.resolve.terminal';

// --- File logging (console output is invisible inside Resolve) ---
const LOG_FILE = path.join(os.tmpdir(), 'opencode-terminal.log');
function log(message) {
  try { fs.appendFileSync(LOG_FILE, new Date().toISOString() + ' ' + message + '\n'); } catch (err) { /* ignore */ }
}
process.on('uncaughtException', (err) => log('UNCAUGHT: ' + (err && err.stack || err)));
process.on('unhandledRejection', (err) => log('UNHANDLED: ' + (err && err.stack || err)));
log('---- main.js loaded (pid ' + process.pid + ', electron ' + process.versions.electron + ') ----');

// Resolve scripting bridge is optional: the terminal works without it.
let workflowIntegration = null;
try {
  workflowIntegration = require('./WorkflowIntegration.node');
} catch (err) {
  console.warn('[opencode] WorkflowIntegration.node unavailable:', err.message);
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  shell: process.env.ComSpec || 'cmd.exe',
  command: 'opencode',
  cwd: process.env.USERPROFILE || process.cwd(),
  panelFraction: 0.2,          // 1/5 of the display width
  collapsedWidth: 46,          // thin ribbon strip
  alwaysOnTop: true,
  fontSize: 13,
  scrollback: 5000,
  env: {}
};

function loadConfig() {
  try {
    const raw = fs.readFileSync(path.join(PLUGIN_DIR, 'config.json'), 'utf8');
    const merged = Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw));
    if (!merged.cwd) merged.cwd = DEFAULT_CONFIG.cwd;
    return merged;
  } catch (err) {
    console.warn('[opencode] Falling back to default config:', err.message);
    return Object.assign({}, DEFAULT_CONFIG);
  }
}

const CONFIG = loadConfig();

let mainWindow = null;

// ---------------------------------------------------------------------------
// Window geometry: docked to the right edge of the primary display
// ---------------------------------------------------------------------------

function expandedWidth() {
  const { workArea } = screen.getPrimaryDisplay();
  return Math.max(360, Math.round(workArea.width * (CONFIG.panelFraction || 0.2)));
}

function computeBounds(expanded) {
  const { workArea } = screen.getPrimaryDisplay();
  const width = expanded ? expandedWidth() : (CONFIG.collapsedWidth || 46);
  return {
    x: workArea.x + workArea.width - width,
    y: workArea.y,
    width: width,
    height: workArea.height
  };
}

// ---------------------------------------------------------------------------
// PTY sidecar (run with the system Node, so node-pty matches the Node ABI
// instead of Resolve's bundled Electron ABI)
// ---------------------------------------------------------------------------

let sidecar = null;
let sidecarBuffer = '';
let lastSize = { cols: 80, rows: 24 };

function emitOutput(data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('oc:output', data);
  }
}

function findNode() {
  if (process.env.OPENCODE_RESOLVE_NODE && fs.existsSync(process.env.OPENCODE_RESOLVE_NODE)) {
    return process.env.OPENCODE_RESOLVE_NODE;
  }
  const candidates = [];
  if (process.env.ProgramFiles) candidates.push(path.join(process.env.ProgramFiles, 'nodejs', 'node.exe'));
  if (process.env['ProgramFiles(x86)']) candidates.push(path.join(process.env['ProgramFiles(x86)'], 'nodejs', 'node.exe'));
  if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'nodejs', 'node.exe'));
  for (const candidate of candidates) {
    try { if (fs.existsSync(candidate)) return candidate; } catch (err) { /* ignore */ }
  }
  return 'node'; // rely on PATH
}

function sendToSidecar(message) {
  if (sidecar && sidecar.stdin && sidecar.stdin.writable) {
    try { sidecar.stdin.write(JSON.stringify(message) + '\n'); } catch (err) { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Resolve window manager: dock Resolve to the left so the panel never overlaps
// ---------------------------------------------------------------------------

function findPowerShell() {
  const root = process.env.SystemRoot || 'C:\\Windows';
  const candidates = [
    path.join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    path.join(root, 'SysWOW64', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  ];
  for (const candidate of candidates) {
    try { if (fs.existsSync(candidate)) return candidate; } catch (err) { /* ignore */ }
  }
  return 'powershell';
}

function winMgrArgs(action) {
  return ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(PLUGIN_DIR, 'winmgr.ps1'),
    '-Action', action, '-Fraction', String(CONFIG.panelFraction || 0.2),
    '-StateFile', path.join(os.tmpdir(), 'opencode-terminal-dock.json')];
}

function runWinMgr(action) {
  return new Promise((resolve) => {
    if (CONFIG.resizeResolve === false) return resolve(null);
    let out = '';
    let ps;
    try {
      ps = spawn(findPowerShell(), winMgrArgs(action), { windowsHide: true });
    } catch (err) {
      log('winmgr spawn failed: ' + err.message);
      return resolve(null);
    }
    ps.stdout.on('data', (d) => { out += d.toString('utf8'); });
    ps.stderr.on('data', (d) => { log('winmgr stderr: ' + d.toString().trim()); });
    ps.on('error', (err) => { log('winmgr error: ' + err.message); resolve(null); });
    ps.on('close', () => {
      let parsed = null;
      try { parsed = JSON.parse(out.trim().split(/\r?\n/).pop()); } catch (err) { /* ignore */ }
      log('winmgr ' + action + ' -> ' + (out.trim() || '(no output)'));
      resolve(parsed);
    });
  });
}

// Restore must outlive app shutdown, so run it detached.
function restoreResolveDetached() {
  if (CONFIG.resizeResolve === false) return;
  try {
    const child = spawn(findPowerShell(), winMgrArgs('restore'), { windowsHide: true, detached: true, stdio: 'ignore' });
    child.unref();
  } catch (err) { /* ignore */ }
}

function handleSidecarLine(line) {
  if (!line.trim()) return;
  let message;
  try { message = JSON.parse(line); } catch (err) { return; }
  if (message.t === 'out') {
    emitOutput(message.d);
  } else if (message.t === 'error') {
    emitOutput('\r\n[opencode] ' + message.message + '\r\n');
  } else if (message.t === 'exit') {
    emitOutput('\r\n[opencode] process exited (code ' + message.code + ').\r\n');
  }
}

function startSidecar() {
  if (sidecar) return;

  const nodeExe = findNode();
  const serverPath = path.join(PLUGIN_DIR, 'pty-server.js');
  log('startSidecar node=' + nodeExe + ' server=' + serverPath);

  try {
    sidecar = spawn(nodeExe, [serverPath], {
      cwd: PLUGIN_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      env: Object.assign({}, process.env, {
        OPENCODE_RESOLVE_PLUGIN_DIR: PLUGIN_DIR
      })
    });
  } catch (err) {
    emitOutput('\r\n[opencode] Failed to launch PTY sidecar with "' + nodeExe + '": ' + err.message + '\r\n');
    return;
  }

  sidecar.stdout.setEncoding('utf8');
  sidecar.stdout.on('data', (chunk) => {
    sidecarBuffer += chunk;
    let index;
    while ((index = sidecarBuffer.indexOf('\n')) !== -1) {
      const line = sidecarBuffer.slice(0, index);
      sidecarBuffer = sidecarBuffer.slice(index + 1);
      handleSidecarLine(line);
    }
  });

  sidecar.stderr.setEncoding('utf8');
  sidecar.stderr.on('data', (chunk) => {
    emitOutput('\r\n[opencode] ' + chunk.replace(/\r?\n/g, '\r\n'));
  });

  sidecar.on('error', (err) => {
    emitOutput('\r\n[opencode] sidecar error: ' + err.message + '\r\n');
  });

  sidecar.on('exit', (code) => {
    sidecar = null;
    sidecarBuffer = '';
    emitOutput('\r\n[opencode] session closed (code ' + code + '). Press \u21bb to restart.\r\n');
  });

  sendToSidecar({
    t: 'start',
    shell: CONFIG.shell,
    command: CONFIG.command,
    cwd: CONFIG.cwd,
    env: CONFIG.env || {},
    cols: lastSize.cols,
    rows: lastSize.rows,
    autoStart: true
  });
}

function stopSidecar() {
  if (!sidecar) return;
  try { sidecar.kill(); } catch (err) { /* ignore */ }
  sidecar = null;
  sidecarBuffer = '';
}

// ---------------------------------------------------------------------------
// IPC surface
// ---------------------------------------------------------------------------

ipcMain.handle('oc:getConfig', () => ({
  fontSize: CONFIG.fontSize,
  scrollback: CONFIG.scrollback,
  command: CONFIG.command,
  cwd: CONFIG.cwd,
  expandedWidth: expandedWidth(),
  autoExpand: (CONFIG.startExpanded !== false) || process.env.OPENCODE_RESOLVE_AUTOSTART === '1'
}));

ipcMain.on('oc:setExpanded', async (_event, expanded) => {
  log('ipc oc:setExpanded ' + expanded);
  if (!mainWindow) return;
  if (expanded) {
    const rect = await runWinMgr('dock'); // shrink Resolve, returns its original rect
    if (rect && rect.ok) {
      const panelW = Math.max(320, Math.round(rect.width * (CONFIG.panelFraction || 0.2)));
      mainWindow.setBounds({ x: rect.left + rect.width - panelW, y: rect.top, width: panelW, height: rect.height });
      log('docked beside Resolve: panel x=' + (rect.left + rect.width - panelW) + ' w=' + panelW);
    } else {
      mainWindow.setBounds(computeBounds(true));
    }
    startSidecar();
  } else {
    await runWinMgr('restore');
    mainWindow.setBounds(computeBounds(false));
  }
});

ipcMain.on('oc:input', (_event, data) => sendToSidecar({ t: 'in', d: String(data) }));

ipcMain.on('oc:resize', (_event, size) => {
  lastSize = { cols: Math.max(1, size && size.cols || 80), rows: Math.max(1, size && size.rows || 24) };
  sendToSidecar({ t: 'resize', cols: lastSize.cols, rows: lastSize.rows });
});

ipcMain.on('oc:restart', () => {
  stopSidecar();
  startSidecar();
});

ipcMain.on('oc:quit', () => app.quit());

// ---------------------------------------------------------------------------
// Window lifecycle
// ---------------------------------------------------------------------------

function createWindow() {
  const startExpanded = CONFIG.startExpanded !== false;
  const bounds = computeBounds(startExpanded);
  log('createWindow bounds=' + JSON.stringify(bounds) + ' expanded=' + startExpanded);

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    useContentSize: true,
    frame: false,
    resizable: true,
    movable: false,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
    show: false,
    backgroundColor: '#0f1115',
    title: 'OpenCode',
    webPreferences: {
      preload: path.join(PLUGIN_DIR, 'preload.js')
    }
  });

  if (mainWindow.setMenuBarVisibility) mainWindow.setMenuBarVisibility(false);
  if (CONFIG.alwaysOnTop) mainWindow.setAlwaysOnTop(true, 'floating');

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', () => { stopSidecar(); restoreResolveDetached(); });
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.loadFile(path.join(PLUGIN_DIR, 'index.html'));
}

app.whenReady().then(() => {
  // NOTE: we deliberately do not call WorkflowIntegration.Initialize() here.
  // The terminal does not use Resolve's scripting bridge, and Initialize() can
  // block the main process when the plugin is not hosted by Resolve.
  createWindow();
});

app.on('window-all-closed', () => {
  stopSidecar();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  stopSidecar();
  restoreResolveDetached();
});
