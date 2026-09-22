import React from 'react';
import { NavTab } from '../types';

interface BottomNavProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isCaregiverRole: boolean;
  isDarkMode: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onSelectTab,
  isCaregiverRole,
  isDarkMode,
}) => {
  const tabs: { id: NavTab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'medicines', label: 'Medicines', icon: 'medication' },
    { id: 'history', label: 'History', icon: 'history' },
    { id: 'caregiver', label: isCaregiverRole ? 'Patients' : 'Caregiver', icon: 'family_restroom' },
    { id: 'profile', label: 'Profile', icon: 'person' },
  ];

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 transition-colors duration-200 safe-area-bottom ${
        isDarkMode
          ? 'bg-[#070d1a]/95 backdrop-blur-xl border-t border-indigo-950/90 shadow-2xl shadow-black'
          : 'bg-white/90 backdrop-blur-xl border-t border-indigo-100/90 shadow-xl shadow-indigo-100/50'
      }`}
    >
      <div className="max-w-3xl lg:max-w-4xl mx-auto flex items-center justify-around px-2 py-2">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center min-h-[52px] flex-1 py-1 rounded-2xl transition-all font-serif ${
                isActive
                  ? isDarkMode
                    ? 'text-amber-300 font-bold scale-105'
                    : 'text-indigo-800 font-bold scale-105'
                  : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div
                className={`w-11 h-7 rounded-xl flex items-center justify-center transition-all ${
                  isActive
                    ? isDarkMode
                      ? 'bg-gradient-to-r from-amber-500/20 via-indigo-600/20 to-blue-900/30 border border-amber-500/40 text-amber-300 shadow-sm'
                      : 'bg-indigo-100/80 border border-indigo-200 text-indigo-700 shadow-sm'
                    : ''
                }`}
              >
                <span className="material-symbols-outlined text-[23px]">{tab.icon}</span>
              </div>
              <span className="text-[12px] sm:text-[13px] mt-0.5 tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
