// Preload for the OpenCode Terminal panel.
// Runs in the sandboxed renderer; exposes a minimal, explicit IPC surface.

const { contextBridge, ipcRenderer } = require('electron/renderer');

contextBridge.exposeInMainWorld('opencode', {
  getConfig: () => ipcRenderer.invoke('oc:getConfig'),
  setExpanded: (expanded) => ipcRenderer.send('oc:setExpanded', !!expanded),
  input: (data) => ipcRenderer.send('oc:input', data),
  resize: (cols, rows) => ipcRenderer.send('oc:resize', { cols, rows }),
  restart: () => ipcRenderer.send('oc:restart'),
  quit: () => ipcRenderer.send('oc:quit'),
  onOutput: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('oc:output', listener);
    return () => ipcRenderer.removeListener('oc:output', listener);
  }
});
