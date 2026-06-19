// src/wifiService.ts

import { supabase } from './store';

export interface WiFiCheckResult {
  isConnected: boolean;
  ipAddress: string;
  method: string;
  details: string;
}

// =============================================
// 🔴 LOCATION COORDINATES (Updated Radius)
// =============================================

const ZONE_LATITUDE = 24.825222;
const ZONE_LONGITUDE = 67.247472;
const ZONE_RADIUS_METERS = 500;

const QC_CENTER_LATITUDE = 24.856917;
const QC_CENTER_LONGITUDE = 67.111833;
const QC_CENTER_RADIUS_METERS = 800; // 🔴 800m for weak GPS

const Z_HOUSE_LATITUDE = 24.882889;
const Z_HOUSE_LONGITUDE = 67.073278;
const Z_HOUSE_RADIUS_METERS = 700;

// =============================================
// 1. PERMISSION CHECK (Browser API)
// =============================================

async function checkLocationPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (!navigator.permissions || !navigator.permissions.query) {
    return 'unsupported';
  }
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state as 'granted' | 'denied' | 'prompt';
  } catch {
    return 'unsupported';
  }
}

// =============================================
// 2. GPS HELPER (With Permission Check)
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
  return new Promise(async (resolve) => {
    // --- Permission check ---
    const perm = await checkLocationPermission();
    if (perm === 'denied') {
      console.log(`❌ ${name}: Location permission denied by user.`);
      resolve({ isConnected: false, distance: -1, error: 'Location permission denied. Please enable in settings.' });
      return;
    }
    if (perm === 'unsupported') {
      // Fallback: try anyway
      console.log(`⚠️ ${name}: Permission API not supported, proceeding anyway.`);
    }

    if (!navigator.geolocation) {
      resolve({ isConnected: false, distance: -1, error: 'GPS not supported' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const distance = getDistanceFromLatLonInMeters(lat, lng, userLat, userLng);
        console.log(`✅ ${name}: Distance = ${Math.round(distance)}m (Radius = ${radius}m)`);
        resolve({
          isConnected: distance <= radius,
          distance: Math.round(distance),
        });
      },
      (err) => {
        let errorMsg = 'GPS location failed';
        if (err.code === 1) errorMsg = 'Location permission denied. Please allow in settings.';
        else if (err.code === 2) errorMsg = 'GPS signal unavailable. Go outside?';
        else if (err.code === 3) errorMsg = 'GPS timeout. Try again.';
        console.log(`❌ ${name}: ${errorMsg} (Code: ${err.code})`);
        resolve({ isConnected: false, distance: -1, error: errorMsg });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

// =============================================
// 3. PUBLIC IP HELPER
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
// 4. DATABASE SE ACTIVE IPs FETCH KAREIN
// =============================================
async function getActiveOfficeIPs(): Promise<string[]> {
  const { data, error } = await supabase
    .from('office_locations')
    .select('ip_address')
    .eq('is_active', true);

  if (error || !data) {
    console.error('Error fetching office IPs:', error);
    return [];
  }
  return data.map(row => row.ip_address);
}

// =============================================
// 5. MAIN VERIFY FUNCTION (GPS First)
// =============================================
export async function verifyWiFiConnection(): Promise<WiFiCheckResult> {
  const publicIP = await getPublicIP();
  const activeIPs = await getActiveOfficeIPs();

  console.log('🔍 Starting location verification...');
  console.log(`📡 Public IP: ${publicIP || 'unknown'}`);
  console.log(`📡 Active IPs: ${activeIPs.join(', ') || 'none'}`);

  // --- STEP 1: QC Center GPS Check (Pehle GPS) ---
  const qcGPS = await checkGPSLocation(QC_CENTER_LATITUDE, QC_CENTER_LONGITUDE, QC_CENTER_RADIUS_METERS, 'QC Center');
  if (qcGPS.isConnected) {
    console.log(`✅ QC Center GPS: ${qcGPS.distance}m (Inside radius)`);
    return {
      isConnected: true,
      ipAddress: `QC Center (GPS: ${qcGPS.distance}m)`,
      method: 'gps-geofence',
      details: `✅ Verified via GPS: ${qcGPS.distance}m from QC Center`,
    };
  } else if (qcGPS.error && qcGPS.error.includes('permission denied')) {
    // Permission denied — return early with clear message
    return {
      isConnected: false,
      ipAddress: publicIP || 'unknown',
      method: 'permission-denied',
      details: `❌ ${qcGPS.error}`,
    };
  }

  // --- STEP 2: QC Center IP Check ---
  if (publicIP && activeIPs.includes(publicIP)) {
    console.log(`✅ QC Center IP match: ${publicIP}`);
    return {
      isConnected: true,
      ipAddress: publicIP,
      method: 'public-ip-match',
      details: `✅ Verified via IP: QC Center`,
    };
  }

  // --- STEP 3: PK Zone GPS ---
  const zoneGPS = await checkGPSLocation(ZONE_LATITUDE, ZONE_LONGITUDE, ZONE_RADIUS_METERS, 'PK Zone');
  if (zoneGPS.isConnected) {
    console.log(`✅ PK Zone GPS: ${zoneGPS.distance}m`);
    return {
      isConnected: true,
      ipAddress: `PK Zone (GPS: ${zoneGPS.distance}m)`,
      method: 'gps-geofence',
      details: `✅ Verified via GPS: ${zoneGPS.distance}m from PK Zone`,
    };
  }

  // --- STEP 4: Z House GPS ---
  const zHouseGPS = await checkGPSLocation(Z_HOUSE_LATITUDE, Z_HOUSE_LONGITUDE, Z_HOUSE_RADIUS_METERS, 'Z House');
  if (zHouseGPS.isConnected) {
    console.log(`✅ Z House GPS: ${zHouseGPS.distance}m`);
    return {
      isConnected: true,
      ipAddress: `Z House (GPS: ${zHouseGPS.distance}m)`,
      method: 'gps-geofence',
      details: `✅ Verified via GPS: ${zHouseGPS.distance}m from Z House`,
    };
  }

  // --- STEP 5: GPS Errors (Permission Denied or others) ---
  if (qcGPS.error || zoneGPS.error || zHouseGPS.error) {
    // Prefer permission denied message
    const errorMsg = qcGPS.error || zoneGPS.error || zHouseGPS.error || 'GPS failed';
    console.log(`❌ GPS Error: ${errorMsg}`);
    return {
      isConnected: false,
      ipAddress: publicIP || 'unknown',
      method: 'gps-failed',
      details: `❌ ${errorMsg}`,
    };
  }

  // --- STEP 6: Not in Office ---
  console.log(`❌ Not in Office — IP: ${publicIP}, GPS: QC=${qcGPS.distance}m, Zone=${zoneGPS.distance}m, House=${zHouseGPS.distance}m`);
  return {
    isConnected: false,
    ipAddress: publicIP || 'unknown',
    method: 'public-ip-mismatch',
    details: `❌ Not in Office (QC Center/PK Zone/Z House)`,
  };
}

// =============================================
// 6. QUICK CHECK
// =============================================
export async function quickWiFiCheck(): Promise<boolean> {
  const result = await verifyWiFiConnection();
  return result.isConnected;
}

// =============================================
// 7. LOCATION LABEL
// =============================================
export function getLocationFromIP(ip: string): string {
  if (ip.includes('QC Center')) return 'QC Center';
  if (ip.includes('PK Zone')) return 'PK Zone';
  if (ip.includes('Z House')) return 'Z House';
  return '';
}
