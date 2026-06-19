// src/components/UpdateModal.tsx

import { useState } from 'react';
import { useAppUpdate } from '../hooks/useAppUpdate';

export default function UpdateModal() {
  const {
    updateRequired,
    updateInfo,
    handleUpdate,
    downloading,
    downloadProgress,
    error,
  } = useAppUpdate();

  const [copied, setCopied] = useState(false);

  if (!updateRequired || !updateInfo) return null;

  const handleCopyLink = async () => {
    if (!updateInfo?.apk_url) return;
    try {
      await navigator.clipboard.writeText(updateInfo.apk_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = updateInfo.apk_url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md font-sans">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up">

        {/* ===== TOP GRADIENT BANNER ===== */}
        <div className="bg-gradient-to-br from-[#1E40AF] via-[#2563EB] to-[#1D4ED8] px-7 pt-8 pb-10 text-white text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-indigo-400/20 rounded-full blur-2xl" />

          {/* App icon */}
          <div className="relative z-10 w-20 h-20 mx-auto mb-4 bg-white/15 backdrop-blur-sm rounded-3xl flex items-center justify-center border border-white/20 shadow-xl">
            <img
              src="/icon.png?v=2"
              alt="Attendify"
              className="w-14 h-14 object-contain"
              onError={e => {
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent) parent.innerHTML = '<span class="text-white text-2xl font-black">Af</span>';
              }}
            />
          </div>

          <h2 className="text-2xl font-black tracking-tight relative z-10">
            Update Available
          </h2>
          <p className="text-blue-200 text-xs font-bold mt-1 relative z-10">
            Attendify needs to be updated
          </p>
        </div>

        {/* ===== CONTENT ===== */}
        <div className="px-7 py-6 space-y-5">

          {/* Version info */}
          <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4 text-[#1E40AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">New Version</p>
                <p className="text-sm font-black text-slate-800">{updateInfo.version_name}</p>
              </div>
            </div>
            {updateInfo.force_update && (
              <span className="px-2.5 py-1 bg-red-50 text-red-600 text-[10px] font-black rounded-xl border border-red-200 uppercase tracking-wide">
                Required
              </span>
            )}
          </div>

          {/* Description */}
          <p className="text-slate-500 text-sm font-medium text-center leading-relaxed">
            {updateInfo.force_update
              ? 'This is a mandatory update. You must install it to continue using Attendify.'
              : 'A new version is ready with improvements and bug fixes.'}
          </p>

          {/* ===== DOWNLOAD PROGRESS ===== */}
          {downloading ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 font-bold flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#1E40AF] animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  Downloading...
                </span>
                <span className="text-[#1E40AF] font-black text-sm">{downloadProgress}%</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#1E40AF] to-[#3B82F6] rounded-full transition-all duration-300 ease-out relative overflow-hidden"
                  style={{ width: `${downloadProgress}%` }}
                >
                  {/* Shimmer */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                </div>
              </div>

              <p className="text-center text-[10px] text-slate-400 font-bold">
                Please keep the app open while downloading...
              </p>
            </div>
          ) : (
            /* ===== UPDATE BUTTON ===== */
            <button
              onClick={handleUpdate}
              disabled={downloading}
              className="w-full py-4 bg-gradient-to-r from-[#1E40AF] to-[#2563EB] hover:from-[#1d4ed8] hover:to-[#3b82f6] active:scale-[0.98] text-white font-black rounded-2xl text-sm transition-all duration-200 shadow-xl shadow-blue-600/25 hover:shadow-blue-500/35 flex items-center justify-center gap-2.5"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Update Now
            </button>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-start gap-2.5">
              <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
              </svg>
              <p className="text-red-600 text-xs font-bold">{error}</p>
            </div>
          )}

          {/* Copy link fallback */}
          {!downloading && !updateInfo.force_update && updateInfo.apk_url && (
            <div className="text-center border-t border-slate-100 pt-4">
              <p className="text-[10px] text-slate-400 font-medium mb-2">Having trouble? Download manually:</p>
              <button
                onClick={handleCopyLink}
                className={`inline-flex items-center gap-1.5 text-xs font-bold transition-all px-3 py-1.5 rounded-xl border ${
                  copied
                    ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                    : 'text-[#1E40AF] bg-blue-50 border-blue-200 hover:bg-blue-100'
                }`}
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Link Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                    Copy Download Link
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
        .animate-scale-up { animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>
    </div>
  );
}