// src/hooks/useLocationPermission.ts

import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';

type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'unsupported';

export function useLocationPermission() {
  const [status, setStatus] = useState<PermissionStatus>('prompt');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const checkPermission = async () => {
    if (!Capacitor.isNativePlatform()) {
      // Web: browser API use karein
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setStatus(result.state as PermissionStatus);
        if (result.state === 'denied') {
          setShowSettingsDialog(true);
        }
      } else {
        setStatus('unsupported');
      }
      return;
    }

    // Native (Android/iOS)
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location === 'granted') {
        setStatus('granted');
        setShowSettingsDialog(false);
      } else if (perm.location === 'denied' || perm.location === 'prompt') {
        // Request permission
        const result = await Geolocation.requestPermissions();
        if (result.location === 'granted') {
          setStatus('granted');
          setShowSettingsDialog(false);
        } else {
          setStatus('denied');
          setShowSettingsDialog(true);
        }
      }
    } catch (error) {
      console.error('Permission error:', error);
      setStatus('unsupported');
    }
  };

  const openAppSettings = async () => {
    if (Capacitor.isNativePlatform()) {
      await App.openSettings();
    } else {
      // Web: fallback
      setShowSettingsDialog(false);
    }
  };

  useEffect(() => {
    checkPermission();
  }, []);

  return { status, showSettingsDialog, checkPermission, openAppSettings };
}
