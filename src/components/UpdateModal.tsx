import { useState } from 'react';
import { App } from '@capacitor/app';
import { useAppUpdate } from '../hooks/useAppUpdate';

export default function UpdateModal() {
  const { updateRequired, updateInfo } = useAppUpdate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  if (!updateRequired) return null;

  const getTargetUrl = () => {
    let targetUrl = 'https://github.com/wahabchippa/react-vite-tailwind/releases/latest';
    if (updateInfo?.apk_url) {
      const githubRepoRegex = /^https?:\/\/(?:www\.)?github\.com\/([^\/]+\/[^\/]+)/i;
      const match = updateInfo.apk_url.match(githubRepoRegex);
      if (match && match[1]) {
        let repoPath = match[1].replace(/\.git$/, ''); 
        targetUrl = `https://github.com/${repoPath}/releases/latest?t=${Date.now()}`;
      }
    }
    return targetUrl;
  };

  const handleBrowserUpdate = () => {
    setIsProcessing(true);
    const targetUrl = getTargetUrl();
    try {
      window.open(targetUrl, '_system');
      setTimeout(() => setIsProcessing(false), 5000);
    } catch (err) {
      console.error('Failed to open external browser:', err);
      const a = document.createElement('a');
      a.href = targetUrl;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setIsProcessing(false);
    }
  };

  const handleCopyLink = async () => {
    const url = getTargetUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-sm mx-5 transform transition-all">
        <div className="text-center mb-6">
          
          {/* ✅ YAHAN LOGO LAGA DIYA HAI */}
          <div className="w-20 h-20 mx-auto mb-4">
            <img 
              src="/logo.png" 
              alt="Attendify Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          
          <h2 className="text-slate-900 font-extrabold text-2xl tracking-tight">Update Required</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Version <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{updateInfo?.version_name || '1.0.9'}</span> is available. You must update to continue using Attendify.
          </p>
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
        
        <div className="mt-5 text-center">
          <p className="text-slate-400 text-xs mb-2">
            Clicking will open your phone's browser.<br/>Tap <span className="font-semibold text-slate-600">app-debug.apk</span> to install.
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
