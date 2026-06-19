interface EarlyCheckoutModalProps {
  isOpen: boolean;
  hoursWorked: number;
  minHours: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function EarlyCheckoutModal({ isOpen, hoursWorked, minHours, onConfirm, onCancel }: EarlyCheckoutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-gradient-to-r from-red-500 to-rose-500 px-6 py-5 text-white text-center">
          <div className="w-16 h-16 mx-auto bg-white/20 rounded-2xl flex items-center justify-center mb-3 text-3xl">⚠️</div>
          <h2 className="text-xl font-black">Early Checkout?</h2>
        </div>
        <div className="p-6 text-center">
          <p className="text-slate-700 text-sm font-semibold mb-2">
            You worked only <span className="text-red-600 font-black">{hoursWorked.toFixed(1)}h</span>
          </p>
          <p className="text-slate-500 text-xs mb-4">Required: <strong>{minHours}h</strong> for full day</p>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-5">
            <p className="text-amber-700 text-xs font-bold">⚠️ This will mark as Half Day</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm">Continue</button>
            <button onClick={onConfirm} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-black text-sm">Yes, Checkout</button>
          </div>
        </div>
      </div>
    </div>
  );
}