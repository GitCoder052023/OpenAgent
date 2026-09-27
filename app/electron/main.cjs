const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

let mainWindow = null;
let bridgeProcess = null;
let telemetryInterval = null;

const ROOT_DIR = path.resolve(__dirname, '../../');

function getCpuUsage() {
  const cpus = os.cpus();
  let user = 0;
  let nice = 0;
  let sys = 0;
  let idle = 0;
  let irq = 0;

  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }

  const total = user + nice + sys + idle + irq;
  return { idle, total };
}

let lastCpu = getCpuUsage();

function startTelemetry(win) {
  if (telemetryInterval) clearInterval(telemetryInterval);
  telemetryInterval = setInterval(() => {
    if (!win || win.isDestroyed()) return;

    const currentCpu = getCpuUsage();
    const idleDiff = currentCpu.idle - lastCpu.idle;
    const totalDiff = currentCpu.total - lastCpu.total;
    const cpuUsage = totalDiff > 0 ? Math.max(0, Math.min(100, Math.round((1 - idleDiff / totalDiff) * 100))) : 0;
    lastCpu = currentCpu;

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = Math.round((usedMem / totalMem) * 100);

    win.webContents.send('sys:telemetry', {
      cpu: cpuUsage,
      memory: memUsage,
      memoryUsedGB: (usedMem / 1024 / 1024 / 1024).toFixed(1),
      memoryTotalGB: (totalMem / 1024 / 1024 / 1024).toFixed(1),
      platform: `${os.type()} ${os.arch()}`,
      uptimeSeconds: Math.floor(os.uptime()),
      loadAvg: os.loadavg().map((n) => n.toFixed(2)),
    });
  }, 1000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'JARVIS // STARK HUD',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#020408',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    stopBridgeProcess();
    if (telemetryInterval) clearInterval(telemetryInterval);
  });

  startTelemetry(mainWindow);
}

function stopBridgeProcess() {
  if (bridgeProcess) {
    try {
      bridgeProcess.kill('SIGINT');
      setTimeout(() => {
        if (bridgeProcess && !bridgeProcess.killed) {
          bridgeProcess.kill('SIGKILL');
        }
        bridgeProcess = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('bridge:status-change', { running: false, pid: null });
        }
      }, 1000);
    } catch {
      bridgeProcess = null;
    }
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopBridgeProcess();
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('bridge:status', () => {
  return {
    running: bridgeProcess !== null && !bridgeProcess.killed,
    pid: bridgeProcess ? bridgeProcess.pid : null,
  };
});

ipcMain.handle('bridge:start', async (_event, options = {}) => {
  if (bridgeProcess) {
    return { ok: false, message: 'Bridge already running' };
  }

  const pythonBin = path.join(ROOT_DIR, '.venv/bin/python3');
  const args = ['-m', 'bridge.main', 'run'];

  if (options.voice) {
    args.push('--voice');
  }
  if (options.sendMode) {
    args.push('--send-mode', options.sendMode);
  }
  if (options.unlocked) {
    args.push('--unlocked');
  }

  const env = {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}`,
    PYTHONUNBUFFERED: '1',
  };

  try {
    bridgeProcess = spawn(pythonBin, args, {
      cwd: ROOT_DIR,
      env,
    });

    const sendLog = (text, type = 'stdout') => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bridge:log', {
          timestamp: new Date().toLocaleTimeString(),
          text,
          type,
        });
      }
    };

    sendLog(`[SYSTEM] Starting Jarvis Bridge (PID: ${bridgeProcess.pid})`, 'system');

    bridgeProcess.stdout.on('data', (data) => {
      const text = data.toString();
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.trim()) sendLog(line, 'stdout');
      }
    });

    bridgeProcess.stderr.on('data', (data) => {
      const text = data.toString();
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.trim()) sendLog(line, 'stderr');
      }
    });

    bridgeProcess.on('exit', (code, signal) => {
      sendLog(`[SYSTEM] Bridge process exited (code: ${code}, signal: ${signal})`, 'system');
      bridgeProcess = null;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bridge:status-change', { running: false, pid: null });
      }
    });

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bridge:status-change', { running: true, pid: bridgeProcess.pid });
    }

    return { ok: true, pid: bridgeProcess.pid };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('bridge:stop', async () => {
  stopBridgeProcess();
  return { ok: true };
});

ipcMain.handle('bridge:command', async (_event, cmd) => {
  return new Promise((resolve) => {
    const pythonBin = path.join(ROOT_DIR, '.venv/bin/python3');
    const proc = spawn(pythonBin, ['-m', 'bridge.main', 'speak', '--text', cmd || 'JARVIS systems operational'], {
      cwd: ROOT_DIR,
      env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}` },
    });
    let output = '';
    proc.stdout.on('data', (d) => { output += d.toString(); });
    proc.stderr.on('data', (d) => { output += d.toString(); });
    proc.on('close', (code) => {
      resolve({ code, output });
    });
  });
});

ipcMain.on('window:control', (_event, action) => {
  if (!mainWindow) return;
  if (action === 'minimize') mainWindow.minimize();
  else if (action === 'maximize') {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  } else if (action === 'close') mainWindow.close();
});
