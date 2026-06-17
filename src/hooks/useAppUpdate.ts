import { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../store'; // Agar aapka supabase client kisi aur file mein hai toh isko change kar sakte hain

const LOCAL_VERSION_CODE = 1; // ← Har baar jab aap nayi APK bano ge, isko 2, 3, 4 kar dena

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
    // Yeh code sirf asli mobile par chalega, computer/browser par error nahi dega
    if (!Capacitor.isNativePlatform()) return;
    checkForUpdate();
  }, []);

  const checkForUpdate = async () => {
    try {
      const { data, error } = await supabase
        .from('app_version')
        .select('*')
        .eq('id', 1)
        .single();

      if (error || !data) return;

      // Agar database mein version_code bara hai local se, toh update modal dikhao
      if (data.version_code > LOCAL_VERSION_CODE) {
        setUpdateInfo(data);
        setUpdateRequired(true);
      }
    } catch {}
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

      // Mobile memory mein save karein
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64,
        directory: Directory.Cache,
      });

      // Package installer ko call karein
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
