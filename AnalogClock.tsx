import { useEffect, useState } from 'react';

interface AnalogClockProps {
  size?: number;
}

export default function AnalogClock({ size = 180 }: AnalogClockProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  // Angles
  const hourAngle = (hours + minutes / 60) * 30 - 90;
  const minuteAngle = (minutes + seconds / 60) * 6 - 90;
  const secondAngle = seconds * 6 - 90;

  // Hand endpoints
  const hourLen = r * 0.5;
  const minuteLen = r * 0.7;
  const secondLen = r * 0.82;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const hourX = cx + hourLen * Math.cos(toRad(hourAngle));
  const hourY = cy + hourLen * Math.sin(toRad(hourAngle));
  const minuteX = cx + minuteLen * Math.cos(toRad(minuteAngle));
  const minuteY = cy + minuteLen * Math.sin(toRad(minuteAngle));
  const secondX = cx + secondLen * Math.cos(toRad(secondAngle));
  const secondY = cy + secondLen * Math.sin(toRad(secondAngle));

  // Tick marks
  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const angle = i * 6 - 90;
    const isHour = i % 5 === 0;
    const innerR = isHour ? r - 12 : r - 6;
    const outerR = r - 2;
    ticks.push({
      x1: cx + innerR * Math.cos(toRad(angle)),
      y1: cy + innerR * Math.sin(toRad(angle)),
      x2: cx + outerR * Math.cos(toRad(angle)),
      y2: cy + outerR * Math.sin(toRad(angle)),
      isHour,
    });
  }

  // Hour numbers
  const numbers = [];
  for (let i = 1; i <= 12; i++) {
    const angle = i * 30 - 90;
    const numR = r - 24;
    numbers.push({
      x: cx + numR * Math.cos(toRad(angle)),
      y: cy + numR * Math.sin(toRad(angle)),
      num: i,
    });
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#e2e8f0" strokeWidth="1" />
      
      {/* Clock face */}
      <circle cx={cx} cy={cy} r={r} fill="white" stroke="#cbd5e1" strokeWidth="1.5" />
      
      {/* Inner subtle gradient circle */}
      <circle cx={cx} cy={cy} r={r - 1} fill="url(#clockGradient)" />
      <defs>
        <radialGradient id="clockGradient">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f8fafc" />
        </radialGradient>
      </defs>

      {/* Tick marks */}
      {ticks.map((tick, i) => (
        <line
          key={i}
          x1={tick.x1}
          y1={tick.y1}
          x2={tick.x2}
          y2={tick.y2}
          stroke={tick.isHour ? '#334155' : '#cbd5e1'}
          strokeWidth={tick.isHour ? 2 : 0.8}
          strokeLinecap="round"
        />
      ))}

      {/* Hour numbers */}
      {numbers.map(n => (
        <text
          key={n.num}
          x={n.x}
          y={n.y}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#334155"
          fontSize={size * 0.075}
          fontWeight="600"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {n.num}
        </text>
      ))}

      {/* Hour hand */}
      <line
        x1={cx}
        y1={cy}
        x2={hourX}
        y2={hourY}
        stroke="#1e293b"
        strokeWidth={3.5}
        strokeLinecap="round"
      />

      {/* Minute hand */}
      <line
        x1={cx}
        y1={cy}
        x2={minuteX}
        y2={minuteY}
        stroke="#334155"
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      {/* Second hand */}
      <line
        x1={cx - 12 * Math.cos(toRad(secondAngle))}
        y1={cy - 12 * Math.sin(toRad(secondAngle))}
        x2={secondX}
        y2={secondY}
        stroke="#2563eb"
        strokeWidth={1.2}
        strokeLinecap="round"
      />

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={4} fill="#1e293b" />
      <circle cx={cx} cy={cy} r={2} fill="#2563eb" />
    </svg>
  );
}
