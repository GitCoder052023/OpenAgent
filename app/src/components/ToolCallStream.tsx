import React from 'react';
import { Cpu, Terminal, CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import type { ToolCallItem } from '../types';

interface ToolCallStreamProps {
  toolCalls: ToolCallItem[];
  activeCall: ToolCallItem | null;
}

export const ToolCallStream: React.FC<ToolCallStreamProps> = ({
  toolCalls,
  activeCall,
}) => {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="hud-panel rounded-xl p-5 flex flex-col h-full space-y-4">
      <div className="hud-corner-tl" />
      <div className="hud-corner-tr" />
      <div className="hud-corner-bl" />
      <div className="hud-corner-br" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
        <div className="flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold tracking-widest text-cyan-200 uppercase">
            TOOL INTERCEPTOR STREAM
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/20 text-cyan-400">
          ENVELOPE: BASE64
        </span>
      </div>

      {/* Active Call Live Banner */}
      {activeCall && (
        <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,240,255,0.2)] animate-pulse flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-cyan-300" />
            <span className="font-mono text-xs font-bold text-cyan-200">
              EXECUTING: {activeCall.tool.toUpperCase()}
            </span>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 animate-spin">◒</span>
        </div>
      )}

      {/* List of Tool Calls */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[320px]">
        {toolCalls.length === 0 ? (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-cyan-500/20 rounded-lg text-slate-500 font-mono text-xs space-y-2">
            <Terminal className="w-6 h-6 text-slate-600 animate-pulse" />
            <span>Awaiting incoming JARVIS_CALL envelopes...</span>
            <span className="text-[10px] text-slate-600">Commands like bash, file_read execute instantly</span>
          </div>
        ) : (
          toolCalls.map((call) => {
            const isExpanded = expandedId === call.id;
            return (
              <div
                key={call.id}
                className="p-3 rounded-lg bg-slate-900/60 border border-cyan-500/20 hover:border-cyan-500/40 transition-colors"
              >
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => toggleExpand(call.id)}
                >
                  <div className="flex items-center space-x-2">
                    {call.status === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : call.status === 'failed' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    )}
                    <span className="font-mono text-xs font-bold text-slate-200 uppercase">
                      {call.tool}
                    </span>
                    {call.args?.command && (
                      <span className="font-mono text-[11px] text-cyan-400/80 truncate max-w-[140px]">
                        `{call.args.command}`
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
                    {call.duration && <span>{call.duration.toFixed(2)}s</span>}
                    <span>{call.timestamp}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </div>
                </div>

                {isExpanded && call.output && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800">
                    <pre className="text-[10px] font-mono p-2 rounded bg-black/80 text-cyan-300 overflow-x-auto max-h-36 whitespace-pre-wrap">
                      {call.output}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
