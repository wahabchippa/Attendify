interface OfficeDistanceProps {
  distance: number | null;
  isInside: boolean;
  locationName?: string;
}

export default function OfficeDistance({ distance, isInside, locationName }: OfficeDistanceProps) {
  if (distance === null) return null;
  const distanceText = distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(2)}km`;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border ${
      isInside ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
    }`}>
      <span className="text-base">📍</span>
      <div className="flex-1">
        <p className={`text-xs font-black ${isInside ? 'text-emerald-700' : 'text-amber-700'}`}>
          {isInside ? `Inside ${locationName || 'Office'}` : `${distanceText} from office`}
        </p>
        <p className="text-[10px] text-slate-500 font-medium">
          {isInside ? '✓ You can check-in' : '⚠ Get closer to check-in'}
        </p>
      </div>
    </div>
  );
}