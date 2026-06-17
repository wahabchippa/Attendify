import { useState } from 'react';
import { Browser } from '@capacitor/browser';
import { useAppUpdate } from '../hooks/useAppUpdate';

export default function UpdateModal() {
  const { updateRequired, updateInfo } = useAppUpdate();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!updateRequired) return null;

  const handleBrowserUpdate = async () => {
    setIsProcessing(true);
    
    // We need this URL generation to be 100% dynamic and error-free.
    // Default fallback in case things are completely missing
    let targetUrl = 'https://github.com/wahabchippa/react-vite-tailwind/releases/latest';
    
    if (updateInfo?.apk_url) {
      // Bulletproof regex to extract the GitHub repository base URL:
      // It handles http/https, optional www., github.com, and extracts USERNAME/REPO_NAME
      const githubRepoRegex = /^https?:\/\/(?:www\.)?github\.com\/([^\/]+\/[^\/]+)/i;
      const match = updateInfo.apk_url.match(githubRepoRegex);
      
      if (match && match[1]) {
        // match[1] is "USERNAME/REPO_NAME" (e.g. "wahabchippa/react-vite-tailwind")
        // Note: [^/] matches until the next slash. However, there might be a trailing slash or .git.
        // But our regex `[^\/]+\/[^\/]+` matches exactly two path segments.
        // Let's refine it slightly to ensure it doesn't capture extra paths:
        
        let repoPath = match[1];
        // Clean up any extra paths that might have sneaked in if the second segment didn't stop at slash
        // Wait, `[^\/]+` means it stops at the slash. 
        // Example: github.com/user/repo/releases... -> match[1] will be "user/repo"
        repoPath = repoPath.replace(/\.git$/, ''); // cleanup in case of .git suffix
        
        targetUrl = `https://github.com/${repoPath}/releases/latest`;
      }
    }

    try {
      console.log('Opening clean system browser link:', targetUrl);
      
      // Attempt to use Capacitor's Browser plugin to open the link natively
      await Browser.open({ url: targetUrl });
      
      setTimeout(() => {
        setIsProcessing(false);
      }, 5000);

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

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-blue-600/20">
            <svg 
              className="w-8 h-8 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <h2 className="text-slate-800 font-bold text-xl">Update Required</h2>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            Version <span className="font-bold text-slate-700">{updateInfo?.version_name || '1.0.9'}</span> is available. You must update to continue using Attendify.
          </p>
        </div>

        <button
          onClick={handleBrowserUpdate}
          disabled={isProcessing}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-semibold rounded-xl text-[15px] transition-colors shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
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
        
        <p className="text-center text-slate-400 text-xs mt-4">
          Clicking will open GitHub Releases.<br/>Tap <span className="font-semibold text-slate-500">app-debug.apk</span> to install.
        </p>
      </div>
    </div>
  );
}
