import React, { useState, useEffect } from 'react';
import { NavTab, AuthUser, ToastMessage } from './types';
import { initAuth, logout } from './services/auth';
import { getSyncQueue, syncLocalQueueAndFetchLatest } from './services/storage';
import { AuthScreen } from './components/AuthScreen';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { MedicinesScreen } from './components/MedicinesScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { CaregiverScreen } from './components/CaregiverScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { Toast } from './components/Toast';
import { PullToRefreshContainer } from './components/PullToRefreshContainer';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('doseease_theme');
    return saved === 'dark';
  });
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [isSeniorMode, setIsSeniorMode] = useState<boolean>(() => {
    return localStorage.getItem('doseease_senior_mode') === 'true';
  });

  // Initialize Auth & Storage
  useEffect(() => {
    async function loadAuth() {
      try {
        const user = await initAuth();
        setCurrentUser(user);
        setPendingSyncCount(getSyncQueue().length);

        // Check if user clicked a caregiver invite link
        const params = new URLSearchParams(window.location.search);
        if (params.get('caregiver_invite') || params.get('invite_token')) {
          setActiveTab('caregiver');
        }
      } finally {
        setIsInitializing(false);
      }
    }
    loadAuth();
  }, []);

  // Online / Offline tracking
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Back Online', 'Local changes are synced.', 'success');
      setPendingSyncCount(getSyncQueue().length);
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('Offline Mode', 'DoseEase continues to work offline safely.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Dark mode effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.body.className = 'theme-executive theme-canvas-dark min-h-screen antialiased selection:bg-amber-600 selection:text-white';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.className = 'theme-executive theme-canvas-light min-h-screen antialiased selection:bg-indigo-300 selection:text-indigo-950';
    }
    localStorage.setItem('doseease_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Senior Vision & Large Text Mode effect
  useEffect(() => {
    if (isSeniorMode) {
      document.documentElement.classList.add('senior-mode');
    } else {
      document.documentElement.classList.remove('senior-mode');
    }
    localStorage.setItem('doseease_senior_mode', String(isSeniorMode));
  }, [isSeniorMode]);

  // Toast helper
  const showToast = (
    title: string,
    description?: string,
    type: 'success' | 'info' | 'warning' | 'error' = 'success'
  ) => {
    setToast({
      id: `toast-${Date.now()}`,
      title,
      description,
      type,
    });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setActiveTab('home');
    showToast('Logged Out', 'You have been safely signed out.', 'info');
  };

  const handlePullToRefresh = async (): Promise<void> => {
    if (!currentUser) return;
    try {
      const res = await syncLocalQueueAndFetchLatest(currentUser.uid);
      setPendingSyncCount(getSyncQueue().length);
      // Trigger a refresh of the current view
      setRefreshTrigger((prev) => prev + 1);

      if (res.syncedCount > 0) {
        showToast('Sync Queue Updated', res.message, 'success');
      } else if (res.success) {
        showToast('Refreshed & Synced', 'Local queue and records are up to date.', 'success');
      } else {
        showToast('Refreshed (Offline)', res.message, 'info');
      }
    } catch {
      setRefreshTrigger((prev) => prev + 1);
      showToast('View Refreshed', 'Refreshed with cached local records.', 'info');
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen theme-canvas-dark flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-700 via-blue-900 to-slate-950 border border-indigo-400/40 flex items-center justify-center text-amber-300 shadow-2xl shadow-indigo-950/80 animate-pulse mb-3">
          <span className="material-symbols-outlined text-[34px]">medication</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-wide">DoseEase</h2>
        <p className="text-xs text-indigo-200/70 mt-1 uppercase tracking-widest italic">Clinical Prescription System</p>
      </div>
    );
  }

  // If not logged in, show Auth Screen (Zero data leak)
  if (!currentUser) {
    return (
      <>
        <AuthScreen
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            setActiveTab('home');
          }}
          showToast={showToast}
          isDarkMode={isDarkMode}
          onToggleTheme={() => setIsDarkMode((prev) => !prev)}
        />
        <Toast toast={toast} onDismiss={() => setToast(null)} isDarkMode={isDarkMode} />
      </>
    );
  }

  return (
    <div
      className={`min-h-screen min-h-[100dvh] w-full flex flex-col transition-colors duration-200 overflow-x-hidden ${
        isDarkMode ? 'theme-canvas-dark text-slate-100' : 'theme-canvas-light text-slate-900'
      }`}
    >
      {/* Top App Header */}
      <Header
        currentUser={currentUser}
        isOnline={isOnline}
        onOpenProfile={() => setActiveTab('profile')}
        pendingSyncCount={pendingSyncCount}
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode((prev) => !prev)}
        onTriggerRefresh={handlePullToRefresh}
      />

      {/* Main View Container: responsive max-width to fit ratio on phone, tablet, and desktop + generous clearance for fixed BottomNav */}
      <main className="flex-1 w-full max-w-3xl lg:max-w-4xl mx-auto px-3.5 sm:px-6 pt-4 pb-32 sm:pb-36 relative z-10">
        <PullToRefreshContainer
          onRefresh={handlePullToRefresh}
          isDarkMode={isDarkMode}
          pendingSyncCount={pendingSyncCount}
        >
          {activeTab === 'home' && (
            <HomeScreen
              key={`home-${refreshTrigger}`}
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              onNavigateTab={setActiveTab}
              showToast={showToast}
              onUpdateUser={(updated) => setCurrentUser(updated)}
            />
          )}

          {activeTab === 'medicines' && (
            <MedicinesScreen
              key={`medicines-${refreshTrigger}`}
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              showToast={showToast}
              onUpdateUser={(updated) => setCurrentUser(updated)}
            />
          )}

          {activeTab === 'history' && (
            <HistoryScreen
              key={`history-${refreshTrigger}`}
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              showToast={showToast}
            />
          )}

          {activeTab === 'caregiver' && (
            <CaregiverScreen
              key={`caregiver-${refreshTrigger}`}
              currentUser={currentUser}
              isDarkMode={isDarkMode}
              showToast={showToast}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileScreen
              key={`profile-${refreshTrigger}`}
              currentUser={currentUser}
              onLogout={handleLogout}
              onUserUpdated={(updated) => setCurrentUser(updated)}
              isDarkMode={isDarkMode}
              setIsDarkMode={setIsDarkMode}
              isSeniorMode={isSeniorMode}
              setIsSeniorMode={setIsSeniorMode}
              showToast={showToast}
            />
          )}
        </PullToRefreshContainer>
      </main>

      {/* Bottom Accessible Navigation */}
      <BottomNav
        currentTab={activeTab}
        onSelectTab={setActiveTab}
        isCaregiverRole={currentUser.profile.role === 'caregiver'}
        isDarkMode={isDarkMode}
      />

      {/* Floating System Toast */}
      <Toast toast={toast} onDismiss={() => setToast(null)} isDarkMode={isDarkMode} />
    </div>
  );
};

export default App;
