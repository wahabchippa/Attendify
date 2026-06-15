interface WiFiCheckResult {
  isConnected: boolean;
  ipAddress: string;
  method: string;
  details: string;
}

// Final allowed Public IPs - ONLY THESE WILL WORK
const OFFICE_PUBLIC_IPS = [
  '202.141.254.126', // QC Center
  '157.10.30.235',   // QC Center
  '103.93.12.229',   // Zone (New IP)
];

// Method: Fetch from public IP API
async function getPublicIP(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    return data.ip;
  } catch {
    // Try backup API
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('https://api.my-ip.io/v2/ip.json', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      return data.ip;
    } catch {
      return null;
    }
  }
}

// Main WiFi verification function - checks PUBLIC IP only
export async function verifyWiFiConnection(): Promise<WiFiCheckResult> {
  // Get public IP and verify against allowed list
  const publicIP = await getPublicIP();
  
  if (publicIP) {
    const isAllowed = OFFICE_PUBLIC_IPS.includes(publicIP);
    
    if (isAllowed) {
      return {
        isConnected: true,
        ipAddress: publicIP,
        method: 'public-ip-match',
        details: `✅ Public IP ${publicIP} is verified as Office WiFi`,
      };
    }
    
    return {
      isConnected: false,
      ipAddress: publicIP,
      method: 'public-ip-mismatch',
      details: `❌ Public IP ${publicIP} is NOT from Office WiFi. Allowed IPs: ${OFFICE_PUBLIC_IPS.join(', ')}`,
    };
  }

  return {
    isConnected: false,
    ipAddress: 'unknown',
    method: 'detection-failed',
    details: 'Could not detect public IP. Check internet connection.',
  };
}

// Quick connectivity check
export async function quickWiFiCheck(): Promise<boolean> {
  try {
    const publicIP = await getPublicIP();
    if (publicIP) {
      return OFFICE_PUBLIC_IPS.includes(publicIP);
    }
    return false;
  } catch {
    return false;
  }
}

// For demo/testing - simulate WiFi check
export function simulateWiFiCheck(forceResult?: boolean): WiFiCheckResult {
  const isConnected = forceResult !== undefined ? forceResult : Math.random() > 0.2;
  const randomIP = OFFICE_PUBLIC_IPS[Math.floor(Math.random() * OFFICE_PUBLIC_IPS.length)];
  return {
    isConnected,
    ipAddress: isConnected ? randomIP : '10.0.0.1',
    method: 'simulation',
    details: isConnected 
      ? `Simulated: Connected via ${randomIP}` 
      : 'Simulated: Not on office network',
  };
}

// Get all allowed IPs for display
export function getAllowedIPs(): string[] {
  return OFFICE_PUBLIC_IPS;
}
