import { useState } from 'react';

interface LateWarningModalProps {
  isOpen: boolean;
  minutesLate: number;
  onSubmit: (reason: string) => void;
  onSkip: () => void;
}

const REASONS = [
  { icon: '🚗', label: 'Traffic Jam' },
  { icon: '👨‍👩‍👧', label: 'Family Emergency' },
  { icon: '🏥', label: 'Doctor' },
  { icon: '🚌', label: 'Transport Problem' },
  { icon: '⛈️', label: 'Bad Weather' },
  { icon: '✏️', label: 'Other' },
];

export default function LateWarningModal({ isOpen, minutesLate, onSubmit, onSkip }: LateWarningModalProps) {
  const [selected, setSelected] = useState<string>('');
  const [customReason, setCustomReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    const finalReason = selected === 'Other' ? customReason : selected;
    if (!finalReason.trim()) return;
    onSubmit(finalReason);
    setSelected('');
    setCustomReason('');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-white text-center">
          <div className="w-16 h-16 mx-auto bg-white/20 rounded-2xl flex items-center justify-center mb-3 text-3xl">⚠️</div>
          <h2 className="text-xl font-black">You Are Late!</h2>
          <p className="text-amber-100 text-sm font-bold mt-1">{minutesLate} minutes late today</p>
        </div>
        <div className="p-6">
          <p className="text-slate-600 text-sm font-semibold mb-4">Please select reason:</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {REASONS.map(r => (
              <button key={r.label} onClick={() => setSelected(r.label)}
                className={`p-3 rounded-2xl border text-xs font-bold transition-all ${
                  selected === r.label ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}>
                <div className="text-xl mb-1">{r.icon}</div>
                {r.label}
              </button>
            ))}
          </div>
          {selected === 'Other' && (
            <textarea value={customReason} onChange={e => setCustomReason(e.target.value)}
              placeholder="Type your reason..." rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm mb-4 focus:outline-none focus:border-amber-500" />
          )}
          <div className="flex gap-3">
            <button onClick={onSkip} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm">Skip</button>
            <button onClick={handleSubmit} disabled={!selected || (selected === 'Other' && !customReason.trim())}
              className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-black text-sm disabled:opacity-50">
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}