import React, { useRef, useEffect, useState } from 'react';
import { Terminal, Trash2, ArrowDown } from 'lucide-react';
import type { BridgeLog } from '../types';

interface TerminalLogProps {
  logs: BridgeLog[];
  onClear: () => void;
}

export const TerminalLog: React.FC<TerminalLogProps> = ({ logs, onClear }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div className="hud-panel rounded-xl p-4 flex flex-col h-56 space-y-2">
      <div className="hud-corner-tl" />
      <div className="hud-corner-tr" />
      <div className="hud-corner-bl" />
      <div className="hud-corner-br" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
        <div className="flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-mono text-xs font-bold tracking-widest text-cyan-200 uppercase">
            STARK TERMINAL FEED // RAW STREAM
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            ({logs.length} lines)
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1 rounded text-[10px] font-mono flex items-center space-x-1 ${
              autoScroll
                ? 'text-cyan-400 bg-cyan-950/40 border border-cyan-500/30'
                : 'text-slate-500 hover:text-slate-400'
            }`}
            title="Toggle Auto-Scroll"
          >
            <ArrowDown className="w-3 h-3" />
            <span>AUTO</span>
          </button>

          <button
            type="button"
            onClick={onClear}
            className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
            title="Clear Terminal"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Stream Window */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto font-mono text-[11px] space-y-1 pr-1 bg-black/60 p-2.5 rounded border border-slate-900 select-text"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600 italic">No output yet. Initialize bridge to begin stream...</div>
        ) : (
          logs.map((log, index) => {
            const isError = log.type === 'stderr' || log.text.includes('[ERROR]') || log.text.includes('Traceback');
            const isSystem = log.type === 'system' || log.text.startsWith('[SYSTEM]');
            const isTool = log.text.includes('[Incoming tool call') || log.text.includes('[Tool response sent');
            const isVoice = log.text.includes('[Incoming voice note') || log.text.includes('[Recording');

            return (
              <div
                key={index}
                className={`leading-relaxed flex space-x-2 ${
                  isError
                    ? 'text-rose-400'
                    : isTool
                    ? 'text-cyan-300 font-semibold'
                    : isVoice
                    ? 'text-amber-300'
                    : isSystem
                    ? 'text-slate-400'
                    : 'text-slate-300'
                }`}
              >
                <span className="text-slate-600 shrink-0 text-[10px] select-none">
                  [{log.timestamp}]
                </span>
                <span className="break-all">{log.text}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
