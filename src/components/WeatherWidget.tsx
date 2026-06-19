import { useState, useEffect } from 'react';

interface Weather {
  temp: number;
  description: string;
  icon: string;
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 600000);
    return () => clearInterval(interval);
  }, []);

  const fetchWeather = async () => {
    try {
      const res = await fetch('https://wttr.in/Karachi?format=j1');
      const data = await res.json();
      const current = data.current_condition[0];
      setWeather({
        temp: parseInt(current.temp_C),
        description: current.weatherDesc[0].value,
        icon: getIcon(current.weatherCode),
      });
    } catch {
      setWeather({ temp: 28, description: 'Clear', icon: '☀️' });
    }
  };

  const getIcon = (code: string): string => {
    const c = parseInt(code);
    if (c === 113) return '☀️';
    if (c >= 116 && c <= 122) return '⛅';
    if (c >= 176 && c <= 200) return '🌧️';
    if (c >= 248 && c <= 260) return '🌫️';
    return '☁️';
  };

  if (!weather) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10">
      <span className="text-xl">{weather.icon}</span>
      <div className="text-white">
        <p className="text-sm font-black leading-none">{weather.temp}°C</p>
        <p className="text-[9px] text-white/70 font-medium leading-none mt-0.5">Karachi</p>
      </div>
    </div>
  );
}