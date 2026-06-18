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

const ALLOW_WEB_TEST = false;

export function useAppUpdate() {
  const [updateRequired, setUpdateRequired] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState({ local: 0, server: 0 });

  useEffect(() => {
    const check = async () => {
      const isNative = Capacitor.isNativePlatform();
      if (!isNative && !ALLOW_WEB_TEST) {
        return;
      }
      
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
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
    if (!Capacitor.isNativePlatform()) return 1;
    try {
      const info = await App.getInfo();
      const buildNumber = parseInt(info.build, 10);
      if (!isNaN(buildNumber) && buildNumber > 0) return buildNumber;
    } catch (e) {}
    return 1;
  };

  const checkForUpdate = async () => {
    try {
      const currentVersionCode = await getLocalBuildCode();
      if (currentVersionCode === 1 && Capacitor.isNativePlatform()) {
        setDebugInfo({ local: currentVersionCode, server: 0 });
        return;
      }

      const { data, error: dbError } = await supabase
        .from('app_version')
        .select('version_code, version_name, apk_url, force_update')
        .eq('id', 1)
        .single();

      if (dbError || !data) throw new Error(dbError?.message || 'No data found');

      const serverCode = Number(data.version_code);
      setDebugInfo({ local: currentVersionCode, server: serverCode });

      if (serverCode > currentVersionCode) {
        setUpdateInfo({
          version_code: serverCode,
          version_name: data.version_name,
          apk_url: data.apk_url,
          force_update: data.force_update,
        });
        setUpdateRequired(true);
      } else {
        setUpdateRequired(false);
        setUpdateInfo(null);
      }
    } catch (err) {
      setError('Could not check for updates.');
      setUpdateRequired(false);
    }
  };

  const handleUpdate = async () => {
    // ... (handleUpdate function remains the same, no changes needed here) ...
  };

  return { 
    updateRequired, 
    updateInfo, 
    downloading, 
    downloadProgress, 
    error, 
    handleUpdate, 
    checkForUpdate,
    debugInfo
  };
}
