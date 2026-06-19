// src/hooks/useAppUpdate.ts

import { useState } from 'react';

interface UpdateInfo {
  version_code: number;
  version_name: string;
  apk_url: string;
  force_update: boolean;
}

export function useAppUpdate() {
  // Sab states false/empty return karein
  const [updateRequired] = useState(false);
  const [updateInfo] = useState<UpdateInfo | null>(null);
  const [downloading] = useState(false);
  const [downloadProgress] = useState(0);
  const [error] = useState('');

  // 🔴 UPDATE FEATURE COMPLETELY DISABLED
  // Koi useEffect nahi, koi check nahi, koi update nahi

  return { 
    updateRequired,    // ✅ Hamesha false
    updateInfo,        // ✅ Hamesha null
    downloading,       // ✅ Hamesha false
    downloadProgress,  // ✅ Hamesha 0
    error,             // ✅ Hamesha ''
    handleUpdate: async () => {},  // ✅ Empty function (kuch nahi karega)
    checkForUpdate: async () => {}, // ✅ Empty function (kuch nahi karega)
  };
}
