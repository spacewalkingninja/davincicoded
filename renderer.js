// OpenCode Terminal for DaVinci Resolve - renderer process.
// Sandboxed: talks to the main process only through window.opencode
// (exposed by preload.js) and renders the terminal with vendored xterm.js.

(function () {
  'use strict';

  var api = window.opencode;
  var config = { fontSize: 13, scrollback: 5000 };

  var term = null;
  var fitAddon = null;
  var expanded = false;

  var body = document.body;
  var openBtn = document.getElementById('openBtn');
  var collapseBtn = document.getElementById('collapseBtn');
  var restartBtn = document.getElementById('restartBtn');
  var closeBtn = document.getElementById('closeBtn');
  var termHost = document.getElementById('terminal');
  var statusEl = document.getElementById('status');

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function resolveTerminalCtor() {
    return window.Terminal || (window.Xterm && window.Xterm.Terminal) || null;
  }

  function resolveFitCtor() {
    if (!window.FitAddon) return null;
    return window.FitAddon.FitAddon || window.FitAddon;
  }

  function fit() {
    if (!fitAddon || !term || !expanded) return;
    try {
      fitAddon.fit();
      api.resize(term.cols, term.rows);
    } catch (err) { /* container not measurable yet */ }
  }

  function ensureTerminal() {
    if (term) return;

    var Terminal = resolveTerminalCtor();
    if (!Terminal) {
      setStatus('xterm missing');
      termHost.innerHTML =
        '<div class="fallback">xterm.js assets are missing.<br/>' +
        'Run <code>node install.js</code> in the plugin folder.</div>';
      return;
    }

    term = new Terminal({
      fontFamily: '"Cascadia Mono", "Consolas", "Courier New", monospace',
      fontSize: config.fontSize,
      scrollback: config.scrollback,
      cursorBlink: true,
      allowProposedApi: true,
      theme: {
        background: '#0b0d12',
        foreground: '#d7dbe0',
        cursor: '#7dd3fc',
        selectionBackground: '#2b3a4a',
        black: '#1b1f27',
        red: '#ff6b6b',
        green: '#7ee787',
        yellow: '#f0c674',
        blue: '#79c0ff',
        magenta: '#d2a8ff',
        cyan: '#56d4dd',
        white: '#c9d1d9'
      }
    });

    var Fit = resolveFitCtor();
    if (Fit) {
      fitAddon = new Fit();
      term.loadAddon(fitAddon);
    }

    term.open(termHost);
    term.onData(function (data) { api.input(data); });

    api.onOutput(function (data) { if (term) term.write(data); });

    window.addEventListener('resize', function () { window.setTimeout(fit, 40); });
    if (window.ResizeObserver) {
      var observer = new ResizeObserver(function () { window.setTimeout(fit, 40); });
      observer.observe(termHost);
    }
    window.setTimeout(function () { fit(); term.focus(); }, 60);
  }

  function expand() {
    if (expanded) return;
    expanded = true;
    body.classList.remove('collapsed');
    body.classList.add('expanded');

    ensureTerminal();      // register output listener first...
    api.setExpanded(true); // ...then let the main process resize + start the PTY
    setStatus('connected');

    window.setTimeout(function () { fit(); if (term) term.focus(); }, 120);
  }

  function collapse() {
    if (!expanded) return;
    expanded = false;
    body.classList.add('collapsed');
    body.classList.remove('expanded');
    api.setExpanded(false);
  }

  if (openBtn) openBtn.addEventListener('click', expand);
  if (collapseBtn) collapseBtn.addEventListener('click', collapse);
  if (closeBtn) closeBtn.addEventListener('click', function () { api.quit(); });
  if (restartBtn) {
    restartBtn.addEventListener('click', function () {
      if (term) term.reset();
      api.restart();
      setStatus('restarting');
      window.setTimeout(function () { fit(); if (term) term.focus(); }, 400);
    });
  }

  api.getConfig().then(function (cfg) {
    if (!cfg) return;
    config = Object.assign(config, cfg);
    if (cfg.autoExpand) expand();
  }).catch(function () { /* keep defaults */ });
})();
