import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

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

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) {
      setSelected('');
      setCustomReason('');
    }
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleSubmit = () => {
    const finalReason = selected === 'Other' ? customReason : selected;
    if (!finalReason.trim()) return;
    onSubmit(finalReason);
  };

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/60 p-4 backdrop-blur-md">
      <div className="my-auto w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-center text-white">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-3xl">⚠️</div>
          <h2 className="text-xl font-black">You Are Late!</h2>
          <p className="mt-1 text-sm font-bold text-amber-100">{minutesLate} minutes late today</p>
        </div>
        <div className="p-6">
          <p className="mb-4 text-sm font-semibold text-slate-600">Please select reason:</p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            {REASONS.map(r => (
              <button
                key={r.label}
                onClick={() => setSelected(r.label)}
                className={`rounded-2xl border p-3 text-xs font-bold transition-all ${
                  selected === r.label
                    ? 'border-amber-300 bg-amber-50 text-amber-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="mb-1 text-xl">{r.icon}</div>
                {r.label}
              </button>
            ))}
          </div>
          {selected === 'Other' && (
            <textarea
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              placeholder="Type your reason..."
              rows={2}
              className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            />
          )}
          <div className="flex gap-3">
            <button onClick={onSkip} className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-600">
              Skip
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selected || (selected === 'Other' && !customReason.trim())}
              className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}