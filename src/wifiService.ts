// src/wifiService.ts

import { supabase } from './store';

export interface WiFiCheckResult {
  isConnected: boolean;
  ipAddress: string;
  method: string;
  details: string;
}

// =============================================
// 🔴 ALL LOCATIONS COORDINATES
// =============================================

// 1. PK ZONE (Sirf GPS)
const ZONE_LATITUDE = 24.825222;    
const ZONE_LONGITUDE = 67.247472;   
const ZONE_RADIUS_METERS = 300;     

// 2. QC CENTER (IP + GPS Dono)
const QC_CENTER_LATITUDE = 24.856917;    // 24°51'24.9"N
const QC_CENTER_LONGITUDE = 67.111833;   // 67°06'42.6"E
const QC_CENTER_RADIUS_METERS = 300;     

// 3. Z HOUSE (Sirf GPS, Radius 700m)
const Z_HOUSE_LATITUDE = 24.882889;      // 24°52'58.4"N
const Z_HOUSE_LONGITUDE = 67.073278;     // 67°04'23.8"E
const Z_HOUSE_RADIUS_METERS = 700;       // 🔴 700 METER RADIUS

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
// 3. DATABASE SE SIRF ACTIVE IPs FETCH KAREIN (QC CENTER ONLY)
// =============================================
async function getActiveOfficeIPs(): Promise<string[]> {
  const { data, error } = await supabase
    .from('office_locations')
    .select('ip_address')
    .eq('is_active', true); // 🔴 Sirf QC Center ki IPs active hain

  if (error || !data) {
    console.error('Error fetching office IPs:', error);
    return [];
  }
  return data.map(row => row.ip_address);
}

// =============================================
// 4. MAIN VERIFY FUNCTION (ALL LOCATIONS)
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

  // --- STEP 2: QC Center GPS Check ---
  const qcGPS = await checkGPSLocation(QC_CENTER_LATITUDE, QC_CENTER_LONGITUDE, QC_CENTER_RADIUS_METERS, 'QC Center');
  if (qcGPS.isConnected) {
    return {
      isConnected: true,
      ipAddress: `QC Center (GPS: ${qcGPS.distance}m)`,
      method: 'gps-geofence',
      details: `✅ Verified via GPS: ${qcGPS.distance}m from QC Center`,
    };
  }

  // --- STEP 3: PK Zone GPS Check ---
  const zoneGPS = await checkGPSLocation(ZONE_LATITUDE, ZONE_LONGITUDE, ZONE_RADIUS_METERS, 'PK Zone');
  if (zoneGPS.isConnected) {
    return {
      isConnected: true,
      ipAddress: `PK Zone (GPS: ${zoneGPS.distance}m)`,
      method: 'gps-geofence',
      details: `✅ Verified via GPS: ${zoneGPS.distance}m from PK Zone`,
    };
  }

  // --- STEP 4: Z House GPS Check (700m Radius) ---
  const zHouseGPS = await checkGPSLocation(Z_HOUSE_LATITUDE, Z_HOUSE_LONGITUDE, Z_HOUSE_RADIUS_METERS, 'Z House');
  if (zHouseGPS.isConnected) {
    return {
      isConnected: true,
      ipAddress: `Z House (GPS: ${zHouseGPS.distance}m)`,
      method: 'gps-geofence',
      details: `✅ Verified via GPS: ${zHouseGPS.distance}m from Z House`,
    };
  }

  // --- STEP 5: Agar GPS fail ho ---
  if (qcGPS.error || zoneGPS.error || zHouseGPS.error) {
    const errorMsg = qcGPS.error || zoneGPS.error || zHouseGPS.error || 'GPS failed';
    return {
      isConnected: false,
      ipAddress: publicIP || 'unknown',
      method: 'gps-failed',
      details: `❌ ${errorMsg}`,
    };
  }

  // --- STEP 6: Sab fail (Not in Office) ---
  if (publicIP) {
    return {
      isConnected: false,
      ipAddress: publicIP,
      method: 'public-ip-mismatch',
      details: `❌ Not in Office (QC Center/PK Zone/Z House)`,
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
  if (ip.includes('PK Zone')) return 'PK Zone';
  if (ip.includes('Z House')) return 'Z House';
  return 'Outside';
}
