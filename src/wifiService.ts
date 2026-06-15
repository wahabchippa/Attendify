import { getOfficeLocations } from './store';

export interface WiFiCheckResult {
  isConnected: boolean;
  ipAddress: string;
  method: string;
  details: string;
}

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

export async function verifyWiFiConnection(): Promise<WiFiCheckResult> {
  const publicIP = await getPublicIP();
  const locations = getOfficeLocations();
  const allowedIPs = locations.map(loc => loc.ip_address);
  
  if (publicIP) {
    const isAllowed = allowedIPs.includes(publicIP);
    if (isAllowed) {
      const matchedLocation = locations.find(loc => loc.ip_address === publicIP);
      return {
        isConnected: true,
        ipAddress: publicIP,
        method: 'public-ip-match',
        details: `✅ Public IP ${publicIP} is verified as ${matchedLocation?.name || 'Office'}`,
      };
    }
    return {
      isConnected: false,
      ipAddress: publicIP,
      method: 'public-ip-mismatch',
      details: `❌ Public IP ${publicIP} is NOT from Office WiFi.`,
    };
  }

  return {
    isConnected: false,
    ipAddress: 'unknown',
    method: 'detection-failed',
    details: 'Could not detect public IP. Check internet connection.',
  };
}

export async function quickWiFiCheck(): Promise<boolean> {
  try {
    const publicIP = await getPublicIP();
    if (publicIP) {
      const locations = getOfficeLocations();
      return locations.map(loc => loc.ip_address).includes(publicIP);
    }
    return false;
  } catch {
    return false;
  }
}

export function simulateWiFiCheck(forceResult?: boolean): WiFiCheckResult {
  const locations = getOfficeLocations();
  const isConnected = forceResult !== undefined ? forceResult : Math.random() > 0.2;
  const randomIP = locations.length > 0 ? locations[Math.floor(Math.random() * locations.length)].ip_address : '10.0.0.1';
  return {
    isConnected,
    ipAddress: isConnected ? randomIP : '10.0.0.1',
    method: 'simulation',
    details: isConnected ? `Simulated: Connected via ${randomIP}` : 'Simulated: Not on office network',
  };
}

export function getAllowedIPs(): string[] {
  return getOfficeLocations().map(loc => loc.ip_address);
}
