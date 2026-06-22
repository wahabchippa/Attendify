import { createPortal } from 'react-dom';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

interface EarlyCheckoutModalProps {
  isOpen: boolean;
  hoursWorked: number;
  minHours: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function EarlyCheckoutModal({ isOpen, hoursWorked, minHours, onConfirm, onCancel }: EarlyCheckoutModalProps) {
  useBodyScrollLock(isOpen);

  if (!isOpen || typeof document === 'undefined') return null;

  const remaining = Math.max(0, minHours - hoursWorked);

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/60 p-4 backdrop-blur-md">
      <div className="my-auto w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border border-amber-200 bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-center text-white">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-3xl">⏰</div>
          <h2 className="text-xl font-black">Early Checkout Warning</h2>
          <p className="mt-1 text-sm font-bold text-amber-100">You have not completed full-day hours</p>
        </div>
        <div className="p-6">
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-slate-600">Worked</span>
              <span className="font-black text-slate-800">{hoursWorked.toFixed(2)}h</span>
            </div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium text-slate-600">Required</span>
              <span className="font-black text-slate-800">{minHours.toFixed(2)}h</span>
            </div>
            <div className="flex justify-between border-t border-amber-200 pt-2 text-sm">
              <span className="font-medium text-slate-600">Remaining</span>
              <span className="font-black text-amber-700">{remaining.toFixed(2)}h</span>
            </div>
          </div>
          <p className="mb-5 text-sm font-medium text-slate-600">Are you sure you want to check out early?</p>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button onClick={onConfirm} className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-black text-white">
              Confirm Checkout
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}