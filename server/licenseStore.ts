import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface SubAdminLicense {
  id: string;
  key: string;
  name: string;
  phoneOrNote?: string;
  planDays: number;
  createdAt: string;
  activatedAt?: string;
  expiresAt: string;
  isBlocked: boolean;
  blockedReason?: string;
  deviceId?: string;
  lastActiveAt?: string;
}

export interface LicenseStoreData {
  masterKeyHash: string; // SHA-256 hash of Master Admin Key
  globalLocked: boolean;
  globalLockMessage: string;
  subAdmins: SubAdminLicense[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'licenses.json');

// Master Admin Key (Hidden on server, compared via SHA-256 hash)
// Default Master Key generated securely: "MASTER-ADM-9924-K8X2-V7P1"
const DEFAULT_MASTER_KEY = 'MASTER-ADM-9924-K8X2-V7P1';

function hashKey(plainKey: string): string {
  return crypto.createHash('sha256').update(String(plainKey).trim()).digest('hex');
}

function generateSecureKey(prefix: string = 'SUB', days: number = 30): string {
  const segment1 = crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. 7A8B9C
  const segment2 = crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. 1D2E3F
  return `${prefix}-${days}D-${segment1}-${segment2}`;
}

// Initial default state
function getDefaultState(): LicenseStoreData {
  const initialMasterKey = process.env.MASTER_ADMIN_KEY || DEFAULT_MASTER_KEY;
  return {
    masterKeyHash: hashKey(initialMasterKey),
    globalLocked: false,
    globalLockMessage: 'Server maintenance in progress. App temporarily paused by Master Admin.',
    subAdmins: [], // No pre-populated sub-admin licenses; clean slate
  };
}

function ensureStorage(): LicenseStoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      const initData = getDefaultState();
      fs.writeFileSync(DATA_FILE, JSON.stringify(initData, null, 2), 'utf-8');
      return initData;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    
    // Ensure data shape is correct
    if (!parsed.masterKeyHash) {
      parsed.masterKeyHash = hashKey(process.env.MASTER_ADMIN_KEY || DEFAULT_MASTER_KEY);
    }
    if (!Array.isArray(parsed.subAdmins)) {
      parsed.subAdmins = [];
    }

    return {
      masterKeyHash: parsed.masterKeyHash,
      globalLocked: Boolean(parsed.globalLocked),
      globalLockMessage: parsed.globalLockMessage || 'Server maintenance in progress.',
      subAdmins: parsed.subAdmins,
    };
  } catch (err) {
    console.error('Failed to read licenses file, fallback to default:', err);
    return getDefaultState();
  }
}

function saveStorage(data: LicenseStoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save licenses file:', err);
  }
}

// ----------------------------------------------------
// MASTER ADMIN AUTHENTICATION
// ----------------------------------------------------

export function verifyMasterKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const store = ensureStorage();
  const inputHash = hashKey(key.trim());

  // Also allow environment variable override if set
  if (process.env.MASTER_ADMIN_KEY && key.trim() === process.env.MASTER_ADMIN_KEY.trim()) {
    return true;
  }

  return inputHash === store.masterKeyHash;
}

export function changeMasterKey(currentKey: string, newKey: string): { success: boolean; message: string } {
  if (!verifyMasterKey(currentKey)) {
    return { success: false, message: 'বর্তমান মাস্টার অ্যাডমিন কি (Current Master Key) সঠিক নয়।' };
  }
  if (!newKey || newKey.trim().length < 8) {
    return { success: false, message: 'নতুন মাস্টার কি কমপক্ষে ৮ অক্ষরের হতে হবে।' };
  }

  const store = ensureStorage();
  store.masterKeyHash = hashKey(newKey.trim());
  saveStorage(store);
  return { success: true, message: 'মাস্টার অ্যাডমিন কি সফলভাবে পরিবর্তন করা হয়েছে।' };
}

// ----------------------------------------------------
// SUB ADMIN LICENSE COMPUTATION & MANAGEMENT
// ----------------------------------------------------

export function computeLicenseStatus(
  license: SubAdminLicense,
  globalLocked: boolean
): { status: 'active' | 'expired' | 'blocked' | 'global_locked' | 'unactivated'; remainingDays: number } {
  if (globalLocked) {
    return { status: 'global_locked', remainingDays: 0 };
  }
  if (license.isBlocked) {
    return { status: 'blocked', remainingDays: 0 };
  }

  const now = Date.now();
  const exp = new Date(license.expiresAt).getTime();
  const diffMs = exp - now;
  const remainingDays = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));

  if (diffMs <= 0) {
    return { status: 'expired', remainingDays: 0 };
  }

  if (!license.activatedAt) {
    return { status: 'unactivated', remainingDays: license.planDays };
  }

  return { status: 'active', remainingDays };
}

