// src/hooks/useLocationPermission.ts

import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';

type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'unsupported';

interface UseLocationPermissionReturn {
  status:             PermissionStatus;
  showSettingsDialog: boolean;
  checkPermission:    () => Promise<void>;
  openAppSettings:    () => Promise<void>;
}

export function useLocationPermission(): UseLocationPermissionReturn {
  const [status, setStatus]                       = useState<PermissionStatus>('prompt');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const checkPermission = useCallback(async () => {
    // ── Web platform ──
    if (!Capacitor.isNativePlatform()) {
      if (!navigator.permissions?.query) {
        setStatus('unsupported');
        return;
      }
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setStatus(result.state as PermissionStatus);
        setShowSettingsDialog(result.state === 'denied');

        // Live updates agar user settings mein change kare
        result.onchange = () => {
          setStatus(result.state as PermissionStatus);
          setShowSettingsDialog(result.state === 'denied');
        };
      } catch {
        setStatus('unsupported');
      }
      return;
    }

    // ── Native platform (Android/iOS) ──
    try {
      const perm = await Geolocation.checkPermissions();

      if (perm.location === 'granted') {
        setStatus('granted');
        setShowSettingsDialog(false);
        return;
      }

      // ✅ Fix: 'prompt-with-rationale' bhi handle karo
      if (
        perm.location === 'denied' &&
        perm.location !== 'prompt' &&
        perm.location !== 'prompt-with-rationale'
      ) {
        // Already hard-denied — settings mein jaana hoga
        setStatus('denied');
        setShowSettingsDialog(true);
        return;
      }

      // Request permission
      const result = await Geolocation.requestPermissions();
      if (result.location === 'granted') {
        setStatus('granted');
        setShowSettingsDialog(false);
      } else {
        setStatus('denied');
        setShowSettingsDialog(true);
      }
    } catch {
      setStatus('unsupported');
    }
  }, []);

  const openAppSettings = useCallback(async () => {
    if (Capacitor.isNativePlatform()) {
      await App.openSettings();
    } else {
      // Web pe settings open nahi ho sakti — dialog band karo
      setShowSettingsDialog(false);
    }
  }, []);

  // ✅ Fix: checkPermission stable reference hai useCallback se
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return { status, showSettingsDialog, checkPermission, openAppSettings };
}