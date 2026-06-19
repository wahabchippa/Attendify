// src/wifiService.ts

import { supabase } from './store';

export interface WiFiCheckResult {
  isConnected: boolean;
  ipAddress: string;
  method: string;
  details: string;
}

// =============================================
// 🔴 LOCATION COORDINATES
// =============================================

// 1. ZONE (Sirf GPS)
const ZONE_LATITUDE = 24.825222;    
const ZONE_LONGITUDE = 67.247472;   
const ZONE_RADIUS_METERS = 300;     

// 2. QC CENTER (IP + GPS Dono)
// 🔴 🔴 🔴 YAHAN QC CENTER KI EXACT LOCATION DAALEIN 🔴 🔴 🔴
// Google Maps par QC Center search karein, right-click karein, "What's here?" click karein
// Coordinates copy karein aur neechay daalein (Example: 24.8000, 67.2300)
const QC_CENTER_LATITUDE = 24.8000;    // 🔴 REPLACE WITH ACTUAL QC CENTER LAT
const QC_CENTER_LONGITUDE = 67.2300;   // 🔴 REPLACE WITH ACTUAL QC CENTER LNG
const QC_CENTER_RADIUS_METERS = 300;   

// =============================================
// 1. GPS HELPER
// =============================================
function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function checkGPSLocation(lat: number, lng: number, radius: number, name: string): Promise<{ isConnected: boolean; distance: number; error?: string }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ isConnected: false, distance: -1, error: 'GPS not supported' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const distance = getDistanceFromLatLonInMeters(lat, lng, userLat, userLng);
        resolve({
          isConnected: distance <= radius,
          distance: Math.round(distance),
        });
      },
      (err) => {
        let errorMsg = 'GPS location failed';
        if (err.code === 1) errorMsg = 'Location permission denied';
        else if (err.code === 2) errorMsg = 'GPS signal unavailable';
        else if (err.code === 3) errorMsg = 'GPS timeout';
        resolve({ isConnected: false, distance: -1, error: errorMsg });
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      }
    );
  });
}

// =============================================
// 2. PUBLIC IP HELPER
// =============================================
async function getPublicIP(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    return data.ip;
  } catch {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('https://api.my-ip.io/v2/ip.json', { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json();
      return data.ip;
    } catch {
      return null;
    }
  }
}

// =============================================
// 3. DATABASE SE SIRF ACTIVE IPs FETCH KAREIN (SIRF QC CENTER)
// =============================================
async function getActiveOfficeIPs(): Promise<string[]> {
  const { data, error } = await supabase
    .from('office_locations')
    .select('ip_address')
    .eq('is_active', true); // ⚠️ Zone is_active = false hai, isliye yeh sirf QC Center return karega

  if (error || !data) {
    console.error('Error fetching office IPs:', error);
    return [];
  }
  return data.map(row => row.ip_address);
}

// =============================================
// 4. MAIN VERIFY FUNCTION (HYBRID + QC GPS)
// =============================================
export async function verifyWiFiConnection(): Promise<WiFiCheckResult> {
  const publicIP = await getPublicIP();
  const activeIPs = await getActiveOfficeIPs();

  // --- STEP 1: QC Center Static IP Check ---
  if (publicIP && activeIPs.includes(publicIP)) {
    return {
      isConnected: true,
      ipAddress: publicIP,
      method: 'public-ip-match',
      details: `✅ Verified via IP: QC Center`,
    };
  }

  // --- STEP 2: Zone GPS Check ---
  const zoneGPS = await checkGPSLocation(ZONE_LATITUDE, ZONE_LONGITUDE, ZONE_RADIUS_METERS, 'Zone');
  if (zoneGPS.isConnected) {
    return {
      isConnected: true,
      ipAddress: `Zone (GPS: ${zoneGPS.distance}m)`,
      method: 'gps-geofence',
      details: `✅ Verified via GPS: ${zoneGPS.distance}m from Zone`,
    };
  }

  // --- STEP 3: QC Center GPS Check (IP fail hone ke baad) ---
  const qcGPS = await checkGPSLocation(QC_CENTER_LATITUDE, QC_CENTER_LONGITUDE, QC_CENTER_RADIUS_METERS, 'QC Center');
  if (qcGPS.isConnected) {
    return {
      isConnected: true,
      ipAddress: `QC Center (GPS: ${qcGPS.distance}m)`,
      method: 'gps-geofence',
      details: `✅ Verified via GPS: ${qcGPS.distance}m from QC Center`,
    };
  }

  // --- STEP 4: Agar GPS fail ho aur koi error message ho (Zone or QC) ---
  if (zoneGPS.error || qcGPS.error) {
    const errorMsg = zoneGPS.error || qcGPS.error || 'GPS failed';
    return {
      isConnected: false,
      ipAddress: publicIP || 'unknown',
      method: 'gps-failed',
      details: `❌ ${errorMsg}`,
    };
  }

  // --- STEP 5: Sab fail ---
  if (publicIP) {
    return {
      isConnected: false,
      ipAddress: publicIP,
      method: 'public-ip-mismatch',
      details: `❌ Not in QC Center (IP/GPS) and not in Zone (GPS).`,
    };
  }

  return {
    isConnected: false,
    ipAddress: 'unknown',
    method: 'detection-failed',
    details: 'Could not detect location. Check internet and GPS.',
  };
}

// =============================================
// 5. QUICK CHECK
// =============================================
export async function quickWiFiCheck(): Promise<boolean> {
  const result = await verifyWiFiConnection();
  return result.isConnected;
}

// =============================================
// 6. LOCATION LABEL (Dashboard ke liye)
// =============================================
export function getLocationFromIP(ip: string): string {
  if (ip.includes('QC Center')) return 'QC Center';
  if (ip.includes('Zone')) return 'Zone (GPS)';
  return 'Outside';
}
