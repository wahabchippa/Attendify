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

export function useAppUpdate() {
  const [updateRequired, setUpdateRequired] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    checkForUpdate();
  }, []);

  const checkForUpdate = async () => {
    try {
      // Get actual app version from device
      const appInfo = await App.getInfo();
      const currentVersionCode = appInfo.versionCode; // Dynamic version
      
      console.log('Current App Version Code:', currentVersionCode);

      const { data, error } = await supabase
        .from('app_version')
        .select('*')
        .eq('id', 1)
        .single();

      if (error || !data) return;

      console.log('Server Version Code:', data.version_code);

      // Compare dynamic versions
      if (data.version_code > currentVersionCode) {
        setUpdateInfo(data);
        setUpdateRequired(true);
      }
    } catch (err) {
      console.error('Update check failed:', err);
    }
  };

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
        chunks.push(value);
        received += value.length;
        if (total > 0) setDownloadProgress(Math.round((received / total) * 100));
      }

      const allChunks = new Uint8Array(received);
      let position = 0;
      for (const chunk of chunks) {
        allChunks.set(chunk, position);
        position += chunk.length;
      }

      const base64 = btoa(
        allChunks.reduce((data, byte) => data + String.fromCharCode(byte), '')
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
      setError('Download failed. Please check your connection and try again.');
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  return { updateRequired, updateInfo, downloading, downloadProgress, error, handleUpdate };
}
