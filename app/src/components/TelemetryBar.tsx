import React from 'react';
import { Cpu, HardDrive, Minus, Square, X, ShieldCheck } from 'lucide-react';
import type { Telemetry } from '../types';

interface TelemetryBarProps {
  telemetry: Telemetry | null;
  isRunning: boolean;
  onWindowControl: (action: 'minimize' | 'maximize' | 'close') => void;
}

export const TelemetryBar: React.FC<TelemetryBarProps> = ({
  telemetry,
  isRunning,
  onWindowControl,
}) => {
  return (
    <header className="flex items-center justify-between px-4 py-2.5 bg-slate-950/90 border-b border-cyan-500/20 backdrop-blur-xl select-none">
      {/* Left: Branding & Status */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 pl-16">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff] animate-ping" />
          <span className="font-mono text-xs font-bold tracking-[0.25em] text-cyan-300 uppercase">
            STARK OS
          </span>
          <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">
            // J.A.R.V.I.S. MK-VII
          </span>
        </div>

        <div className="hidden lg:flex items-center px-2 py-0.5 rounded border border-cyan-500/20 bg-cyan-950/30 text-[10px] font-mono text-cyan-400">
          <ShieldCheck className="w-3 h-3 mr-1 text-cyan-400" />
          LINK: WHATSAPP (+1 650 870 2892)
        </div>
      </div>

      {/* Center: System Telemetry */}
      <div className="flex items-center space-x-6 text-[11px] font-mono">
        <div className="flex items-center space-x-2 text-slate-400">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>CPU:</span>
          <span className="font-semibold text-cyan-300">
            {telemetry ? `${telemetry.cpu}%` : '---'}
          </span>
        </div>

        <div className="flex items-center space-x-2 text-slate-400">
          <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
          <span>RAM:</span>
          <span className="font-semibold text-cyan-300">
            {telemetry ? `${telemetry.memory}% (${telemetry.memoryUsedGB}G)` : '---'}
          </span>
        </div>

        <div className="hidden md:flex items-center space-x-1.5 text-slate-400">
          <div
            className={`w-2 h-2 rounded-full ${
              isRunning ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]' : 'bg-rose-500'
            }`}
          />
          <span className="text-[10px] uppercase tracking-wider text-slate-300">
            {isRunning ? 'BRIDGE ONLINE' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center space-x-1 -webkit-app-region-no-drag">
        <button
          type="button"
          onClick={() => onWindowControl('minimize')}
          className="p-1.5 rounded hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-300 transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onWindowControl('maximize')}
          className="p-1.5 rounded hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-300 transition-colors"
          title="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => onWindowControl('close')}
          className="p-1.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
};
