// src/components/UpdateModal.tsx

import { useAppUpdate } from '../hooks/useAppUpdate';

export default function UpdateModal() {
  // ✅ hook se nayi cheezein nikaalein: handleUpdate, downloading, progress
  const { updateRequired, updateInfo, handleUpdate, downloading, downloadProgress, error } = useAppUpdate();

  // Agar update zaroori nahi, toh component ko render hi na karein
  if (!updateRequired || !updateInfo) return null;

  const handleCopyLink = async () => {
    // Ab hum direct APK URL copy karenge
    if (updateInfo?.apk_url) {
      await navigator.clipboard.writeText(updateInfo.apk_url);
      // Optional: show a success message
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-sm mx-5 transform transition-all">
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto mb-4">
            <img src="/logo.png" alt="Attendify Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-slate-900 font-extrabold text-2xl tracking-tight">Update Available</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            A new version <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{updateInfo.version_name}</span> is ready. Please update to continue.
          </p>
        </div>

        {/* --- UPDATE BUTTON LOGIC --- */}
        <div className="w-full">
          {downloading ? (
            // Jab download ho raha ho
            <div className="w-full text-center">
              <p className="text-sm font-semibold text-slate-700">Downloading... {downloadProgress}%</p>
              <div className="w-full bg-slate-200 rounded-full h-2.5 mt-2">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${downloadProgress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            // Default state
            <button
              onClick={handleUpdate} // ✅ AB YEH IN-APP DOWNLOADER CALL KAREGA
              disabled={downloading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold rounded-xl text-[16px] transition-all duration-200 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
            >
              Update Now
            </button>
          )}
        </div>
        
        {/* Error message */}
        {error && <p className="text-red-500 text-xs text-center mt-3">{error}</p>}
        
        {/* Force update message */}
        {updateInfo.force_update && (
           <p className="text-xs text-center text-slate-500 mt-4">
             This is a mandatory update. You must install it to continue using the app.
           </p>
        )}

        {/* Optional: Copy link as fallback */}
        {!downloading && !updateInfo.force_update && (
            <div className="mt-4 text-center">
                <button 
                    onClick={handleCopyLink}
                    className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors"
                >
                    Copy Download Link
                </button>
            </div>
        )}
      </div>
    </div>
  );
}
