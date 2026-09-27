const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvis', {
  isElectron: true,
  startBridge: (options) => ipcRenderer.invoke('bridge:start', options),
  stopBridge: () => ipcRenderer.invoke('bridge:stop'),
  getBridgeStatus: () => ipcRenderer.invoke('bridge:status'),
  executeCommand: (command) => ipcRenderer.invoke('bridge:command', command),
  windowControl: (action) => ipcRenderer.send('window:control', action),
  
  onBridgeLog: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('bridge:log', subscription);
    return () => ipcRenderer.removeListener('bridge:log', subscription);
  },
  onBridgeStatusChange: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('bridge:status-change', subscription);
    return () => ipcRenderer.removeListener('bridge:status-change', subscription);
  },
  onTelemetry: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('sys:telemetry', subscription);
    return () => ipcRenderer.removeListener('sys:telemetry', subscription);
  },
});
