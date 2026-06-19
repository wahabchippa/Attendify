// src/hooks/useAppUpdate.ts

export interface UpdateInfo {
  version_code: number;
  version_name: string;
  apk_url:      string;
  force_update: boolean;
}

interface UseAppUpdateReturn {
  updateRequired:   boolean;
  updateInfo:       UpdateInfo | null;
  downloading:      boolean;
  downloadProgress: number;
  error:            string;
  handleUpdate:     () => Promise<void>;
  checkForUpdate:   () => Promise<void>;
}

// 🔴 UPDATE FEATURE DISABLED
// Jab enable karna ho toh yahan Supabase check add karo

export function useAppUpdate(): UseAppUpdateReturn {
  return {
    updateRequired:   false,
    updateInfo:       null,
    downloading:      false,
    downloadProgress: 0,
    error:            '',
    handleUpdate:     async () => {},
    checkForUpdate:   async () => {},
  };
}