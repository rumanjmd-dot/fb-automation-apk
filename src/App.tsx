/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SidebarDrawer } from './components/SidebarDrawer';
import { DashboardView } from './components/DashboardView';
import { AutomationView } from './components/AutomationView';
import { PagesView } from './components/PagesView';
import { TokensView } from './components/TokensView';
import { FacebookLoginModal } from './components/FacebookLoginModal';
import { ApkDownloadModal } from './components/ApkDownloadModal';
import { LicenseLockScreen } from './components/LicenseLockScreen';
import { AdminPanelModal } from './components/AdminPanelModal';
import { DEFAULT_PAGES } from './data/mockPages';
import { INITIAL_GEO_COUNTRIES } from './data/geoData';
import { FacebookPage, GeoCountry, MediaItem, UploadLogItem, UserProfile, LicenseValidationResult } from './types';
import { fetchFacebookUserProfile, fetchFacebookPages } from './services/facebookService';
import { getSavedLicenseKey, validateLicenseRemote, saveLicenseKey } from './services/licenseService';

export default function App() {
  const [activeView, setActiveView] = useState<'dashboard' | 'automation' | 'pages' | 'tokens' | 'management' | 'settings' | 'license' | 'editor'>('dashboard');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isFbLoginOpen, setIsFbLoginOpen] = useState(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // License & Subscription verification state
  const [licenseValidation, setLicenseValidation] = useState<LicenseValidationResult | null>(null);
  const [isCheckingLicense, setIsCheckingLicense] = useState(true);

  // Check and periodically validate subscription license key with server
  const checkLicenseStatus = async () => {
    const savedKey = getSavedLicenseKey();
    if (!savedKey) {
      setLicenseValidation({
        valid: false,
        status: 'unactivated',
        message: 'অ্যাপে প্রবেশ করতে মাস্টার অ্যাডমিনের দেওয়া Sub Admin License Key প্রবেশ করান।',
      });
      setIsCheckingLicense(false);
      return;
    }
    try {
      const result = await validateLicenseRemote(savedKey);
      setLicenseValidation(result);
    } catch (e) {
      // offline error handled inside validateLicenseRemote
    } finally {
      setIsCheckingLicense(false);
    }
  };

  useEffect(() => {
    checkLicenseStatus();
    // Validate every 45s so if Master Admin clicks "Disable" or subscription expires, app immediately logs out/locks
    const interval = setInterval(checkLicenseStatus, 45000);
    return () => clearInterval(interval);
  }, []);

  // User Profile loaded from localStorage so user never has to re-login on app exit
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('fb_user_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  // Facebook Pages loaded from localStorage
  const [pages, setPages] = useState<FacebookPage[]>(() => {
    try {
      const saved = localStorage.getItem('fb_pages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  // Media List (3-5 videos)
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);

  // Geo Targeting countries and states (preserves user state across app reboots!)
  const [geoCountries, setGeoCountries] = useState<GeoCountry[]>(() => {
    try {
      const saved = localStorage.getItem('fb_geo_countries');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return INITIAL_GEO_COUNTRIES;
  });

  // System Logs
  const [logs, setLogs] = useState<UploadLogItem[]>([]);

  // Operational metrics
  const [successfulOps, setSuccessfulOps] = useState(0);
  const [failedOps, setFailedOps] = useState(0);
  const [deletedOps, setDeletedOps] = useState(0);

  // Add Log helper
  const addLog = (text: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const timeStr = new Date().toTimeString().split(' ')[0];
    setLogs((prev) => [
      {
        id: `log-${Date.now()}-${Math.random()}`,
        timestamp: timeStr,
        text,
        type,
      },
      ...prev,
    ]);
  };

  // Toggle Page selection
  const handleTogglePage = (id: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isSelected: !p.isSelected } : p))
    );
  };

  const handleSelectAllPages = () => {
    setPages((prev) => prev.map((p) => ({ ...p, isSelected: true })));
    addLog('Selected all Facebook pages', 'info');
  };

  const handleClearPages = () => {
    setPages((prev) => prev.map((p) => ({ ...p, isSelected: false })));
    addLog('Deselected all Facebook pages', 'info');
  };

  // Sync User Profile to localStorage
  useEffect(() => {
    if (userProfile) {
      localStorage.setItem('fb_user_profile', JSON.stringify(userProfile));
    } else {
      localStorage.removeItem('fb_user_profile');
    }
  }, [userProfile]);

  // Sync Pages to localStorage
  useEffect(() => {
    if (pages.length > 0) {
      localStorage.setItem('fb_pages', JSON.stringify(pages));
    }
  }, [pages]);

  // Sync Geo Countries / States to localStorage so selected states stay saved permanently
  useEffect(() => {
    localStorage.setItem('fb_geo_countries', JSON.stringify(geoCountries));
  }, [geoCountries]);

  // Check saved token on mount and refresh session seamlessly
  useEffect(() => {
    const savedToken = localStorage.getItem('fb_user_token');
    if (savedToken) {
      fetchFacebookUserProfile(savedToken)
        .then((prof) => {
          setUserProfile(prof);
          return fetchFacebookPages(savedToken);
        })
        .then((fetchedPages) => {
          if (fetchedPages.length > 0) {
            setPages(fetchedPages);
          }
        })
        .catch((err) => {
          console.warn('Session refresh notice:', err.message);
        });
    }
  }, []);

  // If checking initial license state, display sleek loading splash
  if (isCheckingLicense) {
    return (
      <div className="min-h-screen bg-[#080d14] flex items-center justify-center text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">
            Verifying License Authorization...
          </p>
        </div>
      </div>
    );
  }

  // If license is invalid (unactivated, expired, blocked/kicked by admin, or global lock)
  if (!licenseValidation?.valid) {
    return (
      <>
        <LicenseLockScreen
          status={licenseValidation?.status || 'unactivated'}
          message={licenseValidation?.message}
          clientName={licenseValidation?.clientName}
          remainingDays={licenseValidation?.remainingDays}
          onActivated={(result) => setLicenseValidation(result)}
          onOpenAdmin={() => setIsAdminModalOpen(true)}
        />
        <AdminPanelModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
          onRefreshCurrentLicense={checkLicenseStatus}
        />
      </>
    );
  }

  return (
    <div
      className={`min-h-screen ${
        isDarkMode ? 'bg-[#0a0f17] text-slate-100' : 'bg-slate-100 text-slate-900'
      } font-sans antialiased selection:bg-sky-500 selection:text-black`}
    >
      {/* Top Header */}
      <Header
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onNavigate={(view) => setActiveView(view)}
        activeView={activeView}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode(!isDarkMode)}
        userProfile={userProfile}
        onOpenLoginModal={() => setIsFbLoginOpen(true)}
        onOpenApkModal={() => setIsApkModalOpen(true)}
        onOpenAdmin={() => setIsAdminModalOpen(true)}
        licenseInfo={licenseValidation}
      />

      {/* Slide-out Sidebar Drawer */}
      <SidebarDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        activeView={activeView}
        onSelectView={(view) => setActiveView(view)}
        userProfile={userProfile}
        onOpenFbLogin={() => setIsFbLoginOpen(true)}
        onOpenApkModal={() => setIsApkModalOpen(true)}
        onOpenAdmin={() => setIsAdminModalOpen(true)}
        pageCount={pages.length}
      />

      {/* Main Content Area */}
      <main className="p-3 sm:p-5 max-w-2xl mx-auto">
        {activeView === 'dashboard' && (
          <DashboardView
            pages={pages}
            mediaList={mediaList}
            logs={logs}
            userProfile={userProfile}
            onNavigate={(view) => setActiveView(view)}
            onOpenFbLogin={() => setIsFbLoginOpen(true)}
            onOpenApkModal={() => setIsApkModalOpen(true)}
            successfulOps={successfulOps}
            failedOps={failedOps}
            deletedOps={deletedOps}
          />
        )}

        {activeView === 'automation' && (
          <AutomationView
            pages={pages}
            onTogglePage={handleTogglePage}
            onSelectAllPages={handleSelectAllPages}
            onClearPages={handleClearPages}
            mediaList={mediaList}
            onUpdateMediaList={setMediaList}
            geoCountries={geoCountries}
            onUpdateGeoCountries={setGeoCountries}
            logs={logs}
            onAddLog={addLog}
            onIncrementSuccess={(c = 1) => setSuccessfulOps((prev) => prev + c)}
            onIncrementFailed={(c = 1) => setFailedOps((prev) => prev + c)}
            userProfile={userProfile}
            onOpenLoginModal={() => setIsFbLoginOpen(true)}
            onUpdatePages={setPages}
          />
        )}

        {activeView === 'pages' && (
          <PagesView
            pages={pages}
            onTogglePage={handleTogglePage}
            onNavigateToAutomation={() => setActiveView('automation')}
            onOpenFbLogin={() => setIsFbLoginOpen(true)}
          />
        )}

        {activeView === 'tokens' && (
          <TokensView
            userProfile={userProfile}
            onOpenFbLogin={() => setIsFbLoginOpen(true)}
            pages={pages}
          />
        )}

        {/* Dedicated License Details View */}
        {activeView === 'license' && (
          <div className="p-5 sm:p-6 rounded-2xl bg-[#121c2a] border border-[#213247] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">
                  Sub Admin লাইসেন্স ও মেয়াদ স্ট্যাটাস
                </h3>
                <p className="text-xs text-slate-400">
                  আপনার সক্রিয় সাব অ্যাডমিন অ্যাকাউন্ট এবং মেয়াদের তথ্য
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-xs font-bold">
                🟢 সক্রিয় (Active)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-[#172435] border border-[#263c56]">
                <span className="text-[11px] text-slate-400 block">Sub Admin-এর নাম:</span>
                <span className="text-sm font-bold text-white">
                  {licenseValidation?.name || licenseValidation?.clientName || 'Sub Admin'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#172435] border border-[#263c56]">
                <span className="text-[11px] text-slate-400 block">অবশিষ্ট মেয়াদ:</span>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {licenseValidation?.remainingDays && licenseValidation.remainingDays > 9000
                    ? 'লাইফটাইম (Lifetime)'
                    : `${licenseValidation?.remainingDays ?? 0} দিন বাকি`}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#172435] border border-[#263c56]">
                <span className="text-[11px] text-slate-400 block">মেয়াদ শেষ হওয়ার তারিখ:</span>
                <span className="text-xs font-mono text-slate-300">
                  {licenseValidation?.expiresAt
                    ? new Date(licenseValidation.expiresAt).toLocaleDateString()
                    : 'N/A'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#172435] border border-[#263c56]">
                <span className="text-[11px] text-slate-400 block">Sub Admin License Key:</span>
                <span className="text-xs font-mono text-amber-400">
                  {getSavedLicenseKey()}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#1e2f44] flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => {
                  if (window.confirm('আপনি কি বর্তমান সাব অ্যাডমিন লাইসেন্স পরিবর্তন করতে চান?')) {
                    saveLicenseKey('');
                    setLicenseValidation(null);
                    checkLicenseStatus();
                  }
                }}
                className="px-3 py-2 rounded-xl bg-[#1c2a3d] hover:bg-[#253952] text-xs font-semibold text-slate-300 transition-colors"
              >
                লাইসেন্স পরিবর্তন করুন (Change Key)
              </button>

              <button
                onClick={() => setIsAdminModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-bold text-xs shadow-md transition-colors"
              >
                Master Admin Portal 👑
              </button>
            </div>
          </div>
        )}

        {/* Other views placeholder */}
        {['management', 'settings', 'editor'].includes(activeView) && (
          <div className="p-6 rounded-2xl bg-[#141e2b] border border-[#202f43] text-center space-y-3">
            <h3 className="text-lg font-bold uppercase text-white tracking-wider">
              {activeView} MODULE
            </h3>
            <p className="text-xs text-slate-400">
              This module is active under your current License plan.
            </p>
            <button
              onClick={() => setActiveView('automation')}
              className="px-4 py-2 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs hover:bg-sky-400"
            >
              Go to Automation
            </button>
          </div>
        )}
      </main>

      {/* Facebook Login / Token Connection Modal */}
      <FacebookLoginModal
        isOpen={isFbLoginOpen}
        onClose={() => setIsFbLoginOpen(false)}
        userProfile={userProfile}
        onUpdateProfile={setUserProfile}
        onUpdatePages={setPages}
        onAddLog={addLog}
      />

      {/* Android APK Download & Installation Modal */}
      <ApkDownloadModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
      />

      {/* Master Admin Panel Modal */}
      <AdminPanelModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onRefreshCurrentLicense={checkLicenseStatus}
      />
    </div>
  );
}
