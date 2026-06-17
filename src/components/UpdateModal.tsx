import { useState } from 'react';
import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard'; // (Optional) For Copy to Clipboard
import { useAppUpdate } from '../hooks/useAppUpdate';

export default function UpdateModal() {
  const { updateRequired, updateInfo } = useAppUpdate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false); // Copy status state

  if (!updateRequired) return null;

  // URL Generation Logic (Bahar nikal liya taake Copy Link mein bhi use ho sake)
  const getTargetUrl = () => {
    let targetUrl = 'https://github.com/wahabchippa/react-vite-tailwind/releases/latest';
    
    if (updateInfo?.apk_url) {
      const githubRepoRegex = /^https?:\/\/(?:www\.)?github\.com\/([^\/]+\/[^\/]+)/i;
      const match = updateInfo.apk_url.match(githubRepoRegex);
      
      if (match && match[1]) {
        let repoPath = match[1].replace(/\.git$/, ''); 
        // CACHE BUSTING: ?t=${Date.now()} taake hamesha fresh page khule
        targetUrl = `https://github.com/${repoPath}/releases/latest?t=${Date.now()}`;
      }
    }
    return targetUrl;
  };

  const handleBrowserUpdate = async () => {
    setIsProcessing(true);
    const targetUrl = getTargetUrl();

    try {
      console.log('Opening clean system browser link:', targetUrl);
      await Browser.open({ url: targetUrl });
      
      setTimeout(() => setIsProcessing(false), 5000);
    } catch (err) {
      console.error('Browser failed, trying fallback:', err);
      try {
        window.open(targetUrl, '_system');
      } catch (e2) {
        window.location.href = targetUrl;
      }
      setIsProcessing(false);
    }
  };

  // Copy Link Function
  const handleCopyLink = async () => {
    const url = getTargetUrl();
    try {
      // Capacitor clipboard plugin use karna best hai
      await Clipboard.write({ string: url });
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      // Fallback agar plugin nahi hai
      navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-sm mx-5 transform transition-all">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <svg className="w-8 h-8 text-white animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h2 className="text-slate-900 font-extrabold text-2xl tracking-tight">Update Required</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Version <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{updateInfo?.version_name || '1.0.9'}</span> is available. You must update to continue using Attendify.
          </p>

          {/* Optional Release Notes (Agar supabase me available ho) */}
          {updateInfo?.release_notes && (
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-left">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">What's New</span>
              <p className="text-slate-600 text-sm mt-1">{updateInfo.release_notes}</p>
            </div>
          )}
        </div>

        <button
          onClick={handleBrowserUpdate}
          disabled={isProcessing}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500 text-white font-bold rounded-xl text-[16px] transition-all duration-200 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Opening Browser...
            </>
          ) : (
            'Update Now'
          )}
        </button>
        
        {/* Helper Texts & Copy Link */}
        <div className="mt-5 text-center">
          <p className="text-slate-400 text-xs mb-2">
            Clicking will open GitHub Releases.<br/>Tap <span className="font-semibold text-slate-600">app-debug.apk</span> to install.
          </p>
          <button 
            onClick={handleCopyLink}
            className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors"
          >
            {copySuccess ? '✓ Link Copied!' : 'Copy Update Link'}
          </button>
        </div>

      </div>
    </div>
  );
}
