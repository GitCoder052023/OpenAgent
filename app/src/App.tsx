import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArcReactor } from './components/ArcReactor';
import { TelemetryBar } from './components/TelemetryBar';
import { ControlPanel } from './components/ControlPanel';
import { ToolCallStream } from './components/ToolCallStream';
import { TerminalLog } from './components/TerminalLog';
import { SoundWave } from './components/SoundWave';
import { Mic, Radio, Zap } from 'lucide-react';
import type { BridgeLog, Telemetry, ToolCallItem } from './types';

export function App() {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [pid, setPid] = useState<number | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [logs, setLogs] = useState<BridgeLog[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallItem[]>([]);
  const [activeToolCall, setActiveToolCall] = useState<ToolCallItem | null>(null);

  // Modes
  const [voiceMode, setVoiceMode] = useState<boolean>(false);
  const [sendMode, setSendMode] = useState<'audio' | 'text'>('audio');
  const [safeMode] = useState<boolean>(true);

  // States: 'standby' | 'listening' | 'executing' | 'playing' | 'offline'
  const [systemState, setSystemState] = useState<'standby' | 'listening' | 'executing' | 'playing' | 'offline'>('offline');
  const [playbackStatus, setPlaybackStatus] = useState<'idle' | 'playing' | 'held'>('idle');

  // Push-to-Talk interactive state
  const [isPressingTalk, setIsPressingTalk] = useState<boolean>(false);

  // Parse logs for events
  const handleLog = useCallback((log: BridgeLog) => {
    setLogs((prev) => [...prev.slice(-300), log]);

    const text = log.text;

    // Detect Tool Call
    if (text.includes('[Incoming tool call detected from Jarvis')) {
      const newCall: ToolCallItem = {
        id: Date.now().toString(),
        tool: text.includes('bash') ? 'bash' : 'tool_execution',
        timestamp: new Date().toLocaleTimeString(),
        status: 'executing',
      };
      setActiveToolCall(newCall);
      setSystemState('executing');
    } else if (text.includes('[Tool response sent in')) {
      const durationMatch = text.match(/in ([\d.]+)s/);
      const dur = durationMatch ? parseFloat(durationMatch[1]) : 0.8;
      if (activeToolCall) {
        const completed: ToolCallItem = {
          ...activeToolCall,
          status: 'completed',
          duration: dur,
          output: text,
        };
        setToolCalls((prev) => [completed, ...prev.slice(0, 19)]);
        setActiveToolCall(null);
      }
      setSystemState('standby');
    }

    // Detect Voice Note Playback
    if (text.includes('[Incoming voice note detected]')) {
      if (text.includes('Held')) {
        setPlaybackStatus('held');
      } else {
        setPlaybackStatus('playing');
        setSystemState('playing');
      }
    } else if (text.includes('[Voice note playback finished]')) {
      setPlaybackStatus('idle');
      setSystemState((prev) => (prev === 'playing' ? 'standby' : prev));
    }

    // Detect User Recording
    if (text.includes('[Recording started]')) {
      setSystemState('listening');
    } else if (text.includes('[Recording stopped]') || text.includes('Audio attachment sent') || text.includes('Text message sent')) {
      setSystemState((prev) => (prev === 'listening' ? 'standby' : prev));
    }
  }, [activeToolCall]);

  // IPC Subscriptions
  useEffect(() => {
    if (window.jarvis) {
      window.jarvis.getBridgeStatus().then((status) => {
        setIsRunning(status.running);
        setPid(status.pid);
        setSystemState(status.running ? 'standby' : 'offline');
      });

      const unsubLog = window.jarvis.onBridgeLog(handleLog);
      const unsubStatus = window.jarvis.onBridgeStatusChange((status) => {
        setIsRunning(status.running);
        setPid(status.pid);
        setSystemState(status.running ? 'standby' : 'offline');
      });
      const unsubTelemetry = window.jarvis.onTelemetry((data) => {
        setTelemetry(data);
      });

      return () => {
        unsubLog();
        unsubStatus();
        unsubTelemetry();
      };
    } else {
      // Browser preview mode simulation
      setIsRunning(true);
      setSystemState('standby');
      setTelemetry({
        cpu: 14,
        memory: 42,
        memoryUsedGB: '15.1',
        memoryTotalGB: '36.0',
        platform: 'Darwin arm64',
        uptimeSeconds: 84200,
        loadAvg: ['1.85', '1.62', '1.40'],
      });
    }
  }, [handleLog]);

  // Bridge control actions
  const handleToggleBridge = async () => {
    if (!window.jarvis) {
      setIsRunning(!isRunning);
      setSystemState(!isRunning ? 'standby' : 'offline');
      return;
    }

    if (isRunning) {
      await window.jarvis.stopBridge();
    } else {
      await window.jarvis.startBridge({
        voice: voiceMode,
        sendMode,
        unlocked: !safeMode,
      });
    }
  };

  const handleQuickAction = async (action: string) => {
    if (!window.jarvis) {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          text: `[SIMULATION] Executed quick action: ${action}`,
          type: 'system',
        },
      ]);
      return;
    }

    if (action === 'speak') {
      await window.jarvis.executeCommand('Speaker check: All Jarvis audio channels operational.');
    } else if (action === 'ping') {
      await window.jarvis.executeCommand('Harness online: latency 42ms.');
    }
  };

  const handleWindowControl = (action: 'minimize' | 'maximize' | 'close') => {
    if (window.jarvis) {
      window.jarvis.windowControl(action);
    }
  };

  // Direct Push-to-Talk click / hold
  const startTalk = () => {
    setIsPressingTalk(true);
    setSystemState('listening');
  };

  const stopTalk = () => {
    setIsPressingTalk(false);
    setSystemState('standby');
  };

  const statusLabel = useMemo(() => {
    switch (systemState) {
      case 'offline':
        return 'SYSTEM OFFLINE // INITIALIZE BRIDGE TO CONNECT';
      case 'listening':
        return 'USER RECORDING AUDIO // HOLDING INCOMING PLAYBACK';
      case 'executing':
        return 'INTERCEPTED JARVIS_CALL // EXECUTING ON MAC';
      case 'playing':
        return 'INCOMING VOICE NOTE PLAYBACK ACTIVE';
      case 'standby':
      default:
        return 'SYSTEM ACTIVE // LINKED TO WHATSAPP (+1 650 870 2892)';
    }
  }, [systemState]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#020408] text-slate-200 overflow-hidden relative font-sans">
      {/* Background Holographic Grid & Radial Arc Accents */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.05)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 scanlines opacity-40 pointer-events-none z-10" />

      {/* Top Telemetry Header */}
      <TelemetryBar
        telemetry={telemetry}
        isRunning={isRunning}
        onWindowControl={handleWindowControl}
      />

      {/* Main Tactical Dashboard */}
      <main className="flex-1 p-4 grid grid-cols-12 gap-4 overflow-hidden relative z-20">
        {/* Left Column: Bridge Matrix Controls (3 cols) */}
        <div className="col-span-3 flex flex-col h-full space-y-4">
          <ControlPanel
            isRunning={isRunning}
            pid={pid}
            voiceMode={voiceMode}
            sendMode={sendMode}
            safeMode={safeMode}
            playbackStatus={playbackStatus}
            onToggleBridge={handleToggleBridge}
            onToggleVoiceMode={() => setVoiceMode(!voiceMode)}
            onChangeSendMode={setSendMode}
            onQuickAction={handleQuickAction}
          />

          {/* Quick HUD Protocol Card */}
          <div className="hud-panel rounded-xl p-4 flex-1 flex flex-col justify-between">
            <div className="hud-corner-tl" />
            <div className="hud-corner-tr" />
            <div className="hud-corner-bl" />
            <div className="hud-corner-br" />

            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-cyan-400">
                <Zap className="w-3.5 h-3.5" />
                <span className="font-mono text-xs font-bold tracking-widest uppercase">
                  DEFENSE PROTOCOLS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
                Chat lock actively protects WhatsApp target chat from cross-window leakage.
                Safe mode rejects uncalibrated AX mutations.
              </p>
            </div>

            <div className="p-2.5 rounded bg-black/50 border border-cyan-500/10 font-mono text-[10px] space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>ECHO GUARD:</span>
                <span className="text-emerald-400 font-bold">SYNCHRONIZED</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>CONCURRENCY:</span>
                <span className="text-cyan-400 font-bold">DECOUPLED THREAD</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Column: Iconic Arc Reactor & Direct Voice Trigger (6 cols) */}
        <div className="col-span-6 flex flex-col items-center justify-between h-full space-y-3">
          {/* Tactical Status Readout Banner */}
          <div className="w-full flex items-center justify-between px-4 py-2 rounded-lg bg-slate-950/80 border border-cyan-500/20 backdrop-blur-md">
            <div className="flex items-center space-x-2">
              <Radio
                className={`w-3.5 h-3.5 ${
                  systemState === 'listening'
                    ? 'text-amber-400 animate-ping'
                    : systemState === 'executing'
                    ? 'text-cyan-300 animate-spin'
                    : systemState === 'playing'
                    ? 'text-emerald-400 animate-pulse'
                    : 'text-cyan-400'
                }`}
              />
              <span className="font-mono text-xs font-bold tracking-wider text-cyan-200">
                {statusLabel}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">MK-VII</span>
          </div>

          {/* Central Holographic Arc Reactor */}
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <ArcReactor
              status={systemState}
              onCoreClick={() => (isRunning ? handleToggleBridge() : handleToggleBridge())}
            />
          </div>

          {/* Interactive Push-to-Talk HUD Orb & Audio Wave */}
          <div className="w-full space-y-3 flex flex-col items-center">
            {/* Audio Wave Visualizer */}
            <div className="w-full max-w-md">
              <SoundWave
                active={systemState === 'listening' || systemState === 'playing'}
                color={systemState === 'listening' ? '#f59e0b' : systemState === 'playing' ? '#10b981' : '#00f0ff'}
              />
            </div>

            {/* Direct PTT Button */}
            <div className="w-full max-w-sm flex items-center justify-center">
              <button
                type="button"
                onMouseDown={startTalk}
                onMouseUp={stopTalk}
                onTouchStart={startTalk}
                onTouchEnd={stopTalk}
                disabled={!isRunning}
                className={`w-full py-3.5 px-6 rounded-xl font-mono font-bold tracking-[0.2em] uppercase transition-all duration-200 flex items-center justify-center space-x-2 border shadow-xl cursor-pointer ${
                  !isRunning
                    ? 'bg-slate-900/60 border-slate-800 text-slate-600 cursor-not-allowed'
                    : isPressingTalk
                    ? 'bg-amber-500/30 border-amber-400 text-amber-200 shadow-[0_0_25px_rgba(245,158,11,0.6)] scale-98'
                    : 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-400/40 text-cyan-300 hover:border-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.2)]'
                }`}
              >
                <Mic className={`w-4 h-4 ${isPressingTalk ? 'animate-bounce text-amber-300' : ''}`} />
                <span>{isPressingTalk ? 'TRANSMITTING VOICE...' : 'HOLD F8 OR CLICK TO TALK'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Tool Call Stream & Terminal (3 cols) */}
        <div className="col-span-3 flex flex-col h-full space-y-4">
          <ToolCallStream toolCalls={toolCalls} activeCall={activeToolCall} />
          <div className="flex-1">
            <TerminalLog logs={logs} onClear={() => setLogs([])} />
          </div>
        </div>
      </main>

      {/* Bottom Stark Telemetry Micro-Bar */}
      <footer className="px-4 py-1 bg-black/90 border-t border-cyan-500/10 flex items-center justify-between text-[10px] font-mono text-slate-500 z-20">
        <div className="flex items-center space-x-4">
          <span>STARK_INDUSTRIES // MALIBU_HQ</span>
          <span>LAT: 34.0259° N, LONG: 118.7798° W</span>
          <span>CHANNEL: WHATSAPP-DESKTOP-AX</span>
        </div>
        <div>
          <span>JARVIS BRIDGE v0.1.0-RC1</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
