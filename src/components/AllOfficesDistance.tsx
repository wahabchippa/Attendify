// All 3 offices distance — Admin & Manager only
import { useEffect, useState } from 'react';

interface OfficeInfo {
  name: string;
  lat: number;
  lng: number;
  radius: number;
}

const OFFICES: OfficeInfo[] = [
  { name: 'QC Center', lat: 24.856917, lng: 67.111833, radius: 800 },
  { name: 'PK Zone',   lat: 24.825222, lng: 67.247472, radius: 500 },
  { name: 'Z House',   lat: 24.882889, lng: 67.073278, radius: 700 },
];

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface OfficeDistanceResult {
  name: string;
  distance: number;
  isInside: boolean;
  radius: number;
}

export default function AllOfficesDistance() {
  const [results, setResults] = useState<OfficeDistanceResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 3;
    let bestAccuracy = Infinity;
    let bestPosition: GeolocationPosition | null = null;

    const tryGetLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          attempts++;
          if (pos.coords.accuracy < bestAccuracy) {
            bestAccuracy = pos.coords.accuracy;
            bestPosition = pos;
          }
          if (attempts < maxAttempts && pos.coords.accuracy > 50) {
            tryGetLocation();
          } else {
            if (bestPosition) {
              const { latitude, longitude } = bestPosition.coords;
              const calculated = OFFICES.map(office => {
                const distance = haversineDistance(latitude, longitude, office.lat, office.lng);
                return {
                  name: office.name,
                  distance,
                  isInside: distance <= office.radius,
                  radius: office.radius,
                };
              });
              setResults(calculated);
            }
            setLoading(false);
          }
        },
        () => {
          setError(true);
          setLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    };

    if (navigator.geolocation) {
      tryGetLocation();
    } else {
      setError(true);
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200">
        <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin shrink-0" />
        <span className="text-xs font-bold text-slate-500">Detecting office distances...</span>
      </div>
    );
  }

  if (error || results.length === 0) {
    return (
      <div className="mt-3 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200">
        <span className="text-sm">📍</span>
        <span className="text-xs font-bold text-amber-700">GPS unavailable — enable location</span>
      </div>
    );
  }

  const formatDist = (d: number) =>
    d < 1000 ? `${Math.round(d)}m` : `${(d / 1000).toFixed(2)}km`;

  return (
    <div className="mt-3 w-full space-y-2">
      {results.map(office => (
        <div
          key={office.name}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all ${
            office.isInside
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-slate-50 border-slate-200'
          }`}
        >
          {/* Office icon */}
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm ${
            office.isInside
              ? 'bg-emerald-500 text-white'
              : 'bg-slate-200 text-slate-500'
          }`}>
            🏢
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-black ${
              office.isInside ? 'text-emerald-700' : 'text-slate-700'
            }`}>
              {office.name}
            </p>
            <p className={`text-[10px] font-medium ${
              office.isInside ? 'text-emerald-600' : 'text-slate-400'
            }`}>
              {office.isInside ? '✓ You are inside' : `${formatDist(office.distance)} away`}
            </p>
          </div>

          {/* Checkmark or distance badge */}
          <div className={`shrink-0 px-2.5 py-1 rounded-xl text-[10px] font-black border ${
            office.isInside
              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            {office.isInside ? '✓ IN' : formatDist(office.distance)}
          </div>
        </div>
      ))}
    </div>
  );
}