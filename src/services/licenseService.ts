import { LicenseInfo, LicenseStatus, LicenseValidationResult } from '../types';

const DEVICE_ID_KEY = 'fb_app_device_id';
const SUB_ADMIN_KEY_STORAGE = 'fb_sub_admin_license_key';
const MASTER_TOKEN_KEY = 'fb_master_admin_token';
const MASTER_KEY_CACHE = 'fb_master_admin_saved_key';

// Generates or retrieves a unique client device ID
export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      const time = Date.now().toString(36).toUpperCase();
      id = `DEV-${rand}-${time}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch (e) {
    return 'DEV-DEFAULT-USER';
  }
}

// Sub Admin License Storage
export function getSavedLicenseKey(): string {
  try {
    return localStorage.getItem(SUB_ADMIN_KEY_STORAGE) || '';
  } catch (e) {
    return '';
  }
}

export function saveLicenseKey(key: string): void {
  try {
    if (key) {
      localStorage.setItem(SUB_ADMIN_KEY_STORAGE, key.trim().toUpperCase());
    } else {
      localStorage.removeItem(SUB_ADMIN_KEY_STORAGE);
    }
  } catch (e) {}
}

// Master Admin Saved Key (only saved locally in Master Admin browser if authorized)
export function getSavedMasterKey(): string {
  try {
    return sessionStorage.getItem(MASTER_KEY_CACHE) || '';
  } catch (e) {
    return '';
  }
}

export function saveMasterKey(key: string): void {
  try {
    if (key) {
      sessionStorage.setItem(MASTER_KEY_CACHE, key.trim());
    } else {
      sessionStorage.removeItem(MASTER_KEY_CACHE);
    }
  } catch (e) {}
}

export function getSavedMasterToken(): string {
  try {
    return sessionStorage.getItem(MASTER_TOKEN_KEY) || '';
  } catch (e) {
    return '';
  }
}

export function saveMasterToken(token: string): void {
  try {
    if (token) {
      sessionStorage.setItem(MASTER_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(MASTER_TOKEN_KEY);
    }
  } catch (e) {}
}

// Sub Admin Key Validation
export async function validateLicenseRemote(key: string): Promise<LicenseValidationResult> {
  const deviceId = getOrCreateDeviceId();
  try {
    const res = await fetch('/api/license/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key.trim().toUpperCase(), deviceId }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        valid: false,
        status: errData.status || 'not_found',
        message: errData.message || 'সাব অ্যাডমিন ভ্যালিডেশন ব্যর্থ হয়েছে।',
      };
    }
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      valid: false,
      status: 'error' as any,
      message: 'সার্ভারের সাথে সংযোগ পাওয়া যায়নি। ইন্টারনেট সংযোগ চেক করুন।',
    };
  }
}

// Sub Admin Key Activation
export async function activateLicenseRemote(key: string): Promise<LicenseValidationResult> {
  const deviceId = getOrCreateDeviceId();
  const userAgent = navigator.userAgent || 'Web/Android Browser';
  const clientDeviceName = userAgent.includes('Android') ? 'Android Phone' : 'Web Device';

  try {
    const res = await fetch('/api/license/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: key.trim().toUpperCase(),
        deviceId,
        clientDeviceName,
      }),
    });
    const data = await res.json();
    if (data.valid || data.success) {
      saveLicenseKey(key);
    }
    return data;
  } catch (err: any) {
    return {
      valid: false,
      status: 'error' as any,
      message: 'লাইসেন্স অ্যাক্টিভেশন ব্যর্থ হয়েছে। সার্ভার এরর।',
    };
  }
}

// ----------------------------------------
// MASTER ADMIN API SERVICES
// ----------------------------------------

export async function loginMasterAdminApi(masterKey: string): Promise<{ success: boolean; token?: string; message?: string }> {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ masterKey: masterKey.trim() }),
    });
    const data = await res.json();
    if (data.success && data.token) {
      saveMasterToken(data.token);
      saveMasterKey(masterKey.trim());
    }
    return data;
  } catch (err: any) {
    return { success: false, message: 'মাস্টার সার্ভারে সংযোগ করা সম্ভব হয়নি।' };
  }
}

export async function fetchMasterSubAdmins(masterKey?: string): Promise<{
  success: boolean;
  globalLocked: boolean;
  globalLockMessage: string;
  subAdmins: LicenseInfo[];
  message?: string;
}> {
  const token = getSavedMasterToken();
  const key = masterKey || getSavedMasterKey();

  try {
    const res = await fetch('/api/admin/licenses', {
      headers: {
        'Content-Type': 'application/json',
        'x-master-token': token,
        'x-master-key': key,
      },
    });
    if (!res.ok) {
      return { success: false, globalLocked: false, globalLockMessage: '', subAdmins: [], message: 'অননুমোদিত অ্যাক্সেস! সঠিক মাস্টার কি প্রয়োজন।' };
    }
    const data = await res.json();
    return {
      success: true,
      globalLocked: data.globalLocked,
      globalLockMessage: data.globalLockMessage,
      subAdmins: data.subAdmins || [],
    };
  } catch (err: any) {
    return { success: false, globalLocked: false, globalLockMessage: '', subAdmins: [], message: err.message };
  }
}

export async function createSubAdminApi(
  params: { name: string; phoneOrNote?: string; planDays: number },
  masterKey?: string
): Promise<{ success: boolean; license?: LicenseInfo; message?: string }> {
  const token = getSavedMasterToken();
  const key = masterKey || getSavedMasterKey();

  try {
    const res = await fetch('/api/admin/licenses/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-master-token': token,
        'x-master-key': key,
      },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: 'সাব অ্যাডমিন তৈরি করা যায়নি।' };
  }
}

export async function toggleBlockSubAdminApi(
  id: string,
  isBlocked: boolean,
  reason?: string,
  masterKey?: string
): Promise<{ success: boolean; message?: string }> {
  const token = getSavedMasterToken();
  const key = masterKey || getSavedMasterKey();

  try {
    const res = await fetch('/api/admin/licenses/toggle-block', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-master-token': token,
        'x-master-key': key,
      },
      body: JSON.stringify({ id, isBlocked, reason }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: 'সাব অ্যাডমিন স্ট্যাটাস পরিবর্তন করা যায়নি।' };
  }
}

export async function updateSubAdminDurationApi(
  id: string,
  days: number,
  mode: 'extend' | 'set',
  masterKey?: string
): Promise<{ success: boolean; newExpiresAt?: string; remainingDays?: number; message?: string }> {
  const token = getSavedMasterToken();
  const key = masterKey || getSavedMasterKey();

  try {
    const res = await fetch('/api/admin/licenses/extend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-master-token': token,
        'x-master-key': key,
      },
      body: JSON.stringify({ id, days, mode }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: 'মেয়াদ পরিবর্তন করা যায়নি।' };
  }
}

export async function deleteSubAdminApi(
  id: string,
  masterKey?: string
): Promise<{ success: boolean; message?: string }> {
  const token = getSavedMasterToken();
  const key = masterKey || getSavedMasterKey();

  try {
    const res = await fetch('/api/admin/licenses/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-master-token': token,
        'x-master-key': key,
      },
      body: JSON.stringify({ id }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: 'সাব অ্যাডমিন রিমুভ করা যায়নি।' };
  }
}

export async function toggleGlobalLockApi(
  globalLocked: boolean,
  message?: string,
  masterKey?: string
): Promise<{ success: boolean; globalLocked?: boolean; message?: string }> {
  const token = getSavedMasterToken();
  const key = masterKey || getSavedMasterKey();

  try {
    const res = await fetch('/api/admin/toggle-global-lock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-master-token': token,
        'x-master-key': key,
      },
      body: JSON.stringify({ globalLocked, message }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: 'গ্লোবাল লক পরিবর্তন করা যায়নি।' };
  }
}

export async function changeMasterKeyApi(
  currentKey: string,
  newKey: string
): Promise<{ success: boolean; message: string }> {
  const token = getSavedMasterToken();
  try {
    const res = await fetch('/api/admin/change-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-master-token': token,
      },
      body: JSON.stringify({ currentKey, newKey }),
    });
    const data = await res.json();
    if (data.success) {
      saveMasterKey(newKey);
    }
    return data;
  } catch (err: any) {
    return { success: false, message: 'মাস্টার কি পরিবর্তন করা যায়নি।' };
  }
}
