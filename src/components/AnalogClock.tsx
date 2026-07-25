// src/components/AnalogClock.tsx

import { useEffect, useState } from 'react';
import { getPKTDate } from '../store';

interface AnalogClockProps {
  size?: number;
}

interface Tick {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isHour: boolean;
  index: number;
}

interface ClockNumber {
  x: number;
  y: number;
  num: number;
}

export default function AnalogClock({ size = 200 }: AnalogClockProps) {
  const [time, setTime] = useState<Date>(getPKTDate());

  useEffect(() => {
    const timer = setInterval(() => setTime(getPKTDate()), 1000);
    return () => clearInterval(timer);
  }, []);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  // Smooth angles
  const hourAngle = (hours + minutes / 60) * 30 - 90;
  const minuteAngle = (minutes + seconds / 60) * 6 - 90;
  const secondAngle = seconds * 6 - 90;

  // Hand lengths
  const hourLen = r * 0.48;
  const minuteLen = r * 0.68;
  const secondLen = r * 0.82;
  const secondTail = r * 0.18;

  const toRad = (deg: number): number => (deg * Math.PI) / 180;

  // Hand endpoints
  const hourX = cx + hourLen * Math.cos(toRad(hourAngle));
  const hourY = cy + hourLen * Math.sin(toRad(hourAngle));
  const minuteX = cx + minuteLen * Math.cos(toRad(minuteAngle));
  const minuteY = cy + minuteLen * Math.sin(toRad(minuteAngle));
  const secondX = cx + secondLen * Math.cos(toRad(secondAngle));
  const secondY = cy + secondLen * Math.sin(toRad(secondAngle));
  const secondTailX = cx - secondTail * Math.cos(toRad(secondAngle));
  const secondTailY = cy - secondTail * Math.sin(toRad(secondAngle));

  // Generate ticks
  const ticks: Tick[] = [];
  for (let i = 0; i < 60; i++) {
    const angle = i * 6 - 90;
    const isHour = i % 5 === 0;
    const innerR = isHour ? r - 14 : r - 7;
    const outerR = r - 2;
    ticks.push({
      x1: cx + innerR * Math.cos(toRad(angle)),
      y1: cy + innerR * Math.sin(toRad(angle)),
      x2: cx + outerR * Math.cos(toRad(angle)),
      y2: cy + outerR * Math.sin(toRad(angle)),
      isHour,
      index: i,
    });
  }

  // Generate numbers
  const numbers: ClockNumber[] = [];
  for (let i = 1; i <= 12; i++) {
    const angle = i * 30 - 90;
    const numR = r - 28;
    numbers.push({
      x: cx + numR * Math.cos(toRad(angle)),
      y: cy + numR * Math.sin(toRad(angle)),
      num: i,
    });
  }

  // Active second tick highlight
  const activeTickIndex = Math.floor(seconds);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(circle, transparent 60%, rgba(30, 64, 175, 0.06) 100%)',
        }}
      />

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="relative z-10"
      >
        <defs>
          {/* Clock face gradient */}
          <radialGradient id="clockFaceGradient" cx="40%" cy="35%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </radialGradient>

          {/* Outer ring gradient */}
          <linearGradient id="outerRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E40AF" />
            <stop offset="50%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>

          {/* Second hand gradient */}
          <linearGradient id="secondHandGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1E40AF" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>

          {/* Hour hand gradient */}
          <linearGradient id="hourHandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          {/* Minute hand gradient */}
          <linearGradient id="minuteHandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>

          {/* Center dot shadow */}
          <radialGradient id="centerShadow">
            <stop offset="0%" stopColor="rgba(0,0,0,0.15)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          {/* Clock shadow filter */}
          <filter id="clockShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#1E40AF" floodOpacity="0.08" />
          </filter>

          {/* Hand shadow filter */}
          <filter id="handShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.15" />
          </filter>

          {/* Second hand glow */}
          <filter id="secondGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#2563EB" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* ===== OUTER DECORATIVE RING ===== */}
        <circle
          cx={cx}
          cy={cy}
          r={r + 10}
          fill="none"
          stroke="url(#outerRingGradient)"
          strokeWidth="2"
          opacity="0.15"
        />

        {/* Outer ring */}
        <circle
          cx={cx}
          cy={cy}
          r={r + 5}
          fill="none"
          stroke="url(#outerRingGradient)"
          strokeWidth="2.5"
          opacity="0.3"
          filter="url(#clockShadow)"
        />

        {/* ===== CLOCK FACE ===== */}
        <circle
          cx={cx}
          cy={cy}
          r={r + 1}
          fill="white"
          stroke="#e2e8f0"
          strokeWidth="1"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="url(#clockFaceGradient)"
        />

        {/* ===== MINUTE TRACK (subtle) ===== */}
        <circle
          cx={cx}
          cy={cy}
          r={r - 3}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="0.5"
        />

        {/* ===== TICK MARKS ===== */}
        {ticks.map((tick: Tick) => (
          <line
            key={tick.index}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            stroke={
              tick.index === activeTickIndex
                ? '#2563EB'
                : tick.isHour
                  ? '#1e293b'
                  : '#cbd5e1'
            }
            strokeWidth={
              tick.index === activeTickIndex
                ? 2.5
                : tick.isHour
                  ? 2.2
                  : 0.8
            }
            strokeLinecap="round"
            style={{
              transition: 'stroke 0.3s ease, stroke-width 0.3s ease',
            }}
          />
        ))}

        {/* ===== HOUR NUMBERS ===== */}
        {numbers.map((n: ClockNumber) => {
          const isActive = hours === n.num || (hours === 0 && n.num === 12);
          return (
            <text
              key={n.num}
              x={n.x}
              y={n.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={isActive ? '#1E40AF' : '#334155'}
              fontSize={size * 0.072}
              fontWeight={isActive ? '900' : '700'}
              fontFamily="system-ui, -apple-system, sans-serif"
              style={{
                transition: 'fill 0.5s ease, font-weight 0.5s ease',
              }}
            >
              {n.num}
            </text>
          );
        })}

        {/* ===== HOUR HAND ===== */}
        <line
          x1={cx}
          y1={cy}
          x2={hourX}
          y2={hourY}
          stroke="url(#hourHandGradient)"
          strokeWidth={4}
          strokeLinecap="round"
          filter="url(#handShadow)"
        />

        {/* ===== MINUTE HAND ===== */}
        <line
          x1={cx}
          y1={cy}
          x2={minuteX}
          y2={minuteY}
          stroke="url(#minuteHandGradient)"
          strokeWidth={2.8}
          strokeLinecap="round"
          filter="url(#handShadow)"
        />

        {/* ===== SECOND HAND ===== */}
        <line
          x1={secondTailX}
          y1={secondTailY}
          x2={secondX}
          y2={secondY}
          stroke="url(#secondHandGradient)"
          strokeWidth={1.3}
          strokeLinecap="round"
          filter="url(#secondGlow)"
        />

        {/* Second hand counterweight */}
        <circle
          cx={secondTailX}
          cy={secondTailY}
          r={3}
          fill="#1E40AF"
          opacity="0.6"
        />

        {/* ===== CENTER ASSEMBLY ===== */}
        {/* Shadow under center */}
        <circle cx={cx} cy={cy + 1} r={7} fill="url(#centerShadow)" />

        {/* Outer center ring */}
        <circle
          cx={cx}
          cy={cy}
          r={6}
          fill="#0f172a"
          stroke="#1e293b"
          strokeWidth="1"
        />

        {/* Inner center dot */}
        <circle
          cx={cx}
          cy={cy}
          r={3.5}
          fill="url(#outerRingGradient)"
        />

        {/* Center highlight */}
        <circle
          cx={cx - 1}
          cy={cy - 1}
          r={1.5}
          fill="white"
          opacity="0.5"
        />

        {/* ===== 12 O'CLOCK MARKER ===== */}
        <circle
          cx={cx}
          cy={cy - r + 1}
          r={1.5}
          fill="#1E40AF"
          opacity="0.5"
        />
      </svg>
    </div>
  );
}