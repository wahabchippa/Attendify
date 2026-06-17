import { Browser } from '@capacitor/browser';
import { useAppUpdate } from '../hooks/useAppUpdate';

export default function UpdateModal() {
  // Hum sirf updateRequired aur updateInfo use karenge
  const { updateRequired, updateInfo } = useAppUpdate();

  // Agar update ki zaroorat nahi hai, toh kuch bhi screen par nahi dikhao
  if (!updateRequired) return null;

  // Naya Function: Browser open karne ke liye
  const handleBrowserUpdate = async () => {
    if (updateInfo?.apk_url) {
      try {
        // Mobile ka default browser (Chrome) open karega
        await Browser.open({ url: updateInfo.apk_url });
      } catch (err) {
        // Fallback agar browser na open ho
        window.open(updateInfo.apk_url, '_blank');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-2xl font-bold">↑</span>
          </div>
          <h2 className="text-slate-800 font-bold text-lg">Update Required</h2>
          <p className="text-slate-500 text-sm mt-1">
            Version {updateInfo?.version_name} is available. You must update to continue using the app.
          </p>
        </div>

        {/* Downloading progress bar hata diya hai kyunke browser khud download karega */}
        <button
          onClick={handleBrowserUpdate}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-blue-600/20"
        >
          Update Now
        </button>
        
        <p className="text-center text-slate-400 text-xs mt-3">
          Clicking will open your browser to download the update.
        </p>
      </div>
    </div>
  );
}
