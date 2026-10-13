// Post-install helper for the OpenCode Terminal Resolve plugin.
//   1. Vendors the xterm.js runtime files into ./vendor
//   2. Copies WorkflowIntegration.node from the Resolve developer package
// Run automatically via npm's postinstall, or manually: `node install.js`

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function vendorXterm() {
  const assets = [
    ['node_modules/@xterm/xterm/lib/xterm.js', 'vendor/xterm.js'],
    ['node_modules/@xterm/xterm/css/xterm.css', 'vendor/xterm.css'],
    ['node_modules/@xterm/addon-fit/lib/addon-fit.js', 'vendor/addon-fit.js']
  ];

  let copied = 0;
  for (const [src, dest] of assets) {
    const from = path.join(ROOT, src);
    if (fs.existsSync(from)) {
      copyFile(from, path.join(ROOT, dest));
      copied += 1;
    } else {
      console.warn('[install] missing ' + src + ' - run "npm install" first');
    }
  }
  if (copied) console.log('[install] vendored ' + copied + ' xterm.js asset(s) into vendor/');
}

function resolveBridgeCandidates() {
  const candidates = [];
  if (process.platform === 'win32') {
    const programData = process.env.ProgramData || 'C:\\ProgramData';
    candidates.push(path.join(programData, 'Blackmagic Design', 'DaVinci Resolve', 'Support',
      'Developer', 'Workflow Integrations', 'Examples', 'SamplePlugin', 'WorkflowIntegration.node'));
    candidates.push(path.join(programData, 'Blackmagic Design', 'DaVinci Resolve', 'Support',
      'Developer', 'Workflow Integrations', 'Examples', 'CompatibleSamplePlugin', 'WorkflowIntegration.node'));
  } else if (process.platform === 'darwin') {
    candidates.push('/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Workflow Integrations/Examples/SamplePlugin/WorkflowIntegration.node');
  }
  return candidates;
}

function copyBridge() {
  const target = path.join(ROOT, 'WorkflowIntegration.node');
  if (fs.existsSync(target)) {
    console.log('[install] WorkflowIntegration.node already present');
    return;
  }
  for (const candidate of resolveBridgeCandidates()) {
    if (fs.existsSync(candidate)) {
      copyFile(candidate, target);
      console.log('[install] copied WorkflowIntegration.node from Resolve developer package');
      return;
    }
  }
  console.warn('[install] WorkflowIntegration.node not found - the terminal still works, but Resolve APIs stay unavailable');
}

vendorXterm();
copyBridge();
console.log('[install] done. Restart DaVinci Resolve to register the plugin.');
