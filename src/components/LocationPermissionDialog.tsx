<<<<<<< HEAD
=======
mkdir -p src/components
cat > src/components/LocationPermissionDialog.tsx << 'EOF'
>>>>>>> 08d23672578f3fd77bf85c76c6e5666084c44ba7
interface LocationPermissionDialogProps {
  onOpenSettings: () => void;
  onRetry: () => void;
  onClose: () => void;
}

export default function LocationPermissionDialog({
  onOpenSettings,
  onRetry,
  onClose,
}: LocationPermissionDialogProps) {
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-fade-in">
        <div className="flex items-center justify-center w-14 h-14 mx-auto bg-amber-100 rounded-full mb-4">
          <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-800 text-center mb-2">
          Location Permission Required
        </h3>
        <p className="text-slate-500 text-sm text-center mb-6 leading-relaxed">
          Attendify needs location access to verify your presence in office.
          Please enable location permission in settings.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onOpenSettings}
            className="w-full py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm transition-all active:scale-[0.98] shadow-sm hover:shadow-md"
          >
            Open Settings
          </button>
          <button
            onClick={onRetry}
            className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition-all active:scale-[0.98]"
          >
            Retry
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-all"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
<<<<<<< HEAD
=======
EOF
>>>>>>> 08d23672578f3fd77bf85c76c6e5666084c44ba7
