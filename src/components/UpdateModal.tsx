import { useState } from 'react';
import { Browser } from '@capacitor/browser';
import { useAppUpdate } from '../hooks/useAppUpdate';

export default function UpdateModal() {
  const { updateRequired, updateInfo } = useAppUpdate();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!updateRequired) return null;

  const handleBrowserUpdate = async () => {
    setIsProcessing(true);
    
    // 🚀 STUCK FREE SOLUTION: Direct web page par bhejein taake Chrome freeze na ho
    // Yeh link user ko seedha aapki repo ke latest release page par le jayega
    const targetUrl = 'https://github.com/wahabchippa/react-vite-tailwind/releases/latest';

    try {
      console.log('Opening system browser for Release Page:', targetUrl);
      
      // Mobile ka actual Google Chrome trigger hoga
      await Browser.open({ url: targetUrl });
      
      // 5 second baad button ko normal karein
      setTimeout(() => {
        setIsProcessing(false);
      }, 5000);

    } catch (err) {
      console.error('Browser open failed, trying fallback:', err);
      try {
        window.open(targetUrl, '_system');
      } catch (e2) {
        window.location.href = targetUrl;
      }
      setIsProcessing(false);
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
            Version {updateInfo?.version_name || '1.0.8'} is available. You must update to continue using the app.
          </p>
        </div>

        <button
          onClick={handleBrowserUpdate}
          disabled={isProcessing}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-blue-600/20"
        >
          {isProcessing ? 'Opening Browser...' : 'Update Now'}
        </button>
        
        <p className="text-center text-slate-400 text-xs mt-3">
          Clicking will open GitHub Releases. Tap 'app-debug.apk' to install.
        </p>
      </div>
    </div>
  );
}
