import React from 'react';
import {
  Play,
  Square,
  Mic,
  FileAudio,
  Radio,
  FileText,
  Volume2,
  Terminal,
  Pause,
} from 'lucide-react';

interface ControlPanelProps {
  isRunning: boolean;
  pid: number | null;
  voiceMode: boolean;
  sendMode: 'audio' | 'text';
  safeMode: boolean;
  playbackStatus: 'idle' | 'playing' | 'held';
  onToggleBridge: () => void;
  onToggleVoiceMode: () => void;
  onChangeSendMode: (mode: 'audio' | 'text') => void;
  onQuickAction: (action: string) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isRunning,
  pid,
  voiceMode,
  sendMode,
  safeMode,
  playbackStatus,
  onToggleBridge,
  onToggleVoiceMode,
  onChangeSendMode,
  onQuickAction,
}) => {
  return (
    <div className="hud-panel rounded-xl p-5 flex flex-col space-y-5 text-sm">
      <div className="hud-corner-tl" />
      <div className="hud-corner-tr" />
      <div className="hud-corner-bl" />
      <div className="hud-corner-br" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
        <div className="flex items-center space-x-2">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="font-mono text-xs font-bold tracking-widest text-cyan-200 uppercase">
            BRIDGE MATRIX
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
          PID: {pid || 'NONE'}
        </span>
      </div>

      {/* Primary Bridge Activation Toggle */}
      <div>
        <button
          type="button"
          onClick={onToggleBridge}
          className={`w-full py-3 px-4 rounded-lg font-mono font-bold tracking-widest uppercase transition-all duration-300 flex items-center justify-center space-x-2 border shadow-lg cursor-pointer ${
            isRunning
              ? 'bg-rose-950/60 border-rose-500/50 text-rose-300 hover:bg-rose-900/80 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
              : 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/80 shadow-[0_0_15px_rgba(0,240,255,0.3)]'
          }`}
        >
          {isRunning ? (
            <>
              <Square className="w-4 h-4 fill-current" />
              <span>TERMINATE BRIDGE</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>INITIALIZE BRIDGE</span>
            </>
          )}
        </button>
      </div>

      {/* Mode Switches */}
      <div className="space-y-3 pt-1">
        <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">
          OPERATIONAL MODES
        </span>

        {/* Input Mode: Hotkey vs Voice Wake */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => voiceMode && onToggleVoiceMode()}
            className={`py-2 px-3 rounded border text-xs font-mono flex items-center justify-center space-x-1.5 transition-all ${
              !voiceMode
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>PUSH [F8]</span>
          </button>

          <button
            type="button"
            onClick={() => !voiceMode && onToggleVoiceMode()}
            className={`py-2 px-3 rounded border text-xs font-mono flex items-center justify-center space-x-1.5 transition-all ${
              voiceMode
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>VOICE WAKE</span>
          </button>
        </div>

        {/* Send Mode: Audio vs Text */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onChangeSendMode('audio')}
            className={`py-2 px-3 rounded border text-xs font-mono flex items-center justify-center space-x-1.5 transition-all ${
              sendMode === 'audio'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <FileAudio className="w-3.5 h-3.5" />
            <span>AUDIO [M4A]</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeSendMode('text')}
            className={`py-2 px-3 rounded border text-xs font-mono flex items-center justify-center space-x-1.5 transition-all ${
              sendMode === 'text'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_10px_rgba(0,240,255,0.2)]'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>WHISPER STT</span>
          </button>
        </div>
      </div>

      {/* Real-time Status Badges */}
      <div className="space-y-2 pt-2 border-t border-cyan-500/10">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">CHAT LOCK:</span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              safeMode
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
            }`}
          >
            {safeMode ? 'SAFE MODE (CALIBRATED)' : 'UNLOCKED'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">VOICE PLAYBACK:</span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center space-x-1 ${
              playbackStatus === 'playing'
                ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 animate-pulse'
                : playbackStatus === 'held'
                ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
          >
            {playbackStatus === 'held' && <Pause className="w-2.5 h-2.5 mr-1" />}
            {playbackStatus === 'playing'
              ? 'ACTIVE AUDIO'
              : playbackStatus === 'held'
              ? 'HOLD (USER SPEAKING)'
              : 'IDLE'}
          </span>
        </div>
      </div>

      {/* Quick Diagnostic Actions */}
      <div className="pt-2 border-t border-cyan-500/10 space-y-2">
        <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">
          DIAGNOSTIC CONTROLS
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onQuickAction('speak')}
            className="py-1.5 px-2 rounded bg-slate-900/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/40 text-[11px] font-mono text-slate-300 hover:text-cyan-300 flex items-center justify-center space-x-1 transition-all"
          >
            <Volume2 className="w-3 h-3 text-cyan-400" />
            <span>TEST SPEECH</span>
          </button>

          <button
            type="button"
            onClick={() => onQuickAction('ping')}
            className="py-1.5 px-2 rounded bg-slate-900/80 hover:bg-cyan-950/40 border border-slate-800 hover:border-cyan-500/40 text-[11px] font-mono text-slate-300 hover:text-cyan-300 flex items-center justify-center space-x-1 transition-all"
          >
            <Terminal className="w-3 h-3 text-cyan-400" />
            <span>PING HARNESS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
