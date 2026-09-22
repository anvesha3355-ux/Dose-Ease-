import React, { useState, useRef, useEffect, useCallback } from 'react';

interface PullToRefreshContainerProps {
  onRefresh: () => Promise<void>;
  isDarkMode: boolean;
  children: React.ReactNode;
  className?: string;
  pendingSyncCount?: number;
  disabled?: boolean;
}

const PULL_THRESHOLD = 68;
const MAX_PULL = 96;

export const PullToRefreshContainer: React.FC<PullToRefreshContainerProps> = ({
  onRefresh,
  isDarkMode,
  children,
  className = '',
  pendingSyncCount = 0,
  disabled = false,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasVibratedRef = useRef(false);

  const isScrolledToTop = useCallback(() => {
    if (typeof window === 'undefined') return true;
    const windowScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    const containerScrollTop = containerRef.current ? containerRef.current.scrollTop : 0;
    return windowScrollTop <= 2 && containerScrollTop <= 2;
  }, []);

  const triggerRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPullDistance(54); // Hold indicator comfortably in view
    try {
      await onRefresh();
      setRefreshSuccess(true);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(20);
      }
      // Show success feedback briefly
      await new Promise((res) => setTimeout(res, 500));
    } catch {
      // Refresh error handled gracefully
    } finally {
      setRefreshSuccess(false);
      setIsRefreshing(false);
      setPullDistance(0);
      setIsPulling(false);
      hasVibratedRef.current = false;
    }
  }, [onRefresh]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || isRefreshing) return;
    if (isScrolledToTop()) {
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      isDraggingRef.current = true;
      hasVibratedRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || isRefreshing || disabled) return;

    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - startYRef.current;
    const deltaX = Math.abs(currentX - startXRef.current);

    // If moving horizontally more than vertically, do not pull
    if (deltaX > deltaY) {
      return;
    }

    if (deltaY > 0 && isScrolledToTop()) {
      setIsPulling(true);
      // Damped spring resistance calculation
      const damped = Math.min(MAX_PULL, deltaY * 0.44);
      setPullDistance(damped);

      // Trigger haptic vibration once when threshold is reached
      if (damped >= PULL_THRESHOLD && !hasVibratedRef.current) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(15);
        }
        hasVibratedRef.current = true;
      }
    } else {
      setPullDistance(0);
      setIsPulling(false);
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current || isRefreshing) return;
    isDraggingRef.current = false;

    if (pullDistance >= PULL_THRESHOLD) {
      triggerRefresh();
    } else {
      setIsPulling(false);
      setPullDistance(0);
      hasVibratedRef.current = false;
    }
  };

  // Mouse drag handlers for desktop emulators & responsive preview testing
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || isRefreshing) return;
    // Only primary left click
    if (e.button !== 0) return;
    if (isScrolledToTop()) {
      startYRef.current = e.clientY;
      startXRef.current = e.clientX;
      isDraggingRef.current = true;
      hasVibratedRef.current = false;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || isRefreshing || disabled) return;
    const deltaY = e.clientY - startYRef.current;
    const deltaX = Math.abs(e.clientX - startXRef.current);

    if (deltaX > deltaY) return;

    if (deltaY > 0 && isScrolledToTop()) {
      setIsPulling(true);
      const damped = Math.min(MAX_PULL, deltaY * 0.44);
      setPullDistance(damped);

      if (damped >= PULL_THRESHOLD && !hasVibratedRef.current) {
        hasVibratedRef.current = true;
      }
    }
  };

  const handleMouseUp = () => {
    if (!isDraggingRef.current || isRefreshing) return;
    isDraggingRef.current = false;

    if (pullDistance >= PULL_THRESHOLD) {
      triggerRefresh();
    } else {
      setIsPulling(false);
      setPullDistance(0);
      hasVibratedRef.current = false;
    }
  };

  // Reset if window scrolls away
  useEffect(() => {
    const handleScroll = () => {
      if (!isRefreshing && isPulling && !isScrolledToTop()) {
        isDraggingRef.current = false;
        setIsPulling(false);
        setPullDistance(0);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isRefreshing, isPulling, isScrolledToTop]);

  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);
  const isPastThreshold = pullDistance >= PULL_THRESHOLD;

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`relative w-full overscroll-y-contain ${className}`}
    >
      {/* Pull To Refresh Indicator Banner / Floating Pill */}
      <div
        aria-hidden={!isPulling && !isRefreshing}
        style={{
          transform: `translateY(${pullDistance > 0 ? pullDistance - 44 : -50}px)`,
          opacity: pullDistance > 8 || isRefreshing ? 1 : 0,
        }}
        className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-center pointer-events-none transition-transform duration-100 ease-out select-none ${
          !isPulling && !isRefreshing ? 'transition-all duration-300' : ''
        }`}
      >
        <div
          className={`flex items-center gap-2.5 px-4 py-2 rounded-full border shadow-lg backdrop-blur-md font-serif text-xs transition-colors duration-200 ${
            isDarkMode
              ? 'bg-slate-900/95 border-indigo-500/40 text-slate-100 shadow-[0_6px_25px_rgba(0,0,0,0.6)]'
              : 'bg-white/95 border-indigo-200 text-slate-800 shadow-[0_6px_25px_rgba(99,102,241,0.2)]'
          }`}
        >
          {isRefreshing ? (
            <>
              <span className="material-symbols-outlined text-[18px] text-indigo-500 animate-spin">
                sync
              </span>
              <span className="font-bold">Syncing data queue &amp; refreshing view...</span>
            </>
          ) : refreshSuccess ? (
            <>
              <span className="material-symbols-outlined text-[18px] text-emerald-500">
                check_circle
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                Sync complete &amp; view updated!
              </span>
            </>
          ) : isPastThreshold ? (
            <>
              <span className="material-symbols-outlined text-[18px] text-indigo-500 rotate-180 transition-transform duration-200">
                arrow_downward
              </span>
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                Release to sync &amp; refresh
              </span>
            </>
          ) : (
            <>
              <span
                className="material-symbols-outlined text-[18px] text-slate-400 dark:text-slate-300 transition-transform"
                style={{
                  transform: `rotate(${progress * 180}deg)`,
                }}
              >
                arrow_downward
              </span>
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Pull down to sync &amp; refresh
              </span>
              {pendingSyncCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  {pendingSyncCount} queued
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Content Shift on Pull */}
      <div
        style={{
          transform: `translateY(${isPulling || isRefreshing ? pullDistance * 0.72 : 0}px)`,
        }}
        className={`w-full transition-transform duration-150 ease-out ${
          !isPulling && !isRefreshing ? 'transition-all duration-300' : ''
        }`}
      >
        {children}
      </div>
    </div>
  );
};
