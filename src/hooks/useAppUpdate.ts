import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../store';

interface UpdateInfo {
  version_code: number;
  version_name: string;
  apk_url: string;
  force_update: boolean;
}

const ALLOW_WEB_TEST = false;

export function useAppUpdate() {
  const [updateRequired, setUpdateRequired] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState('');

  // <-- 1. DEBUG STATE ADD HUA -->
  const [debugInfo, setDebugInfo] = useState({ local: 0, server: 0 });

  useEffect(() => {
    const check = async () => {
      const isNative = Capacitor.isNativePlatform();
      if (!isNative && !ALLOW_WEB_TEST) {
        console.log('[Update] Skipping check: Not a native platform.');
        return;
      }
      
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          console.log('[Update] App resumed, re-checking for update status...');
          checkForUpdate();
        }
      });

      await checkForUpdate();
    };

    check();

    return () => {
      App.removeAllListeners();
    };
  }, []);

  const getLocalBuildCode = async (): Promise<number> => {
    if (!Capacitor.isNativePlatform()) {
      console.log('[Update] Running on web, returning dummy version code 1');
      return 1;
    }
    try {
      const info = await App.getInfo();
      console.log('[Update] AppInfo from device:', info);

      const buildNumber = parseInt(info.build, 10);
      if (!isNaN(buildNumber) && buildNumber > 0) {
        console.log(`[Update] Got build number: ${buildNumber}`);
        return buildNumber;
      }
    } catch (e) {
      console.error('[Update] Could not get AppInfo:', e);
    }
    console.warn('[Update] Could not determine build number. Falling back to 1.');
    return 1;
  };

  const checkForUpdate = async () => {
    try {
      console.log('===== UPDATE CHECK STARTED =====');
      const currentVersionCode = await getLocalBuildCode();
      
      if (currentVersionCode === 1 && Capacitor.isNativePlatform()) {
        console.warn('[Update] Local version code is fallback value (1). Skipping check.');
        setDebugInfo({ local: currentVersionCode, server: 0 }); // Update debug info
        return;
      }

      console.log(`[Update] Local version code: ${currentVersionCode}`);

      const { data, error: dbError } = await supabase
        .from('app_version')
        .select('version_code, version_name, apk_url, force_update')
        .eq('id', 1)
        .single();

      if (dbError) throw new Error(dbError.message);
      if (!data) throw new Error('No update data found in Supabase.');

      const serverCode = Number(data.version_code);
      console.log(`[Update] Server version code: ${serverCode}`);
      
      // <-- 2. DEBUG INFO STATE MEIN SAVE HUA -->
      setDebugInfo({ local: currentVersionCode, server: serverCode });

      if (serverCode > currentVersionCode) {
        console.log('[Update] UPDATE REQUIRED ✅');
        setUpdateInfo({
          version_code: serverCode,
          version_name: data.version_name,
          apk_url: data.apk_url,
          force_update: data.force_update,
        });
        setUpdateRequired(true);
      } else {
        console.log('[Update] NO UPDATE REQUIRED ❌');
        setUpdateRequired(false);
        setUpdateInfo(null);
      }
    } catch (err) {
      console.error('[Update] Check failed:', err);
      setError('Could not check for updates.');
      setUpdateRequired(false);
    }
  };

  const handleUpdate = async () => {
    if (!updateInfo || !updateInfo.apk_url) {
      setError('Update information is missing. Cannot download.');
      return;
    }
    
    const directApkUrl = updateInfo.apk_url;
    console.log(`[Update] Starting download from: ${directApkUrl}`);

    setDownloading(true);
    setError('');
    setDownloadProgress(0);

    try {
      const fileName = `attendify_v${updateInfo.version_name}.apk`;

      const response = await fetch(directApkUrl);
      if (!response.ok || !response.body) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const contentLength = +response.headers.get('Content-Length')!;
      let receivedLength = 0;
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedLength += value.length;
        if (contentLength) {
          setDownloadProgress(Math.round((receivedLength / contentLength) * 100));
        }
      }

      const blob = new Blob(chunks);
      
      const base64Data = await new Promise<string>((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onerror = reject;
        fileReader.onload = () => {
          const result = fileReader.result as string;
          resolve(result.substr(result.indexOf(',') + 1));
        };
        fileReader.readAsDataURL(blob);
      });

      console.log('[Update] Download complete. Writing file to cache...');

      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      console.log(`[Update] File written to: ${result.uri}. Opening installer...`);

      await FileOpener.open({
        filePath: result.uri,
        contentType: 'application/vnd.android.package-archive',
      });
      
      setDownloading(false);

    } catch (e: any) {
      console.error('[Update] Download/Install error:', e);
      setError('Update failed. Please try again or check your connection.');
      setDownloading(false);
    }
  };

  return { 
    updateRequired, 
    updateInfo, 
    downloading, 
    downloadProgress, 
    error, 
    handleUpdate, 
    checkForUpdate,
    debugInfo // <-- 3. DEBUG INFO RETURN HUA -->
  };
}
