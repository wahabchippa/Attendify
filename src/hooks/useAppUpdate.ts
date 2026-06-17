// src/hooks/useAppUpdate.ts

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

// Web par test ke liye isko true kar sakte hain
const ALLOW_WEB_TEST = false;

export function useAppUpdate() {
  const [updateRequired, setUpdateRequired] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState('');

  // IMPORTANT: Sirf ek baar app start hone par check karein
  useEffect(() => {
    const check = async () => {
      // Platform check
      const isNative = Capacitor.isNativePlatform();
      if (!isNative && !ALLOW_WEB_TEST) {
        console.log('[Update] Skipping check: Not a native platform.');
        return;
      }

      // App ke resume hone par baar baar check na ho, isliye event listener lagayein
      // Taa ke user app update kar ke wapas aaye toh modal chala jaye
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          console.log('[Update] App resumed, re-checking for update status...');
          checkForUpdate();
        }
      });

      // Initial check
      await checkForUpdate();
    };

    check();

    // Cleanup listener on component unmount
    return () => {
      App.removeAllListeners();
    };
  }, []);

  // ✅ **IMPROVED: Local app build code nikaalne ka reliable tareeqa**
  const getLocalBuildCode = async (): Promise<number> => {
    if (!Capacitor.isNativePlatform()) {
        // Web ke liye dummy version code
        console.log('[Update] Running on web, returning dummy version code 1');
        return 1;
    }
    try {
      const info = await App.getInfo();
      console.log('[Update] AppInfo from device:', info);

      // Sabse reliable: `info.build` jo ke `versionCode` hota hai Android par
      // Yeh ek string ho sakti hai, isliye isko number mein convert karein
      const buildNumber = parseInt(info.build, 10);
      if (!isNaN(buildNumber) && buildNumber > 0) {
        console.log(`[Update] Got build number: ${buildNumber}`);
        return buildNumber;
      }
    } catch (e) {
      console.error('[Update] Could not get AppInfo:', e);
    }
    // Agar sab kuch fail ho jaye
    console.warn('[Update] Could not determine build number. Falling back to 1.');
    return 1;
  };

  const checkForUpdate = async () => {
    try {
      console.log('===== UPDATE CHECK STARTED =====');
      const currentVersionCode = await getLocalBuildCode();
      
      // Agar version code 1 hai (fallback), toh shayad error hai, isliye check skip karein
      if (currentVersionCode === 1 && Capacitor.isNativePlatform()) {
          console.warn('[Update] Local version code is fallback value (1). Skipping check to avoid update loop.');
          return;
      }

      console.log(`[Update] Local version code: ${currentVersionCode}`);

      const { data, error: dbError } = await supabase
        .from('app_version')
        .select('version_code, version_name, apk_url, force_update')
        .eq('id', 1) // Maan rahe hain ke aap hamesha id=1 wali row update karte hain
        .single();

      if (dbError) throw new Error(dbError.message);
      if (!data) throw new Error('No update data found in Supabase.');

      const serverCode = Number(data.version_code);
      console.log(`[Update] Server version code: ${serverCode}`);

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

  // ✅ **IMPROVED: In-App Downloader, isko hum istemal karenge**
  const handleUpdate = async () => {
    if (!updateInfo || !updateInfo.apk_url) {
      setError('Update information is missing. Cannot download.');
      return;
    }
    
    // IMPORTANT: Make sure your Supabase URL is the direct download link
    // e.g., https://<project-ref>.supabase.co/storage/v1/object/public/apk/app-release.apk
    const directApkUrl = updateInfo.apk_url;
    console.log(`[Update] Starting download from: ${directApkUrl}`);

    setDownloading(true);
    setError('');
    setDownloadProgress(0);

    try {
      // Naya file name version ke hisab se
      const fileName = `attendify_v${updateInfo.version_name}.apk`;

      // Capacitor HTTP se download karna behtar hai progress ke liye, but fetch() is also fine
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
      
      // Blob ko Base64 me convert karein
      const base64Data = await new Promise<string>((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onerror = reject;
        fileReader.onload = () => {
          const result = fileReader.result as string;
          // 'data:application/octet-stream;base64,' wala hissa hata dein
          resolve(result.substr(result.indexOf(',') + 1));
        };
        fileReader.readAsDataURL(blob);
      });

      console.log('[Update] Download complete. Writing file to cache...');

      const result = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache, // Cache directory use karein, system isko manage kar leta hai
      });

      console.log(`[Update] File written to: ${result.uri}. Opening installer...`);

      // FileOpener se APK installer kholein
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

  return { updateRequired, updateInfo, downloading, downloadProgress, error, handleUpdate, checkForUpdate };
}
