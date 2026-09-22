import React, { useState } from 'react';
import { AuthUser, UserRole } from '../types';
import { login, register, requestPasswordReset } from '../services/auth';

interface AuthScreenProps {
  onLoginSuccess: (user: AuthUser) => void;
  showToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLoginSuccess,
  showToast,
  isDarkMode = true,
  onToggleTheme,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [role, setRole] = useState<UserRole>('patient');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (authMode === 'register') {
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please verify your password.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (authMode === 'login') {
        const res = await login(email, password);
        if (res.success && res.user) {
          showToast('Welcome back!', `Logged in as ${res.user.profile.firstName}`);
          onLoginSuccess(res.user);
        } else {
          setErrorMessage(res.error || 'Email or password is incorrect.');
        }
      } else if (authMode === 'register') {
        const res = await register(email, password, firstName, lastName, role, phoneNumber);
        if (res.success && res.user) {
          showToast('Account Created!', `Welcome to DoseEase, ${res.user.profile.firstName}`);
          onLoginSuccess(res.user);
        } else {
          setErrorMessage(res.error || 'Failed to create account.');
        }
      } else if (authMode === 'forgot') {
        const res = await requestPasswordReset(email);
        showToast('Password Reset', res.message);
        setAuthMode('login');
      }
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-center items-center p-4 sm:p-6 relative z-10 font-serif transition-colors duration-200 ${
        isDarkMode ? 'theme-canvas-dark text-white' : 'theme-canvas-light text-slate-900'
      }`}
    >
      {/* Theme toggle button in top-right */}
      {onToggleTheme && (
        <div className="absolute top-4 right-4 z-20">
          <button
            type="button"
            onClick={onToggleTheme}
            className={`p-2.5 rounded-2xl border transition-all flex items-center gap-1.5 text-xs font-bold ${
              isDarkMode
                ? 'bg-slate-900/80 border-slate-700 text-amber-300 hover:bg-slate-800'
                : 'bg-white/90 border-indigo-200 text-indigo-900 hover:bg-indigo-50 shadow-sm'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {isDarkMode ? 'light_mode' : 'dark_mode'}
            </span>
            <span>{isDarkMode ? 'Pastel Light' : 'Deep Dark'}</span>
          </button>
        </div>
      )}

      <div className="w-full max-w-lg">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 border border-indigo-400/40 text-amber-300 shadow-2xl shadow-indigo-950/30 mb-3">
            <span className="material-symbols-outlined text-[36px]">medication</span>
          </div>
          <h1 className={`text-3xl sm:text-4xl font-bold tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            DoseEase
          </h1>
          <p className={`text-xs sm:text-sm mt-1 uppercase tracking-widest italic ${isDarkMode ? 'text-indigo-200/80' : 'text-indigo-700 font-semibold'}`}>
            Clinical Prescription &amp; Refill System
          </p>
        </div>

        {/* Auth Card */}
        <div className={`rounded-3xl p-6 sm:p-8 border shadow-2xl ${
          isDarkMode
            ? 'bg-slate-900/90 backdrop-blur-xl border-slate-700/80 shadow-[0_10px_40px_rgba(0,0,0,0.8)]'
            : 'bg-white/90 backdrop-blur-xl border-indigo-100 shadow-2xl shadow-indigo-100/60'
        }`}>
          {/* Mode Switcher */}
          {authMode !== 'forgot' && (
            <div className={`grid grid-cols-2 p-1.5 rounded-2xl mb-6 border ${
              isDarkMode ? 'bg-slate-900/80 border-slate-700/60' : 'bg-indigo-50/70 border-indigo-100'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage(null);
                }}
                className={`py-3 rounded-xl font-bold text-sm sm:text-base transition-all ${
                  authMode === 'login'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setErrorMessage(null);
                }}
                className={`py-3 rounded-xl font-bold text-sm sm:text-base transition-all ${
                  authMode === 'register'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {authMode === 'forgot' && (
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Reset Your Password</h2>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>We will send a reset instruction link</p>
              </div>
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
              >
                Back to Login
              </button>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 text-sm font-semibold flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] shrink-0">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {authMode === 'register' && (
              <>
                {/* Role Selection */}
                <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    I am using DoseEase as:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('patient')}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                        role === 'patient'
                          ? 'border-indigo-500 bg-indigo-600/20 text-white'
                          : isDarkMode
                          ? 'border-slate-700 bg-slate-900/60 text-slate-400 hover:text-white'
                          : 'border-indigo-100 bg-indigo-50/40 text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[24px] text-indigo-500">elderly</span>
                      <div>
                        <span className={`font-bold block text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Patient</span>
                        <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Taking medicines</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('caregiver')}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                        role === 'caregiver'
                          ? 'border-indigo-500 bg-indigo-600/20 text-white'
                          : isDarkMode
                          ? 'border-slate-700 bg-slate-900/60 text-slate-400 hover:text-white'
                          : 'border-indigo-100 bg-indigo-50/40 text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[24px] text-indigo-500">family_restroom</span>
                      <div>
                        <span className={`font-bold block text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Caregiver</span>
                        <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Family or nurse</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* First and Last Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={`w-full px-4 py-3.5 rounded-2xl border text-base focus:border-indigo-500 outline-none font-medium ${
                        isDarkMode
                          ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                          : 'bg-indigo-50/50 border-indigo-200 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      Last Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Sharma"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={`w-full px-4 py-3.5 rounded-2xl border text-base focus:border-indigo-500 outline-none font-medium ${
                        isDarkMode
                          ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                          : 'bg-indigo-50/50 border-indigo-200 text-slate-900 placeholder-slate-400'
                      }`}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-4 py-3.5 rounded-2xl border text-base focus:border-indigo-500 outline-none font-medium ${
                  isDarkMode
                    ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-indigo-50/50 border-indigo-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            {/* Password (for login and register) */}
            {authMode !== 'forgot' && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className={`block text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    Password *
                  </label>
                  {authMode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setAuthMode('forgot')}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full px-4 py-3.5 rounded-2xl border text-base focus:border-indigo-500 outline-none font-medium ${
                    isDarkMode
                      ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-indigo-50/50 border-indigo-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            )}

            {/* Confirm Password (Registration only) */}
            {authMode === 'register' && (
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Confirm Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-4 py-3.5 rounded-2xl border text-base focus:border-indigo-500 outline-none font-medium ${
                    isDarkMode
                      ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-indigo-50/50 border-indigo-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            )}

            {/* Optional Phone Number on register */}
            {authMode === 'register' && (
              <div>
                <label className={`block text-xs font-bold uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className={`w-full px-4 py-3.5 rounded-2xl border text-base focus:border-indigo-500 outline-none font-medium ${
                    isDarkMode
                      ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                      : 'bg-indigo-50/50 border-indigo-200 text-slate-900 placeholder-slate-400'
                  }`}
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full min-h-[52px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base sm:text-lg shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : authMode === 'login' ? (
                <>
                  <span className="material-symbols-outlined text-[22px]">login</span>
                  <span>Log In to DoseEase</span>
                </>
              ) : authMode === 'register' ? (
                <>
                  <span className="material-symbols-outlined text-[22px]">person_add</span>
                  <span>Create My Account</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[22px]">mail</span>
                  <span>Send Reset Instructions</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
