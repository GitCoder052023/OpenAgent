import React, { useEffect, useState } from 'react';

interface SoundWaveProps {
  active: boolean;
  color?: string;
  barCount?: number;
}

export const SoundWave: React.FC<SoundWaveProps> = ({
  active,
  color = '#00f0ff',
  barCount = 28,
}) => {
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: barCount }, () => 10));

  useEffect(() => {
    if (!active) {
      setBars(Array.from({ length: barCount }, () => 6));
      return;
    }

    const interval = setInterval(() => {
      setBars(
        Array.from({ length: barCount }, (_, i) => {
          const center = barCount / 2;
          const dist = Math.abs(i - center) / center;
          const factor = Math.max(0.2, 1 - dist * 0.7);
          return Math.floor(Math.random() * 65 * factor) + 12;
        })
      );
    }, 80);

    return () => clearInterval(interval);
  }, [active, barCount]);

  return (
    <div className="flex items-center justify-center gap-1 h-12 px-4 py-2 bg-slate-950/40 rounded-lg border border-cyan-500/10">
      {bars.map((height, i) => (
        <div
          key={i}
          className="w-1 rounded-full transition-all duration-75 ease-out"
          style={{
            height: `${height}%`,
            backgroundColor: color,
            opacity: active ? 0.85 : 0.25,
            boxShadow: active ? `0 0 8px ${color}` : 'none',
          }}
        />
      ))}
    </div>
  );
};
