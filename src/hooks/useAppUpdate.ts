import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../store'; // ensure this exports a configured Supabase client

interface UpdateInfo {
  version_code: number;
  version_name: string;
  apk_url: string;
  force_update: boolean;
}

// Debug ke liye web par test karna ho to true kar do (default false rakho)
const ALLOW_WEB_TEST = false;

export function useAppUpdate() {
  const [updateRequired, setUpdateRequired] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const canRun = Capacitor.isNativePlatform() || ALLOW_WEB_TEST;
    if (!canRun) {
      console.log('[Update] Skipping check (not native platform)');
      return;
    }
    checkForUpdate();
  }, []);

  // Local app build code nikaalne ka reliable tareeqa
  const getLocalBuildCode = async (): Promise<number> => {
    try {
      const info = await App.getInfo();
      console.log('[Update] AppInfo:', info);

      // Capacitor (>= v3/v5) on Android → info.build (number)
      if (typeof info.build === 'number' && !Number.isNaN(info.build)) {
        return info.build;
      }

      // Kuch setups me versionCode milta hai
      const vc: unknown = (info as any).versionCode;
      if (typeof vc === 'number' && !Number.isNaN(vc)) return vc;
      if (typeof vc === 'string' && vc.trim()) {
        const n = Number(vc);
        if (!Number.isNaN(n)) return n;
      }

      // Fallback: "1.0.20" ko numeric code me convert karo
      if (info.version) {
        const parts = info.version.split('.').map(p => parseInt(p, 10) || 0);
        // major.minor.patch → major*10000 + minor*100 + patch
        const code = (parts[0] || 0) * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);
        return code;
      }
    } catch (e) {
      console.warn('[Update] getLocalBuildCode error:', e);
    }
    // Last resort
    return 1;
  };

  const checkForUpdate = async () => {
    try {
      console.log('===== UPDATE CHECK STARTED =====');

      const currentVersionCode = await getLocalBuildCode();
      console.log('[Update] Local build code:', currentVersionCode);

      const { data, error } = await supabase
        .from('app_version')
        .select('version_code, version_name, apk_url, force_update')
        .eq('id', 1)
        .single();

      if (error) {
        console.error('[Update] Supabase error:', error);
        return;
      }
      if (!data) {
        console.error('[Update] No data in app_version (id=1)');
        return;
      }

      const serverCode = Number(data.version_code || 0);
      const mustForce = Boolean(data.force_update);

      console.log('[Update] Server code:', serverCode, 'Force:', mustForce);

      const shouldUpdate = mustForce || serverCode > currentVersionCode;

      if (shouldUpdate) {
        console.log('[Update] UPDATE REQUIRED ✅');
        setUpdateInfo({
          version_code: serverCode,
          version_name: data.version_name,
          apk_url: data.apk_url,
          force_update: mustForce,
        });
        setUpdateRequired(true);
      } else {
        console.log('[Update] NO UPDATE REQUIRED ❌');
        setUpdateRequired(false);
        setUpdateInfo(null);
      }
    } catch (err) {
      console.error('[Update] Update check failed:', err);
    }
  };

  // Optional in-app downloader (aap browser open kar rahe ho to iski zarurat nahi; backup ke liye rehne do)
  const handleUpdate = async () => {
    if (!updateInfo) return;
    setDownloading(true);
    setError('');

    try {
      const fileName = `update_${updateInfo.version_code}.apk`;
      const response = await fetch(updateInfo.apk_url);
      if (!response.ok) throw new Error('Download failed');

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength) : 0;
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Stream error');

      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (total > 0) setDownloadProgress(Math.round((received / total) * 100));
        }
      }

      const allChunks = new Uint8Array(received);
      let offset = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, offset);
        offset += chunk.length;
      }

      const base64 = btoa(
        allChunks.reduce((d, b) => d + String.fromCharCode(b), '')
      );

      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });

      await FileOpener.open({
        filePath: writeResult.uri,
        contentType: 'application/vnd.android.package-archive',
        openWithDefault: true,
      });
    } catch (e: any) {
      console.error('[Update] Download error:', e);
      setError('Download failed. Please check your connection and try again.');
    } finally {
      setDownloading(false);
    }
  };

  return { updateRequired, updateInfo, downloading, downloadProgress, error, handleUpdate };
}
