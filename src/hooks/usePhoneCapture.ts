import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'andiamo_phone_submitted';
const STORAGE_KEY_DISMISSED = 'andiamo_phone_dismissed';
const STORAGE_KEY_SHOWN = 'andiamo_phone_popup_shown';
const DISMISSAL_DURATION = 4 * 24 * 60 * 60 * 1000; // 4 days in milliseconds

/**
 * Hook to manage phone capture popup visibility
 * 
 * Rules:
 * - Show popup only if phone number is unknown
 * - Show once per visitor session (tracked in sessionStorage)
 * - If dismissed → hide for 4 days (tracked in localStorage)
 * - If submitted → never show again (tracked in localStorage)
 * - Trigger conditions:
 *   1. Visitor stays on site for 10-20 seconds (random)
 *   2. Visitor scrolls 50% or more of the page
 * - Don't show on: admin login/dashboard, ambassador application/login/dashboard, contact page
 * - Show on all other pages
 */
export const usePhoneCapture = (pathname: string) => {
  const [shouldShow, setShouldShow] = useState(false);
  const hasTriggeredRef = useRef(false);
  const timeTriggerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Reset trigger state when pathname changes
    hasTriggeredRef.current = false;
    setShouldShow(false);

    // Clear any existing timers/handlers
    if (timeTriggerRef.current) {
      clearTimeout(timeTriggerRef.current);
      timeTriggerRef.current = null;
    }
    if (scrollHandlerRef.current) {
      window.removeEventListener('scroll', scrollHandlerRef.current);
      scrollHandlerRef.current = null;
    }

    // Don't show on excluded pages
    const excludedPaths = [
      '/admin/login',
      '/admin',
      '/ambassador',
      '/ambassador/auth',
      '/ambassador/dashboard',
      '/contact'
    ];
    
    const isExcluded = excludedPaths.some(path => {
      if (path === '/admin' || path === '/ambassador') {
        return pathname.startsWith(path);
      }
      return pathname === path;
    });

    if (isExcluded) {
      return;
    }

    // Check if phone number has been submitted (never show again)
    const isSubmitted = localStorage.getItem(STORAGE_KEY) === 'true';
    if (isSubmitted) {
      return;
    }

    // Check if dismissed recently (hide for 4 days)
    const dismissedAt = localStorage.getItem(STORAGE_KEY_DISMISSED);
    if (dismissedAt) {
      try {
        const dismissedTime = parseInt(dismissedAt, 10);
        if (!isNaN(dismissedTime)) {
          const now = Date.now();
          const timeSinceDismissal = now - dismissedTime;

          // If dismissed less than 4 days ago, don't show
          if (timeSinceDismissal < DISMISSAL_DURATION) {
            return;
          }
        }
      } catch (e) {
        // Invalid timestamp, clear it
        localStorage.removeItem(STORAGE_KEY_DISMISSED);
      }
    }

    // Check if popup has already been shown in this session
    const hasBeenShown = sessionStorage.getItem(STORAGE_KEY_SHOWN) === 'true';
    if (hasBeenShown) {
      return;
    }

    // Function to trigger popup (only once)
    const triggerPopup = () => {
      if (!hasTriggeredRef.current) {
        hasTriggeredRef.current = true;
        sessionStorage.setItem(STORAGE_KEY_SHOWN, 'true');
        setShouldShow(true);
        
        // Clean up
        if (timeTriggerRef.current) {
          clearTimeout(timeTriggerRef.current);
          timeTriggerRef.current = null;
        }
        if (scrollHandlerRef.current) {
          window.removeEventListener('scroll', scrollHandlerRef.current);
          scrollHandlerRef.current = null;
        }
      }
    };

    // Trigger 1: Time-based (10-20 seconds random)
    const randomDelay = Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000; // 10-20 seconds
    timeTriggerRef.current = setTimeout(() => {
      triggerPopup();
    }, randomDelay);

    // Trigger 2: Scroll-based (50% or more)
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollPercentage = (scrollTop / scrollHeight) * 100;

      if (scrollPercentage >= 50) {
        triggerPopup();
      }
    };

    scrollHandlerRef.current = handleScroll;
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup
    return () => {
      if (timeTriggerRef.current) {
        clearTimeout(timeTriggerRef.current);
      }
      if (scrollHandlerRef.current) {
        window.removeEventListener('scroll', scrollHandlerRef.current);
      }
    };
  }, [pathname]);

  return shouldShow;
};

