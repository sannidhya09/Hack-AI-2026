import { useEffect, useState } from "react";

export default function WaveformBar({ active, color = "red", bars = 12, height = 20 }) {
  const [heights, setHeights] = useState(Array(bars).fill(0.3));

  useEffect(() => {
    if (!active) {
      setHeights(Array(bars).fill(0.3));
      return;
    }

    const interval = setInterval(() => {
      setHeights(prev =>
        prev.map((_, i) => {
          const center = bars / 2;
          const distFromCenter = Math.abs(i - center) / center;
          const base = 0.3 + (1 - distFromCenter) * 0.4;
          return base + (Math.random() * 0.5);
        })
      );
    }, 80);

    return () => clearInterval(interval);
  }, [active, bars]);

  const colorMap = {
    red: '#E53935',
    white: '#FFFFFF',
    gray: '#9CA3AF',
  };

  const barColor = colorMap[color] || color;

  return (
    <div
      className="flex items-center gap-px"
      style={{ height: `${height}px` }}
    >
      {heights.map((h, i) => (
        <div
          key={i}
          className="rounded-full transition-all"
          style={{
            width: '2px',
            height: `${Math.max(2, h * height)}px`,
            backgroundColor: barColor,
            opacity: active ? 0.8 + h * 0.2 : 0.3,
            transitionDuration: '80ms',
          }}
        />
      ))}
    </div>
  );
}
