import React, { useMemo } from 'react';

interface ArcReactorProps {
  status: 'standby' | 'listening' | 'executing' | 'playing' | 'offline';
  pulseIntensity?: number;
  onCoreClick?: () => void;
}

export const ArcReactor: React.FC<ArcReactorProps> = ({
  status,
  onCoreClick,
}) => {
  const isListening = status === 'listening';
  const isExecuting = status === 'executing';
  const isPlaying = status === 'playing';
  const isOffline = status === 'offline';

  const themeColors = useMemo(() => {
    if (isOffline) {
      return {
        primary: '#475569',
        secondary: '#1e293b',
        glow: 'rgba(71, 85, 105, 0.2)',
        core: '#334155',
      };
    }
    if (isListening) {
      return {
        primary: '#f59e0b',
        secondary: '#fbbf24',
        glow: 'rgba(245, 158, 11, 0.7)',
        core: '#d97706',
      };
    }
    if (isExecuting) {
      return {
        primary: '#38bdf8',
        secondary: '#00f0ff',
        glow: 'rgba(56, 189, 248, 0.8)',
        core: '#0284c7',
      };
    }
    if (isPlaying) {
      return {
        primary: '#10b981',
        secondary: '#34d399',
        glow: 'rgba(16, 185, 129, 0.7)',
        core: '#059669',
      };
    }
    return {
      primary: '#00f0ff',
      secondary: '#0284c7',
      glow: 'rgba(0, 240, 255, 0.6)',
      core: '#00e5ff',
    };
  }, [status, isListening, isExecuting, isPlaying, isOffline]);

  return (
    <div className="relative flex items-center justify-center w-72 h-72 md:w-88 md:h-88">
      {/* Outer Background Glow */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-700 blur-2xl opacity-40 pointer-events-none"
        style={{ background: themeColors.glow }}
      />

      {/* SVG HUD Concentric System */}
      <svg
        className="w-full h-full"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Layer 0: Compass / Radian Ticks (Static reference ring) */}
        <circle
          cx="200"
          cy="200"
          r="190"
          stroke={themeColors.primary}
          strokeWidth="0.75"
          strokeOpacity="0.25"
          strokeDasharray="2 6"
        />
        <circle
          cx="200"
          cy="200"
          r="182"
          stroke={themeColors.primary}
          strokeWidth="1"
          strokeOpacity="0.15"
        />

        {/* Degree markers */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 200 200)`}>
            <line
              x1="200"
              y1="10"
              x2="200"
              y2="18"
              stroke={themeColors.primary}
              strokeWidth="1.5"
              strokeOpacity="0.6"
            />
            <circle cx="200" cy="22" r="1" fill={themeColors.primary} fillOpacity="0.8" />
          </g>
        ))}

        {/* Layer 1: Outer Rotating Ring with Segmented Cutouts */}
        <g className={isOffline ? '' : 'animate-spin-slow'} style={{ transformOrigin: 'center' }}>
          <circle
            cx="200"
            cy="200"
            r="165"
            stroke={themeColors.primary}
            strokeWidth="1.5"
            strokeOpacity="0.5"
            strokeDasharray="40 15 10 15 80 20"
          />
          <circle
            cx="200"
            cy="200"
            r="158"
            stroke={themeColors.secondary}
            strokeWidth="0.75"
            strokeOpacity="0.3"
          />
          {/* Segment brackets */}
          {[0, 120, 240].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 200 200)`}>
              <path
                d="M 195 38 A 162 162 0 0 1 205 38"
                stroke={themeColors.primary}
                strokeWidth="4"
                strokeLinecap="round"
              />
            </g>
          ))}
        </g>

        {/* Layer 2: Counter-Rotating Mechanical Ring */}
        <g className={isOffline ? '' : 'animate-spin-reverse-slow'} style={{ transformOrigin: 'center' }}>
          <circle
            cx="200"
            cy="200"
            r="140"
            stroke={themeColors.primary}
            strokeWidth="1.5"
            strokeOpacity="0.4"
            strokeDasharray="15 8 5 8"
          />
          {/* 12 Radial Stators / Transformer blocks */}
          {Array.from({ length: 12 }).map((_, i) => (
            <g key={i} transform={`rotate(${i * 30} 200 200)`}>
              <rect
                x="196"
                y="64"
                width="8"
                height="10"
                rx="1"
                fill={themeColors.primary}
                fillOpacity="0.25"
                stroke={themeColors.primary}
                strokeWidth="1"
                strokeOpacity="0.7"
              />
            </g>
          ))}
        </g>

        {/* Layer 3: Inner High-Precision Ring */}
        <g className={isOffline ? '' : isExecuting ? 'animate-spin-medium' : 'animate-spin-slow'} style={{ transformOrigin: 'center' }}>
          <circle
            cx="200"
            cy="200"
            r="115"
            stroke={themeColors.secondary}
            strokeWidth="2"
            strokeOpacity="0.6"
            strokeDasharray="30 8 10 8"
          />
          {/* Degree angle indicator marks */}
          {Array.from({ length: 24 }).map((_, i) => (
            <line
              key={i}
              x1="200"
              y1="90"
              x2="200"
              y2="96"
              stroke={themeColors.primary}
              strokeWidth="1"
              strokeOpacity="0.5"
              transform={`rotate(${i * 15} 200 200)`}
            />
          ))}
        </g>

        {/* Layer 4: Arc Reactor Core Assembly */}
        <circle
          cx="200"
          cy="200"
          r="84"
          fill="none"
          stroke={themeColors.primary}
          strokeWidth="2"
          strokeOpacity="0.5"
        />
        <circle
          cx="200"
          cy="200"
          r="78"
          fill="#030712"
          stroke={themeColors.secondary}
          strokeWidth="1.5"
        />

        {/* 10 Reactor Energy Coils */}
        {Array.from({ length: 10 }).map((_, i) => (
          <g key={i} transform={`rotate(${i * 36} 200 200)`}>
            <rect
              x="195"
              y="126"
              width="10"
              height="16"
              rx="2"
              fill={themeColors.primary}
              fillOpacity={isListening ? '0.7' : '0.4'}
              stroke={themeColors.primary}
              strokeWidth="1"
            />
            <line
              x1="197"
              y1="130"
              x2="203"
              y2="130"
              stroke="#ffffff"
              strokeWidth="0.8"
              strokeOpacity="0.7"
            />
            <line
              x1="197"
              y1="134"
              x2="203"
              y2="134"
              stroke="#ffffff"
              strokeWidth="0.8"
              strokeOpacity="0.7"
            />
          </g>
        ))}

        {/* Inner Heart Ring */}
        <circle
          cx="200"
          cy="200"
          r="54"
          fill="#020617"
          stroke={themeColors.primary}
          strokeWidth="2"
          strokeOpacity="0.8"
        />

        {/* Glowing Central Triangular Arc Core */}
        <g
          className={
            isOffline
              ? ''
              : isListening
              ? 'animate-pulse-amber-glow'
              : 'animate-pulse-glow'
          }
          style={{ transformOrigin: 'center' }}
        >
          {/* Core Triangle */}
          <polygon
            points="200,162 232,218 168,218"
            fill={themeColors.glow}
            stroke={themeColors.primary}
            strokeWidth="2"
          />
          <circle cx="200" cy="200" r="16" fill="#ffffff" fillOpacity="0.9" />
          <circle cx="200" cy="200" r="24" fill="none" stroke={themeColors.primary} strokeWidth="1.5" />
        </g>
      </svg>

      {/* Interactive Core Trigger Overlay */}
      <button
        type="button"
        onClick={onCoreClick}
        aria-label="Core trigger button"
        className="absolute inset-24 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300 hover:scale-105 active:scale-95 group focus:outline-none"
      >
        <span className="text-[10px] tracking-[0.25em] font-mono uppercase text-cyan-200/70 group-hover:text-cyan-100 transition-colors">
          {status === 'offline' ? 'OFFLINE' : status === 'listening' ? 'LISTENING' : status === 'executing' ? 'EXECUTING' : status === 'playing' ? 'PLAYING' : 'ONLINE'}
        </span>
        <span className="text-[12px] font-bold tracking-widest uppercase font-mono mt-0.5 text-cyan-400 group-hover:text-cyan-200 drop-shadow">
          JARVIS
        </span>
      </button>
    </div>
  );
};
