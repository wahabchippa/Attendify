import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';

type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'unsupported';

export function useLocationPermission() {
  const [status, setStatus] = useState<PermissionStatus>('prompt');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const checkPermission = async () => {
    console.log('🔍 Checking location permission...');
    
    if (!Capacitor.isNativePlatform()) {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          setStatus(result.state as PermissionStatus);
          if (result.state === 'denied') {
            setShowSettingsDialog(true);
          }
          console.log('📍 Web permission status:', result.state);
        } catch (e) {
          setStatus('unsupported');
        }
      } else {
        setStatus('unsupported');
      }
      return;
    }

    try {
      const perm = await Geolocation.checkPermissions();
      console.log('📍 Native permission status:', perm.location);
      
      if (perm.location === 'granted') {
        setStatus('granted');
        setShowSettingsDialog(false);
      } else if (perm.location === 'denied' || perm.location === 'prompt') {
        const result = await Geolocation.requestPermissions();
        console.log('📍 After request:', result.location);
        if (result.location === 'granted') {
          setStatus('granted');
          setShowSettingsDialog(false);
        } else {
          setStatus('denied');
          setShowSettingsDialog(true);
        }
      }
    } catch (error) {
      console.error('❌ Permission error:', error);
      setStatus('unsupported');
    }
  };

  const openAppSettings = async () => {
    if (Capacitor.isNativePlatform()) {
      await App.openSettings();
    } else {
      setShowSettingsDialog(false);
    }
  };

  useEffect(() => {
    checkPermission();
  }, []);

  return {
    status,
    showSettingsDialog,
    checkPermission,
    openAppSettings,
  };
}
