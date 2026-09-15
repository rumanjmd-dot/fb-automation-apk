import React, { useState, useEffect } from 'react';
import {
  Crown,
  Key,
  X,
  Plus,
  Users,
  Clock,
  Ban,
  CheckCircle2,
  Copy,
  Check,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Search,
  Lock,
  Unlock,
  Calendar,
  Sparkles,
  Smartphone,
  Sliders,
  Send,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';
import { LicenseInfo } from '../types';
import {
  loginMasterAdminApi,
  fetchMasterSubAdmins,
  createSubAdminApi,
  toggleBlockSubAdminApi,
  updateSubAdminDurationApi,
  deleteSubAdminApi,
  toggleGlobalLockApi,
  changeMasterKeyApi,
  getSavedMasterKey,
} from '../services/licenseService';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshCurrentLicense?: () => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  onRefreshCurrentLicense,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [masterKeyInput, setMasterKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Master Dashboard States
  const [activeTab, setActiveTab] = useState<'sub_admins' | 'create' | 'settings'>('sub_admins');
  const [subAdmins, setSubAdmins] = useState<LicenseInfo[]>([]);
  const [globalLocked, setGlobalLocked] = useState(false);
  const [globalLockMessage, setGlobalLockMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'blocked'>('all');

  // Create Sub Admin Form State
  const [newSubAdminName, setNewSubAdminName] = useState('');
  const [newPhoneOrNote, setNewPhoneOrNote] = useState('');
  const [selectedPlanDays, setSelectedPlanDays] = useState<number>(30); // Default 1 Month (30 Days)
  const [customDays, setCustomDays] = useState('');
  const [createdLicense, setCreatedLicense] = useState<LicenseInfo | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Change Master Key State
  const [currentKeyInput, setCurrentKeyInput] = useState('');
  const [newKeyInput, setNewKeyInput] = useState('');
  const [keyChangeMsg, setKeyChangeMsg] = useState<{ text: string; success: boolean } | null>(null);

  // Auto login if already authenticated in session
  useEffect(() => {
    if (isOpen) {
      const cachedKey = getSavedMasterKey();
      if (cachedKey) {
        setMasterKeyInput(cachedKey);
        setIsAuthenticated(true);
        loadSubAdmins(cachedKey);
      }
    }
  }, [isOpen]);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setActionFeedback({ text, type });
    setTimeout(() => setActionFeedback(null), 4000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterKeyInput.trim()) {
      setKeyError('মাস্টার অ্যাডমিন কি (Master Admin Key) প্রবেশ করান।');
      return;
    }
    setIsLoggingIn(true);
    setKeyError('');

    try {
      const res = await loginMasterAdminApi(masterKeyInput.trim());
      if (res.success) {
        setIsAuthenticated(true);
        loadSubAdmins(masterKeyInput.trim());
      } else {
        setKeyError(res.message || 'ভুল মাস্টার অ্যাডমিন কি! সঠিক কি দিয়ে পুনরায় চেষ্টা করুন।');
      }
    } catch (err: any) {
      setKeyError('সার্ভার সংযোগ সমস্যা। ইন্টারনেট সংযোগ নিশ্চিত করুন।');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const loadSubAdmins = async (key?: string) => {
    setIsLoading(true);
    try {
      const data = await fetchMasterSubAdmins(key || masterKeyInput.trim());
      if (data.success) {
        setSubAdmins(data.subAdmins || []);
        setGlobalLocked(Boolean(data.globalLocked));
        setGlobalLockMessage(data.globalLockMessage || '');
      } else {
        showFeedback(data.message || 'সাব অ্যাডমিন তালিকা লোড করা সম্ভব হয়নি।', 'error');
      }
    } catch (err) {
      showFeedback('সাব অ্যাডমিন তালিকা লোড ব্যর্থ।', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubAdminName.trim()) {
      showFeedback('সাব অ্যাডমিনের নাম আবশ্যক (যেমন: Rahim)।', 'error');
      return;
    }

    const days = customDays ? parseInt(customDays, 10) : selectedPlanDays;
    if (!days || days < 1) {
      showFeedback('সঠিক দিনের সংখ্যা বা মেয়াদ নির্বাচন করুন।', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await createSubAdminApi(
        {
          name: newSubAdminName.trim(),
          phoneOrNote: newPhoneOrNote.trim(),
          planDays: days,
        },
        masterKeyInput.trim()
      );

      if (res.success && res.license) {
        setCreatedLicense(res.license);
        setNewSubAdminName('');
        setNewPhoneOrNote('');
        showFeedback(`"${res.license.name}"-এর জন্য ${days} দিনের সাব অ্যাডমিন লাইসেন্স তৈরি হয়েছে!`);
        loadSubAdmins();
        if (onRefreshCurrentLicense) onRefreshCurrentLicense();
      } else {
        showFeedback(res.message || 'লাইসেন্স তৈরি করা যায়নি।', 'error');
      }
    } catch (err) {
      showFeedback('সার্ভার ত্রুটি।', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Instantly Disable/Block or Enable/Unblock Sub Admin
  const handleToggleBlock = async (id: string, currentlyBlocked: boolean, name: string) => {
    const actionText = currentlyBlocked ? 'সক্রিয় (Enable)' : 'বন্ধ/অফ (Disable)';
    if (!window.confirm(`আপনি কি সত্যিই "${name}" সাব অ্যাডমিনকে ${actionText} করতে চান?`)) return;

    setIsLoading(true);
    try {
      const res = await toggleBlockSubAdminApi(id, !currentlyBlocked, 'Disabled by Master Admin', masterKeyInput.trim());
      if (res.success) {
        showFeedback(res.message || `সাব অ্যাডমিন ${actionText} করা হয়েছে!`);
        loadSubAdmins();
        if (onRefreshCurrentLicense) onRefreshCurrentLicense();
      } else {
        showFeedback('ব্যর্থ হয়েছে।', 'error');
      }
    } catch (e) {
      showFeedback('সার্ভার এরর।', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Extend or Change Sub Admin Duration
  const handleExtend = async (id: string, days: number, name: string) => {
    if (!window.confirm(`"${name}" সাব অ্যাডমিনের মেয়াদ আরো ${days} দিন বাড়াতে চান?`)) return;

    setIsLoading(true);
    try {
      const res = await updateSubAdminDurationApi(id, days, 'extend', masterKeyInput.trim());
      if (res.success) {
        showFeedback(`"${name}"-এর মেয়াদ সফলভাবে আরো ${days} দিন বৃদ্ধি করা হয়েছে!`);
        loadSubAdmins();
        if (onRefreshCurrentLicense) onRefreshCurrentLicense();
      } else {
        showFeedback('মেয়াদ পরিবর্তন করা যায়নি।', 'error');
      }
    } catch (e) {
      showFeedback('সার্ভার এরর।', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Custom Duration Adjustment prompt
  const handleSetCustomDays = async (id: string, name: string) => {
    const input = window.prompt(`"${name}" সাব অ্যাডমিনের নতুন মেয়াদ কয়দিন নির্ধারণ করতে চান? (যেমন: 7, 30, 60, 90):`, '30');
    if (!input) return;
    const days = parseInt(input, 10);
    if (isNaN(days) || days < 1) {
      alert('সঠিক দিন সংখ্যা লিখুন।');
      return;
    }

    setIsLoading(true);
    try {
      const res = await updateSubAdminDurationApi(id, days, 'set', masterKeyInput.trim());
      if (res.success) {
        showFeedback(`"${name}"-এর মেয়াদ ${days} দিনে সেট করা হয়েছে!`);
        loadSubAdmins();
        if (onRefreshCurrentLicense) onRefreshCurrentLicense();
      }
    } catch (e) {
      showFeedback('সার্ভার এরর।', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Sub Admin permanently
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`সতর্কতা: "${name}" সাব অ্যাডমিন লাইসেন্সটি কি স্থায়ীভাবে মুছে (Delete) ফেলতে চান? এর ফলে উক্ত ব্যক্তি আর কখনো এই কি দিয়ে লগইন করতে পারবে না!`)) return;

    setIsLoading(true);
    try {
      const res = await deleteSubAdminApi(id, masterKeyInput.trim());
      if (res.success) {
        showFeedback(`"${name}" সাব অ্যাডমিন সফলভাবে রিমুভ করা হয়েছে!`);
        loadSubAdmins();
        if (onRefreshCurrentLicense) onRefreshCurrentLicense();
      } else {
        showFeedback('ডিলিট করা সম্ভব হয়নি।', 'error');
      }
    } catch (e) {
      showFeedback('সার্ভার এরর।', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Master Global Lock (Emergency Kill-Switch for all sub-admins)
  const handleToggleGlobalLock = async () => {
    const nextState = !globalLocked;
    const confirmMsg = nextState
      ? 'সতর্কতা: আপনি কি সাময়িকভাবে সব সাব অ্যাডমিনের জন্য অ্যাপ বন্ধ (Lock App for All) করতে চান?'
      : 'আপনি কি অ্যাপ পুনরায় সব সাব অ্যাডমিনের জন্য সচল করতে চান?';
    if (!window.confirm(confirmMsg)) return;

    setIsLoading(true);
    try {
      const res = await toggleGlobalLockApi(nextState, 'সার্ভার রক্ষণাবেক্ষণ চলছে। মাস্টার অ্যাডমিন সাময়িক অ্যাপ বন্ধ রেখেছেন।', masterKeyInput.trim());
      if (res.success) {
        setGlobalLocked(Boolean(res.globalLocked));
        showFeedback(res.message || 'গ্লোবাল লক আপডেট হয়েছে!');
        loadSubAdmins();
        if (onRefreshCurrentLicense) onRefreshCurrentLicense();
      }
    } catch (e) {
      showFeedback('সার্ভার এরর।', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Change Master Admin Key
  const handleChangeMasterKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentKeyInput || !newKeyInput) {
      setKeyChangeMsg({ text: 'বর্তমান এবং নতুন উভয় কি প্রদান করুন।', success: false });
      return;
    }
    if (newKeyInput.trim().length < 8) {
      setKeyChangeMsg({ text: 'নতুন মাস্টার কি কমপক্ষে ৮ অক্ষরের হতে হবে।', success: false });
      return;
    }
    try {
      const res = await changeMasterKeyApi(currentKeyInput.trim(), newKeyInput.trim());
      setKeyChangeMsg({ text: res.message, success: res.success });
      if (res.success) {
        setMasterKeyInput(newKeyInput.trim());
        setCurrentKeyInput('');
        setNewKeyInput('');
      }
    } catch (e) {
      setKeyChangeMsg({ text: 'মাস্টার কি পরিবর্তন ব্যর্থ হয়েছে।', success: false });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  if (!isOpen) return null;

  // Stats calculation
  const totalCount = subAdmins.length;
  const activeCount = subAdmins.filter((s) => s.status === 'active').length;
  const expiredCount = subAdmins.filter((s) => s.status === 'expired').length;
  const blockedCount = subAdmins.filter((s) => s.isBlocked || s.status === 'blocked').length;

  const filteredSubAdmins = subAdmins.filter((sub) => {
    const nameStr = sub.name || sub.clientName || '';
    const matchesSearch =
      nameStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sub.phoneOrNote && sub.phoneOrNote.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === 'active') return sub.status === 'active';
    if (statusFilter === 'expired') return sub.status === 'expired';
    if (statusFilter === 'blocked') return sub.isBlocked || sub.status === 'blocked';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md font-sans">
      <div className="w-full max-w-4xl max-h-[92vh] bg-[#0c141f] border border-[#1e2f44] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="px-5 py-4 bg-[#111c2a] border-b border-[#1c2e42] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-amber-500/20">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black tracking-wide uppercase text-white">
                  Master Admin Control Panel
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-[10px] font-bold text-amber-300">
                  Full Authority
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Sub Admin License Generation, Durations, Activation & Instant Control
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={() => loadSubAdmins()}
                disabled={isLoading}
                title="রিফ্রেশ করুন"
                className="p-2 rounded-xl bg-[#172537] hover:bg-[#20334b] text-slate-300 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#172537] hover:bg-[#20334b] text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {actionFeedback && (
          <div
            className={`px-4 py-2.5 text-xs font-semibold flex items-center gap-2 shrink-0 ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-950/80 text-emerald-300 border-b border-emerald-800'
                : 'bg-rose-950/80 text-rose-300 border-b border-rose-800'
            }`}
          >
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{actionFeedback.text}</span>
          </div>
        )}

        {/* BODY */}
        {!isAuthenticated ? (
          /* ====================================================
             MASTER ADMIN AUTHENTICATION SCREEN
             ==================================================== */
          <div className="p-6 sm:p-10 flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-yellow-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-4 shadow-lg">
              <Crown className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1">
              মাস্টার অ্যাডমিন অথেন্টিকেশন
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mb-6">
              শুধুমাত্র ওনার/মাস্টার অ্যাডমিন প্রবেশ করতে পারবেন। আপনার গোপন <span className="text-amber-300 font-semibold">Master Admin Key</span> প্রবেশ করান:
            </p>

            <form onSubmit={handleLogin} className="w-full max-w-sm space-y-3.5">
              <div className="relative">
                <input
                  type="password"
                  placeholder="Master Admin Key প্রবেশ করান..."
                  value={masterKeyInput}
                  onChange={(e) => {
                    setMasterKeyInput(e.target.value);
                    setKeyError('');
                  }}
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-[#14202e] border border-[#23374e] text-center font-mono tracking-widest text-amber-300 placeholder-slate-500 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />
                <Key className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              </div>

              {keyError && (
                <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center justify-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{keyError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>যাচাই করা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4" />
                    <span>প্যানেলে প্রবেশ করুন (Verify Master Key)</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* ====================================================
             AUTHENTICATED MASTER ADMIN DASHBOARD
             ==================================================== */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Top Navigation Tabs & Quick Status Bar */}
            <div className="px-5 pt-3 pb-2 bg-[#0e1724] border-b border-[#1b2b3d] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-1.5 bg-[#142030] p-1 rounded-xl border border-[#213348]">
                <button
                  onClick={() => setActiveTab('sub_admins')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'sub_admins'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Sub Admin তালিকা ({totalCount})</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('create');
                    setCreatedLicense(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'create'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>নতুন Sub Admin তৈরি করুন</span>
                </button>

                <button
                  onClick={() => setActiveTab('settings')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'settings'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>মাস্টার সেটিংস</span>
                </button>
              </div>

              {/* Emergency Global App Lock Toggle */}
              <button
                onClick={handleToggleGlobalLock}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                  globalLocked
                    ? 'bg-rose-900/60 border-rose-600 text-rose-200 animate-pulse'
                    : 'bg-[#142232] border-[#22354a] text-slate-300 hover:border-rose-500/50 hover:text-rose-300'
                }`}
              >
                {globalLocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-rose-400" />
                    <span>⚠️ অ্যাপ লক সক্রিয় (All Locked)</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>অ্যাপ সবার জন্য সচল (Active)</span>
                  </>
                )}
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {/* TAB 1: SUB ADMINS LIST */}
              {activeTab === 'sub_admins' && (
                <div className="space-y-4">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 rounded-xl bg-[#121d2b] border border-[#1e2f44]">
                      <span className="text-[11px] text-slate-400 block font-medium">মোট Sub Admin:</span>
                      <span className="text-lg font-black text-white">{totalCount}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#121d2b] border border-emerald-900/40">
                      <span className="text-[11px] text-emerald-400 block font-medium">সক্রিয় (Active):</span>
                      <span className="text-lg font-black text-emerald-400">{activeCount}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#121d2b] border border-amber-900/40">
                      <span className="text-[11px] text-amber-400 block font-medium">মেয়াদোত্তীর্ণ (Expired):</span>
                      <span className="text-lg font-black text-amber-400">{expiredCount}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-[#121d2b] border border-rose-900/40">
                      <span className="text-[11px] text-rose-400 block font-medium">অফ / ব্লক (Disabled):</span>
                      <span className="text-lg font-black text-rose-400">{blockedCount}</span>
                    </div>
                  </div>

                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Sub Admin-এর নাম, লাইসেন্স কি বা নোট দিয়ে খুঁজুন..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#14202f] border border-[#22354b] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-[#14202f] p-1 rounded-xl border border-[#22354b] shrink-0 text-xs">
                      {(['all', 'active', 'expired', 'blocked'] as const).map((filter) => (
                        <button
                          key={filter}
                          onClick={() => setStatusFilter(filter)}
                          className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-colors ${
                            statusFilter === filter
                              ? 'bg-amber-500 text-slate-950 font-bold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {filter === 'all'
                            ? 'সব'
                            : filter === 'active'
                            ? 'সক্রিয়'
                            : filter === 'expired'
                            ? 'মেয়াদ শেষ'
                            : 'বন্ধ (Off)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sub Admin Cards List */}
                  {filteredSubAdmins.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#111c2a] border border-[#1c2e42] text-center space-y-2">
                      <Users className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-sm font-semibold text-slate-300">
                        {subAdmins.length === 0
                          ? 'এখনো কোনো Sub Admin তৈরি করা হয়নি।'
                          : 'অনুসন্ধানের সাথে কোনো Sub Admin মেলেনি।'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {subAdmins.length === 0
                          ? 'উপরে "নতুন Sub Admin তৈরি করুন" ট্যাবে চাপ দিয়ে ১ মাস, ২ মাস বা ইচ্ছামতো মেয়াদের লাইসেন্স তৈরি করুন।'
                          : 'ফিল্টার রিসেট করে পুনরায় চেষ্টা করুন।'}
                      </p>
                      {subAdmins.length === 0 && (
                        <button
                          onClick={() => setActiveTab('create')}
                          className="mt-2 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-colors inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>প্রথম Sub Admin তৈরি করুন</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {filteredSubAdmins.map((sub) => {
                        const isBlocked = sub.isBlocked || sub.status === 'blocked';
                        const isExpired = sub.status === 'expired';
                        const isActive = sub.status === 'active';

                        return (
                          <div
                            key={sub.id}
                            className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                              isBlocked
                                ? 'bg-rose-950/20 border-rose-800/40'
                                : isExpired
                                ? 'bg-amber-950/20 border-amber-800/40'
                                : 'bg-[#121c29] border-[#1e2f44] hover:border-amber-500/40'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                              {/* Left Info */}
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-white">
                                    {sub.name || sub.clientName || 'Sub Admin'}
                                  </span>

                                  {/* Status badge */}
                                  {isBlocked ? (
                                    <span className="px-2 py-0.5 rounded-md bg-rose-900/60 border border-rose-700 text-rose-300 text-[10px] font-bold">
                                      🛑 বন্ধ / নিষ্ক্রিয় (Disabled)
                                    </span>
                                  ) : isExpired ? (
                                    <span className="px-2 py-0.5 rounded-md bg-amber-900/60 border border-amber-700 text-amber-300 text-[10px] font-bold">
                                      ⏰ মেয়াদ শেষ (Expired)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-900/60 border border-emerald-700 text-emerald-300 text-[10px] font-bold">
                                      🟢 সক্রিয় ({sub.remainingDays} দিন বাকি)
                                    </span>
                                  )}

                                  {sub.phoneOrNote && (
                                    <span className="text-[11px] text-slate-400 font-medium">
                                      • {sub.phoneOrNote}
                                    </span>
                                  )}
                                </div>

                                {/* Key Display with 1-Click Copy */}
                                <div className="flex items-center gap-2">
                                  <code className="px-2.5 py-1 rounded bg-[#0b121b] border border-[#1c2c3e] font-mono text-xs text-amber-300 font-bold select-all">
                                    {sub.key}
                                  </code>
                                  <button
                                    onClick={() => copyToClipboard(sub.key)}
                                    title="লাইসেন্স কি কপি করুন"
                                    className="p-1 rounded bg-[#172332] hover:bg-[#203146] text-slate-300 hover:text-white transition-colors"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                                  <span>প্যাকেজ: {sub.planDays} দিন</span>
                                  <span>
                                    মেয়াদ শেষ:{' '}
                                    {sub.expiresAt
                                      ? new Date(sub.expiresAt).toLocaleDateString()
                                      : 'অ্যাক্টিভেশনের পর শুরু'}
                                  </span>
                                  {sub.lastActiveAt && (
                                    <span className="hidden md:inline">
                                      সর্বশেষ: {new Date(sub.lastActiveAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right Action Controls: Instant Disable, Extend Duration, Set Custom Days, Delete */}
                              <div className="flex items-center gap-1.5 flex-wrap shrink-0 pt-1 sm:pt-0">
                                {/* Instant Disable / Enable Switch */}
                                <button
                                  onClick={() => handleToggleBlock(sub.id, isBlocked, sub.name || 'Sub Admin')}
                                  disabled={isLoading}
                                  title={isBlocked ? 'পুনরায় সচল করুন' : 'তাৎক্ষণিক অফ/ব্লক করুন'}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                    isBlocked
                                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                      : 'bg-rose-900/60 hover:bg-rose-800 border border-rose-700 text-rose-200'
                                  }`}
                                >
                                  {isBlocked ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>সক্রিয় করুন</span>
                                    </>
                                  ) : (
                                    <>
                                      <Ban className="w-3.5 h-3.5" />
                                      <span>অফ / Disable</span>
                                    </>
                                  )}
                                </button>

                                {/* Quick Extend (+30 Days) */}
                                <button
                                  onClick={() => handleExtend(sub.id, 30, sub.name || 'Sub Admin')}
                                  disabled={isLoading}
                                  title="মেয়াদ ১ মাস বাড়ান"
                                  className="px-2.5 py-1.5 rounded-lg bg-[#182738] hover:bg-[#22364c] border border-[#273d56] text-xs font-semibold text-slate-200 transition-colors"
                                >
                                  +৩০ দিন
                                </button>

                                {/* Quick Extend (+60 Days) */}
                                <button
                                  onClick={() => handleExtend(sub.id, 60, sub.name || 'Sub Admin')}
                                  disabled={isLoading}
                                  title="মেয়াদ ২ মাস বাড়ান"
                                  className="px-2.5 py-1.5 rounded-lg bg-[#182738] hover:bg-[#22364c] border border-[#273d56] text-xs font-semibold text-slate-200 transition-colors"
                                >
                                  +৬০ দিন
                                </button>

                                {/* Custom Duration Setting */}
                                <button
                                  onClick={() => handleSetCustomDays(sub.id, sub.name || 'Sub Admin')}
                                  disabled={isLoading}
                                  title="কাস্টম মেয়াদ পরিবর্তন করুন"
                                  className="p-1.5 rounded-lg bg-[#182738] hover:bg-[#22364c] border border-[#273d56] text-slate-300 transition-colors"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                </button>

                                {/* Delete Sub Admin */}
                                <button
                                  onClick={() => handleDelete(sub.id, sub.name || 'Sub Admin')}
                                  disabled={isLoading}
                                  title="স্থায়ীভাবে ডিলিট করুন"
                                  className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900 border border-rose-900 text-rose-400 hover:text-white transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: CREATE NEW SUB ADMIN LICENSE */}
              {activeTab === 'create' && (
                <div className="max-w-xl mx-auto space-y-5">
                  <div className="p-4 rounded-2xl bg-[#111c2a] border border-[#1e2f44]">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#1c2c3e]">
                      <UserPlus className="w-4 h-4 text-amber-400" />
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        নতুন Sub Admin License তৈরি করুন
                      </h3>
                    </div>

                    <form onSubmit={handleCreateSubAdmin} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Sub Admin-এর নাম * (যেমন: Rahim, Karim, Agency A)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="সাব অ্যাডমিনের নাম লিখুন..."
                          value={newSubAdminName}
                          onChange={(e) => setNewSubAdminName(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#162333] border border-[#25394f] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          ফোন নাম্বার বা নোট (ঐচ্ছিক)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 017XXXXXXXX / VIP Client"
                          value={newPhoneOrNote}
                          onChange={(e) => setNewPhoneOrNote(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#162333] border border-[#25394f] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      {/* Duration Preset Selector */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                          লাইসেন্সের মেয়াদ (Duration Selection) *
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { label: '৭ দিন', days: 7 },
                            { label: '১৫ দিন', days: 15 },
                            { label: '১ মাস (৩০ দিন)', days: 30 },
                            { label: '২ মাস (৬০ দিন)', days: 60 },
                            { label: '৩ মাস (৯০ দিন)', days: 90 },
                            { label: '৬ মাস (১৮০ দিন)', days: 180 },
                            { label: '১ বছর (৩৬৫ দিন)', days: 365 },
                            { label: 'কাস্টম দিন', days: 0 },
                          ].map((item) => (
                            <button
                              key={item.days}
                              type="button"
                              onClick={() => {
                                setSelectedPlanDays(item.days);
                                if (item.days !== 0) setCustomDays('');
                              }}
                              className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                                selectedPlanDays === item.days
                                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                                  : 'bg-[#152233] border-[#22354c] text-slate-300 hover:border-slate-500'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>

                        {selectedPlanDays === 0 && (
                          <div className="mt-2.5">
                            <input
                              type="number"
                              min="1"
                              max="3650"
                              placeholder="কাস্টম দিনের সংখ্যা লিখুন (যেমন: 45)..."
                              value={customDays}
                              onChange={(e) => setCustomDays(e.target.value)}
                              className="w-full px-3.5 py-2 rounded-xl bg-[#162333] border border-amber-500/50 text-sm text-amber-300 font-mono focus:outline-none"
                            />
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all disabled:opacity-50"
                      >
                        {isLoading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Crown className="w-4 h-4" />
                            <span>Sub Admin License তৈরি করুন (Generate)</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  {/* Successfully Created License Display */}
                  {createdLicense && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-amber-950/30 to-emerald-950/30 border border-amber-500/40 shadow-xl space-y-3">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                        <h4 className="text-xs font-bold uppercase tracking-wider">
                          Sub Admin License সফলভাবে তৈরি হয়েছে!
                        </h4>
                      </div>

                      <div className="p-3.5 rounded-xl bg-black/50 border border-amber-500/30 flex items-center justify-between gap-3">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            SUB ADMIN LICENSE KEY:
                          </span>
                          <span className="text-sm sm:text-base font-black font-mono text-amber-300 tracking-wider">
                            {createdLicense.key}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(createdLicense.key)}
                          className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md"
                        >
                          {copiedKey ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>কপি হয়েছে</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>কপি করুন</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                        <div className="p-2 rounded-lg bg-[#14202e]">
                          <span className="text-[10px] text-slate-400 block">Sub Admin:</span>
                          <span className="font-bold">{createdLicense.name}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-[#14202e]">
                          <span className="text-[10px] text-slate-400 block">মেয়াদ:</span>
                          <span className="font-bold text-amber-400">{createdLicense.planDays} দিন</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        💡 এই লাইসেন্স কি-টি কপি করে WhatsApp বা Telegram-এ আপনার Sub Admin ({createdLicense.name})-কে পাঠিয়ে দিন। সে অ্যাপ ওপেন করে Sub Admin License Key ঘরে এই কি প্রবেশ করালেই অ্যাপ সচল হবে।
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: MASTER SETTINGS & SECURITY */}
              {activeTab === 'settings' && (
                <div className="max-w-xl mx-auto space-y-4">
                  {/* Change Master Admin Key */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#111c2a] border border-[#1e2f44] space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-[#1c2c3e]">
                      <Key className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Master Admin Key পরিবর্তন করুন
                      </h4>
                    </div>

                    <form onSubmit={handleChangeMasterKey} className="space-y-3">
                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          বর্তমান মাস্টার কি (Current Key)
                        </label>
                        <input
                          type="password"
                          required
                          value={currentKeyInput}
                          onChange={(e) => setCurrentKeyInput(e.target.value)}
                          placeholder="বর্তমান কি দিন..."
                          className="w-full px-3.5 py-2 rounded-xl bg-[#162333] border border-[#25394f] text-xs text-white focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-300 mb-1">
                          নতুন মাস্টার কি (New Key - কমপক্ষে ৮ অক্ষর)
                        </label>
                        <input
                          type="text"
                          required
                          value={newKeyInput}
                          onChange={(e) => setNewKeyInput(e.target.value)}
                          placeholder="e.g. MASTER-NEW-XXXX-XXXX"
                          className="w-full px-3.5 py-2 rounded-xl bg-[#162333] border border-[#25394f] text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      {keyChangeMsg && (
                        <div
                          className={`p-2.5 rounded-lg text-xs font-medium ${
                            keyChangeMsg.success
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {keyChangeMsg.text}
                        </div>
                      )}

                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-xl bg-[#1c2d42] hover:bg-[#253c57] text-xs font-bold text-white transition-colors"
                      >
                        মাস্টার কি সংরক্ষণ করুন (Update Master Key)
                      </button>
                    </form>
                  </div>

                  {/* Security Architecture Summary */}
                  <div className="p-4 rounded-2xl bg-[#0f1722] border border-[#1b2737] space-y-2 text-xs text-slate-400 leading-relaxed">
                    <div className="flex items-center gap-2 text-amber-400 font-bold">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Master & Sub Admin Security Rules</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-[11px]">
                      <li>Sub Admin কখনোই Master Admin-এর কি বা কন্ট্রোল প্যানেল দেখতে পারবে না।</li>
                      <li>Sub Admin-এর লাইসেন্সের মেয়াদ (যেমন: ৩০ দিন) শেষ হওয়া মাত্রই অ্যাপ লক হয়ে যাবে।</li>
                      <li>Master Admin চাইলে যেকোনো সময় Sub Admin-কে তাৎক্ষণিক Disable বা Remove করতে পারে।</li>
                      <li>Master Key সার্ভার সাইডে সুরক্ষিতভাবে ভ্যালিডেট করা হয়।</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