export function getAllSubAdmins() {
  const store = ensureStorage();
  return {
    globalLocked: store.globalLocked,
    globalLockMessage: store.globalLockMessage,
    subAdmins: store.subAdmins.map((sub) => {
      const computed = computeLicenseStatus(sub, store.globalLocked);
      return {
        ...sub,
        status: computed.status,
        remainingDays: computed.remainingDays,
      };
    }),
  };
}

export function createSubAdminLicense(params: {
  name: string;
  phoneOrNote?: string;
  planDays: number;
}): SubAdminLicense {
  const store = ensureStorage();
  const days = Math.max(1, Number(params.planDays) || 30);
  const key = generateSecureKey('SUB', days);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

  const newSubAdmin: SubAdminLicense = {
    id: `sub_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    key,
    name: params.name.trim() || 'Sub Admin',
    phoneOrNote: params.phoneOrNote?.trim() || '',
    planDays: days,
    createdAt: now.toISOString(),
    expiresAt,
    isBlocked: false,
  };

  store.subAdmins.unshift(newSubAdmin);
  saveStorage(store);
  return newSubAdmin;
}

export function toggleBlockSubAdmin(id: string, isBlocked: boolean, reason?: string): boolean {
  const store = ensureStorage();
  const sub = store.subAdmins.find((s) => s.id === id || s.key === id);
  if (!sub) return false;
  sub.isBlocked = isBlocked;
  if (reason) sub.blockedReason = reason;
  saveStorage(store);
  return true;
}

export function updateSubAdminDuration(
  id: string,
  mode: 'extend' | 'set',
  days: number
): { success: boolean; newExpiresAt?: string; remainingDays?: number } {
  const store = ensureStorage();
  const sub = store.subAdmins.find((s) => s.id === id || s.key === id);
  if (!sub) return { success: false };

  const now = Date.now();
  if (mode === 'set') {
    const newExp = new Date(now + Math.max(1, days) * 24 * 60 * 60 * 1000);
    sub.expiresAt = newExp.toISOString();
    sub.planDays = days;
  } else {
    // extend
    const currentExp = new Date(sub.expiresAt).getTime();
    const baseTime = currentExp > now ? currentExp : now;
    const newExp = new Date(baseTime + days * 24 * 60 * 60 * 1000);
    sub.expiresAt = newExp.toISOString();
    sub.planDays = (sub.planDays || 0) + days;
  }

  sub.isBlocked = false; // Auto unblock on duration extension
  saveStorage(store);

  const computed = computeLicenseStatus(sub, store.globalLocked);
  return { success: true, newExpiresAt: sub.expiresAt, remainingDays: computed.remainingDays };
}

export function deleteSubAdmin(id: string): boolean {
  const store = ensureStorage();
  const initialLen = store.subAdmins.length;
  store.subAdmins = store.subAdmins.filter((s) => s.id !== id && s.key !== id);
  if (store.subAdmins.length !== initialLen) {
    saveStorage(store);
    return true;
  }
  return false;
}

export function toggleGlobalLock(globalLocked: boolean, message?: string): boolean {
  const store = ensureStorage();
  store.globalLocked = globalLocked;
  if (message) store.globalLockMessage = message;
  saveStorage(store);
  return store.globalLocked;
}

// ----------------------------------------------------
// SUB ADMIN CLIENT VALIDATION & ACTIVATION
// ----------------------------------------------------

export function validateSubAdminKey(key: string, deviceId?: string) {
  const store = ensureStorage();
  const cleanedKey = String(key || '').trim().toUpperCase();

  if (!cleanedKey) {
    return {
      valid: false,
      status: 'not_found' as const,
      role: 'sub_admin' as const,
      message: 'অনুগ্রহ করে আপনার সাব অ্যাডমিন লাইসেন্স কি প্রবেশ করান।',
    };
  }

  // Find sub-admin license
  const sub = store.subAdmins.find((s) => s.key.toUpperCase() === cleanedKey);
  if (!sub) {
    return {
      valid: false,
      status: 'not_found' as const,
      role: 'sub_admin' as const,
      message: 'অবৈধ লাইসেন্স কি! সঠিক লাইসেন্স পেতে মাস্টার অ্যাডমিনের সাথে যোগাযোগ করুন।',
    };
  }

  // Update activity and device
  sub.lastActiveAt = new Date().toISOString();
  if (deviceId && !sub.deviceId) {
    sub.deviceId = deviceId;
  }
  saveStorage(store);

  const computed = computeLicenseStatus(sub, store.globalLocked);

  if (computed.status === 'global_locked') {
    return {
      valid: false,
      status: 'global_locked' as const,
      role: 'sub_admin' as const,
      name: sub.name,
      message: store.globalLockMessage || 'মাস্টার অ্যাডমিন সাময়িকভাবে অ্যাপটি বন্ধ রেখেছেন।',
    };
  }

  if (computed.status === 'blocked') {
    return {
      valid: false,
      status: 'blocked' as const,
      role: 'sub_admin' as const,
      name: sub.name,
      message: sub.blockedReason || 'মাস্টার অ্যাডমিন কর্তৃক আপনার লাইসেন্স বন্ধ/বাতিল (Disabled) করা হয়েছে।',
    };
  }

  if (computed.status === 'expired') {
    return {
      valid: false,
      status: 'expired' as const,
      role: 'sub_admin' as const,
      name: sub.name,
      expiresAt: sub.expiresAt,
      remainingDays: 0,
      message: 'আপনার সাবস্ক্রিপশনের মেয়াদ শেষ হয়ে গেছে! পুনরায় অ্যাক্সেস পেতে মাস্টার অ্যাডমিনের সাথে যোগাযোগ করুন।',
    };
  }

  return {
    valid: true,
    status: 'active' as const,
    role: 'sub_admin' as const,
    name: sub.name,
    remainingDays: computed.remainingDays,
    expiresAt: sub.expiresAt,
    deviceId: sub.deviceId,
    message: `লাইসেন্স সক্রিয়। অবশিষ্ট মেয়াদ: ${computed.remainingDays} দিন।`,
  };
}

export function activateSubAdminKey(key: string, deviceId: string, clientDeviceName?: string) {
  const store = ensureStorage();
  const cleanedKey = String(key || '').trim().toUpperCase();

  if (!cleanedKey) {
    return {
      success: false,
      valid: false,
      status: 'not_found' as const,
      role: 'sub_admin' as const,
      message: 'লাইসেন্স কি আবশ্যক।',
    };
  }

  const sub = store.subAdmins.find((s) => s.key.toUpperCase() === cleanedKey);
  if (!sub) {
    return {
      success: false,
      valid: false,
      status: 'not_found' as const,
      role: 'sub_admin' as const,
      message: 'অবৈধ লাইসেন্স কি! সঠিক লাইসেন্স কি দিন।',
    };
  }

  if (sub.isBlocked) {
    return {
      success: false,
      valid: false,
      status: 'blocked' as const,
      role: 'sub_admin' as const,
      message: 'এই লাইসেন্সটি মাস্টার অ্যাডমিন দ্বারা ব্লক করা রয়েছে।',
    };
  }

  // First time activation timestamp
  const now = new Date();
  if (!sub.activatedAt) {
    sub.activatedAt = now.toISOString();
    // 30 days or planDays countdown starts at activation time
    sub.expiresAt = new Date(now.getTime() + (sub.planDays || 30) * 24 * 60 * 60 * 1000).toISOString();
  }

  sub.deviceId = deviceId || sub.deviceId || `DEV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  sub.lastActiveAt = now.toISOString();
  if (clientDeviceName && !sub.phoneOrNote) {
    sub.phoneOrNote = clientDeviceName;
  }

  saveStorage(store);

  const computed = computeLicenseStatus(sub, store.globalLocked);

  return {
    success: computed.status === 'active',
    valid: computed.status === 'active',
    status: computed.status,
    role: 'sub_admin' as const,
    name: sub.name,
    remainingDays: computed.remainingDays,
    expiresAt: sub.expiresAt,
    deviceId: sub.deviceId,
    message: computed.status === 'active'
      ? `সাব অ্যাডমিন (${sub.name}) সফলভাবে অ্যাক্টিভ হয়েছে! মেয়াদ: ${computed.remainingDays} দিন।`
      : 'লাইসেন্স সক্রিয় করা যায়নি।',
  };
}
