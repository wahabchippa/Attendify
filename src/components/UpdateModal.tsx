import { useAppUpdate } from '../hooks/useAppUpdate';

export default function UpdateModal() {
  const { updateRequired, updateInfo, downloading, downloadProgress, error, handleUpdate } = useAppUpdate();

  // Agar update ki zaroorat nahi hai, toh kuch bhi screen par nahi dikhao
  if (!updateRequired) return null;

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

        {error && (          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        {downloading ? (          <div className="space-y-2">
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p className="text-center text-slate-500 text-sm font-medium">
              Downloading... {downloadProgress}%
            </p>
          </div>
        ) : (          <button
            onClick={handleUpdate}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-blue-600/20"
          >
            Update Now
          </button>
        )}
      </div>
    </div>
  );
}
