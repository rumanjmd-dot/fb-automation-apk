import React, { useState } from 'react';
import {
  ShieldAlert,
  Key,
  Copy,
  Check,
  Lock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Crown,
  UserCheck,
} from 'lucide-react';
import { LicenseStatus, LicenseValidationResult } from '../types';
import { activateLicenseRemote, getOrCreateDeviceId } from '../services/licenseService';

interface LicenseLockScreenProps {
  status: LicenseStatus;
  message?: string;
  clientName?: string;
  remainingDays?: number;
  onActivated: (result: LicenseValidationResult) => void;
  onOpenAdmin: () => void;
}

export const LicenseLockScreen: React.FC<LicenseLockScreenProps> = ({
  status,
  message,
  clientName,
  remainingDays,
  onActivated,
  onOpenAdmin,
}) => {
  const [activeTab, setActiveTab] = useState<'sub_admin' | 'master_admin'>('sub_admin');
  const [subAdminKey, setSubAdminKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [copiedDevice, setCopiedDevice] = useState(false);

  const deviceId = getOrCreateDeviceId();

  const handleCopyDeviceId = () => {
    navigator.clipboard.writeText(deviceId);
    setCopiedDevice(true);
    setTimeout(() => setCopiedDevice(false), 2000);
  };

  const handleSubAdminActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subAdminKey.trim()) {
      setErrorText('অনুগ্রহ করে আপনার সাব অ্যাডমিন লাইসেন্স কি প্রবেশ করান।');
      return;
    }

    setIsSubmitting(true);
    setErrorText('');
    setSuccessText('');

    try {
      const result = await activateLicenseRemote(subAdminKey.trim());
      if (result.valid || result.status === 'active') {
        setSuccessText(result.message || 'সাব অ্যাডমিন লাইসেন্স সফলভাবে অ্যাক্টিভ হয়েছে!');
        setTimeout(() => {
          onActivated(result);
        }, 800);
      } else {
        setErrorText(result.message || 'অবৈধ বা মেয়াদোত্তীর্ণ লাইসেন্স কি। মাস্টার অ্যাডমিনের সাথে যোগাযোগ করুন।');
      }
    } catch (err: any) {
      setErrorText('অ্যাক্টিভেশন সম্পন্ন করা যায়নি। ইন্টারনেট সংযোগ চেক করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'expired':
        return {
          title: 'মেয়াদ শেষ (License Expired)',
          desc: 'আপনার সাব অ্যাডমিন লাইসেন্সের মেয়াদ শেষ হয়ে গেছে। পুনরায় সচল করতে মাস্টার অ্যাডমিনের সাথে যোগাযোগ করুন।',
          icon: ShieldAlert,
          color: 'from-amber-500/20 to-rose-500/20 border-rose-500/40 text-rose-400',
        };
      case 'blocked':
        return {
          title: 'লাইসেন্স বন্ধ করা হয়েছে (License Disabled)',
          desc: 'মাস্টার অ্যাডমিন কর্তৃক আপনার লাইসেন্স বন্ধ বা বাতিল (Disabled) করা হয়েছে। অবিলম্বে মাস্টার অ্যাডমিনের সাথে যোগাযোগ করুন।',
          icon: Lock,
          color: 'from-rose-500/20 to-red-600/20 border-rose-500/50 text-rose-400',
        };
      case 'global_locked':
        return {
          title: 'অ্যাপ সাময়িক বন্ধ (Maintenance Mode)',
          desc: 'মাস্টার অ্যাডমিন সাময়িকভাবে সবার জন্য অ্যাপটি বন্ধ রেখেছেন। কিছুক্ষণের মধ্যে পুনরায় সচল হবে।',
          icon: AlertTriangle,
          color: 'from-amber-500/20 to-orange-500/20 border-amber-500/50 text-amber-400',
        };
      default:
        return {
          title: 'লাইসেন্স অ্যাক্টিভেশন প্রয়োজন',
          desc: 'অ্যাপে প্রবেশ করতে মাস্টার অ্যাডমিনের দেওয়া আপনার নির্দিষ্ট Sub Admin License Key প্রবেশ করান।',
          icon: ShieldCheck,
          color: 'from-sky-500/20 to-blue-600/20 border-sky-500/40 text-sky-400',
        };
    }
  };

  const badge = getStatusBadge();
  const IconComponent = badge.icon;

  return (
    <div className="min-h-screen bg-[#080d14] text-white flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
      {/* Background ambient glow */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* App Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20 mb-3 border border-sky-400/30">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-wider uppercase text-white">
            FB AUTOMATION
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            Admin License Authentication Gateway
          </p>
        </div>

        {/* Status Card (Only shown if there is an error/expired/blocked state) */}
        {status !== 'unactivated' && (
          <div className={`p-4 rounded-2xl bg-gradient-to-b ${badge.color} border mb-5 backdrop-blur-xs`}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-black/40 shrink-0">
                <IconComponent className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white tracking-wide">
                  {badge.title}
                </h2>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  {message || badge.desc}
                </p>
                {clientName && (
                  <div className="mt-1.5 text-[10px] font-mono text-sky-300 bg-black/30 px-2 py-0.5 rounded inline-block">
                    Sub Admin: {clientName}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* License Option Selector: Option 1 (Sub Admin) vs Option 2 (Master Admin) */}
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#0f1722] border border-[#1e2d40] mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('sub_admin')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'sub_admin'
                ? 'bg-sky-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Sub Admin</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('master_admin');
              onOpenAdmin();
            }}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'master_admin'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-amber-400'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Master Admin</span>
          </button>
        </div>

        {/* Option 1: Sub Admin Activation Box */}
        {activeTab === 'sub_admin' && (
          <div className="p-6 rounded-2xl bg-[#0f1722] border border-[#1d2b3d] shadow-xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#1b2737]">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Key className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Sub Admin License Key
                </h3>
                <p className="text-[11px] text-slate-400">
                  আপনার নির্দিষ্ট সাব অ্যাডমিন লাইসেন্স কি প্রবেশ করান
                </p>
              </div>
            </div>

            <form onSubmit={handleSubAdminActivate} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                  লাইসেন্স কি (License Key)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. SUB-30D-XXXX-XXXX"
                    value={subAdminKey}
                    onChange={(e) => setSubAdminKey(e.target.value.toUpperCase())}
                    disabled={isSubmitting}
                    className="w-full px-4 py-3 rounded-xl bg-[#162232] border border-[#25374e] text-white placeholder-slate-500 text-sm font-mono tracking-wider focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 uppercase transition-all"
                  />
                  <Key className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                </div>
              </div>

              {errorText && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorText}</span>
                </div>
              )}

              {successText && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successText}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 active:scale-[0.99] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 transition-all disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>যাচাই করা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <span>অ্যাপে প্রবেশ করুন (Activate Access)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Device ID for Admin Reference */}
            <div className="mt-5 pt-4 border-t border-[#1a2636]">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span>আপনার ডিভাইস আইডি (Device ID):</span>
                <button
                  type="button"
                  onClick={handleCopyDeviceId}
                  className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium transition-colors"
                >
                  {copiedDevice ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">কপি হয়েছে</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>কপি করুন</span>
                    </>
                  )}
                </button>
              </div>
              <div className="px-3 py-2 rounded-lg bg-[#141d2a] border border-[#202f43] font-mono text-[11px] text-slate-300 truncate">
                {deviceId}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                লাইসেন্স নিতে বা মেয়াদ বাড়াতে এই আইডিটি আপনার মাস্টার অ্যাডমিনকে পাঠান।
              </p>
            </div>
          </div>
        )}

        {/* Option 2: Master Admin Card */}
        {activeTab === 'master_admin' && (
          <div className="p-6 rounded-2xl bg-[#0f1722] border border-amber-500/30 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1b2737]">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Crown className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Master Admin Control Portal
                </h3>
                <p className="text-[11px] text-slate-400">
                  শুধুমাত্র মাস্টার অ্যাডমিনের প্রবেশাধিকার
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              মাস্টার অ্যাডমিন কন্ট্রোল প্যানেলে প্রবেশ করতে আপনার গোপন <span className="text-amber-400 font-bold">Master Admin Key</span> প্রবেশ করান। এখান থেকে নতুন সাব অ্যাডমিন তৈরি, মেয়াদ নির্ধারণ ও যেকোনো লাইসেন্স রিমুভ করা যাবে।
            </p>

            <button
              type="button"
              onClick={onOpenAdmin}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 active:scale-[0.99] text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
            >
              <Crown className="w-4 h-4" />
              <span>মাস্টার অ্যাডমিন লগইন (Open Portal)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
