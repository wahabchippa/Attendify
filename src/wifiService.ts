// src/wifiService.ts

import { supabase } from './store';

// =============================================
// TYPES
// =============================================

export interface WiFiCheckResult {
  isConnected:    boolean;
  ipAddress:      string;
  method:         string;
  details:        string;
  locationLabel?: string;
  distance?:      number; // 🆕 Distance from nearest office in meters
}

// =============================================
// OFFICE GEO-FENCES
// =============================================

interface GeoFence {
  name:      string;
  lat:       number;
  lng:       number;
  radiusM:   number;
  fakeIP:    string;
}

const OFFICE_FENCES: GeoFence[] = [
  {
    name:    'QC Center',
    lat:     24.856917,
    lng:     67.111833,
    radiusM: 800,
    fakeIP:  '202.141.254.126',
  },
  {
    name:    'PK Zone',
    lat:     24.825222,
    lng:     67.247472,
    radiusM: 500,
    fakeIP:  '103.93.12.229',
  },
  {
    name:    'Z House',
    lat:     24.882889,
    lng:     67.073278,
    radiusM: 700,
    fakeIP:  '103.93.12.229',
  },
];

// =============================================
// HELPERS
// =============================================

function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R    = 6_371_000; // Earth radius in meters
  const toR  = (d: number) => d * (Math.PI / 180);
  const dLat = toR(lat2 - lat1);
  const dLon = toR(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getPermissionState(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (!navigator.permissions?.query) return 'unsupported';
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state as 'granted' | 'denied' | 'prompt';
  } catch {
    return 'unsupported';
  }
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GPS not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60_000 }
    );
  });
}

interface GeoResult {
  fence:    GeoFence;
  distance: number;
  inside:   boolean;
}

async function checkFence(fence: GeoFence, pos: GeolocationPosition): Promise<GeoResult> {
  const distance = Math.round(haversineDistance(
    fence.lat, fence.lng,
    pos.coords.latitude, pos.coords.longitude
  ));
  return { fence, distance, inside: distance <= fence.radiusM };
}

async function getPublicIP(): Promise<string | null> {
  const endpoints = [
    'https://api.ipify.org?format=json',
    'https://api.my-ip.io/v2/ip.json',
  ];

  for (const url of endpoints) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res  = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      const ip = data.ip;
      if (ip && typeof ip === 'string') return ip;
    } catch { /* try next */ }
  }
  return null;
}

async function getActiveOfficeIPs(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('office_locations')
      .select('ip_address')
      .eq('is_active', true);
    if (error || !data) return [];
    return data.map((r: any) => r.ip_address as string);
  } catch {
    return [];
  }
}

// =============================================
// MAIN VERIFICATION
// =============================================

export async function verifyWiFiConnection(): Promise<WiFiCheckResult> {

  // ── Step 1: Check GPS permission ──
  const perm = await getPermissionState();

  if (perm === 'denied') {
    return {
      isConnected:   false,
      ipAddress:     'unknown',
      method:        'gps-off',
      details:       '❌ Location permission denied. Enable in settings.',
      locationLabel: '',
    };
  }

  // ── Step 2: Get GPS position + Public IP in parallel ──
  const [posResult, publicIP] = await Promise.allSettled([
    getCurrentPosition(),
    getPublicIP(),
  ]);

  const ip = publicIP.status === 'fulfilled' ? publicIP.value : null;

  // ── Step 3: GPS failed / unavailable ──
  if (posResult.status === 'rejected') {
    const err = posResult.reason as GeolocationPositionError | Error;
    const code = (err as GeolocationPositionError).code;

    if (code === 1) {
      return {
        isConnected:   false,
        ipAddress:     ip || 'unknown',
        method:        'gps-off',
        details:       '❌ Location permission denied.',
        locationLabel: '',
      };
    }

    const activeIPs = await getActiveOfficeIPs();
    if (ip && activeIPs.includes(ip)) {
      return {
        isConnected:   true,
        ipAddress:     ip,
        method:        'public-ip-match',
        details:       `✅ Verified via IP match`,
        locationLabel: 'Office',
      };
    }

    return {
      isConnected:   false,
      ipAddress:     ip || 'unknown',
      method:        'gps-failed',
      details:       `❌ GPS failed: ${err.message || 'unavailable'}`,
      locationLabel: '',
    };
  }

  const pos = posResult.value;

  // ── Step 4: Check all fences in parallel ──
  const fenceResults = await Promise.all(
    OFFICE_FENCES.map(fence => checkFence(fence, pos))
  );

  // Find first matching fence
  const matched = fenceResults.find(r => r.inside);

  if (matched) {
    return {
      isConnected:   true,
      ipAddress:     matched.fence.fakeIP,
      method:        'gps-geofence',
      details:       `✅ GPS verified: ${matched.distance}m from ${matched.fence.name}`,
      locationLabel: matched.fence.name,
      distance:      matched.distance, // 🆕 Add distance
    };
  }

  // ── Step 5: GPS didn't match — try IP fallback ──
  const activeIPs = await getActiveOfficeIPs();

  if (ip && activeIPs.includes(ip)) {
    // Even with IP match, return closest distance
    const closest = fenceResults.sort((a, b) => a.distance - b.distance)[0];
    return {
      isConnected:   true,
      ipAddress:     ip,
      method:        'public-ip-match',
      details:       `✅ Verified via IP match`,
      locationLabel: 'Office',
      distance:      closest?.distance, // 🆕 Add distance
    };
  }

  // ── Step 6: Not in office ──
  const closest = fenceResults.sort((a, b) => a.distance - b.distance)[0];

  return {
    isConnected:   false,
    ipAddress:     ip || 'unknown',
    method:        'public-ip-mismatch',
    details:       `❌ Not in office. Closest: ${closest.fence.name} (${closest.distance}m away)`,
    locationLabel: '',
    distance:      closest.distance, // 🆕 Add distance
  };
}

// =============================================
// QUICK CHECK
// =============================================

export async function quickWiFiCheck(): Promise<boolean> {
  const result = await verifyWiFiConnection();
  return result.isConnected;
}