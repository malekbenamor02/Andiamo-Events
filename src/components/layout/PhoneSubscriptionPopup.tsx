import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { X, Phone, CheckCircle2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface PhoneSubscriptionPopupProps {
  language: 'en' | 'fr';
}

// Storage keys
const STORAGE_KEY_SUBSCRIBED = 'phone_subscription_subscribed';
const STORAGE_KEY_DISMISSED = 'phone_subscription_dismissed';
const STORAGE_KEY_DISMISSAL_TYPE = 'phone_subscription_dismissal_type';

// Pages where popup CAN show (intent-based only)
const ALLOWED_PATHS = ['/', '/events'];

// Pages where popup should NEVER show
const EXCLUDED_PATHS = [
  '/admin',
  '/admin/login',
  '/ambassador/auth',
  '/ambassador/dashboard',
  '/contact',
  '/about',
  '/ambassador',
  '/pass-purchase',
];

// Dismissal types
const DISMISSAL_TYPES = {
  CLOSED: 'closed', // 7 days
  LATER: 'later', // 3 days
  SUBSCRIBED: 'subscribed', // Never
} as const;

const PhoneSubscriptionPopup = ({ language }: PhoneSubscriptionPopupProps) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [scrollPercentage, setScrollPercentage] = useState(0);
  
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const exitIntentTriggeredRef = useRef(false);
  const hasCheckedStorageRef = useRef(false);

  // Check if user is subscribed (never show again)
  const isSubscribed = () => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY_SUBSCRIBED) === 'true';
  };

  // Check if popup was dismissed and if cooldown period has passed
  const canShowAfterDismissal = () => {
    if (typeof window === 'undefined') return true;
    
    const dismissedAt = localStorage.getItem(STORAGE_KEY_DISMISSED);
    const dismissalType = localStorage.getItem(STORAGE_KEY_DISMISSAL_TYPE);
    
    if (!dismissedAt || !dismissalType) return true;
    
    const dismissedTime = parseInt(dismissedAt, 10);
    const now = Date.now();
    const daysSinceDismissal = (now - dismissedTime) / (1000 * 60 * 60 * 24);
    
    // If subscribed, never show again
    if (dismissalType === DISMISSAL_TYPES.SUBSCRIBED) return false;
    
    // If closed (X button), hide for 7 days
    if (dismissalType === DISMISSAL_TYPES.CLOSED && daysSinceDismissal < 7) return false;
    
    // If "Later" button, hide for 3 days
    if (dismissalType === DISMISSAL_TYPES.LATER && daysSinceDismissal < 3) return false;
    
    return true;
  };

  // Check if current path allows popup
  const isAllowedPath = () => {
    const path = location.pathname;
    
    // Never show on excluded paths
    if (EXCLUDED_PATHS.some(excluded => path.startsWith(excluded))) {
      return false;
    }
    
    // Show on home page, events page, or event detail pages (check if it's /events or starts with /events/)
    if (path === '/' || path === '/events' || path.startsWith('/events/')) {
      return true;
    }
    
    return false;
  };

  // Calculate scroll percentage
  const calculateScrollPercentage = useCallback(() => {
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollableHeight = documentHeight - windowHeight;
    const percentage = scrollableHeight > 0 ? (scrollTop / scrollableHeight) * 100 : 0;
    return Math.min(100, Math.max(0, percentage));
  }, []);

  // Handle scroll tracking
  useEffect(() => {
    if (!isAllowedPath() || isSubscribed() || !canShowAfterDismissal()) return;

    const handleScroll = () => {
      const percentage = calculateScrollPercentage();
      setScrollPercentage(percentage);
      
      if (percentage >= 40 && !hasScrolled) {
        setHasScrolled(true);
        // If delay has passed and user scrolled 40%, show popup immediately
        if (hasCheckedStorageRef.current && !isVisible) {
          setIsVisible(true);
        }
      }
    };

    // Initial check
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasScrolled, calculateScrollPercentage, isVisible]);

  // Exit intent detection for desktop
  useEffect(() => {
    if (isMobile || !isAllowedPath() || isSubscribed() || !canShowAfterDismissal()) return;
    if (exitIntentTriggeredRef.current) return;

    const handleMouseLeave = (e: MouseEvent) => {
      // Trigger when mouse moves to top of viewport (toward browser bar)
      if (e.clientY <= 0) {
        exitIntentTriggeredRef.current = true;
        if (hasScrolled || scrollPercentage >= 40) {
          setIsVisible(true);
        }
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [isMobile, hasScrolled, scrollPercentage]);

  // Intent-based trigger for mobile and desktop (scroll-based)
  useEffect(() => {
    if (!isAllowedPath() || isSubscribed() || !canShowAfterDismissal()) return;
    if (hasCheckedStorageRef.current) return;
    
    hasCheckedStorageRef.current = true;

    // First visit: Wait 15-30 seconds + require 40% scroll
    // For testing: Reduced to 3-5 seconds (change back to 15000-30000 for production)
    const randomDelay = process.env.NODE_ENV === 'development' 
      ? Math.floor(Math.random() * 2000) + 3000 // 3-5 seconds for testing
      : Math.floor(Math.random() * 15000) + 15000; // 15-30 seconds for production
    
    scrollTimeoutRef.current = setTimeout(() => {
      // Check current scroll percentage directly (not just state)
      const currentScroll = calculateScrollPercentage();
      const currentHasScrolled = currentScroll >= 40;
      
      // Check if page is tall enough to scroll 40%
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const isPageTallEnough = documentHeight > windowHeight * 1.5; // Page must be at least 1.5x viewport height
      
      // Show popup if:
      // 1. User has scrolled 40% or more, OR
      // 2. Page is not tall enough to scroll 40% (show anyway after delay)
      if (currentHasScrolled || hasScrolled || !isPageTallEnough) {
        setIsVisible(true);
      }
      // If page is tall enough but user hasn't scrolled 40% yet,
      // the scroll handler will show it when they do
    }, randomDelay);

    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [hasScrolled, calculateScrollPercentage]);

  // Reset on route change
  useEffect(() => {
    setIsVisible(false);
    setIsExiting(false);
    setIsSuccess(false);
    setPhoneNumber("");
    setHasScrolled(false);
    setScrollPercentage(0);
    exitIntentTriggeredRef.current = false;
    hasCheckedStorageRef.current = false;
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  }, [location.pathname]);

  const handleClose = (dismissalType: string = DISMISSAL_TYPES.CLOSED) => {
    setIsExiting(true);
    
    // Save dismissal to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_DISMISSED, Date.now().toString());
      localStorage.setItem(STORAGE_KEY_DISMISSAL_TYPE, dismissalType);
    }
    
    setTimeout(() => {
      setIsVisible(false);
      setIsExiting(false);
      setIsSuccess(false);
      setPhoneNumber("");
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      toast({
        title: language === 'en' ? "Phone Number Required" : "Numéro de Téléphone Requis",
        description: language === 'en' 
          ? "Please enter your phone number to get alerts."
          : "Veuillez entrer votre numéro de téléphone pour recevoir des alertes.",
        variant: "destructive",
      });
      return;
    }

    // Validate Tunisian phone number format (8 digits starting with 2, 5, 9, or 4)
    const phoneRegex = /^[2594][0-9]{7}$/;
    const cleanPhone = phoneNumber.replace(/\s/g, '');
    
    if (!phoneRegex.test(cleanPhone)) {
      toast({
        title: language === 'en' ? "Invalid Phone Number" : "Numéro de Téléphone Invalide",
        description: language === 'en' 
          ? "Please enter a valid Tunisian phone number (8 digits starting with 2, 5, 9, or 4)."
          : "Veuillez entrer un numéro de téléphone tunisien valide (8 chiffres commençant par 2, 5, 9 ou 4).",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('phone_subscribers' as any)
        .insert({
          phone_number: cleanPhone,
          language: language,
        } as any);

      if (error) {
        // Check if it's a duplicate error
        if (error.code === '23505') {
          // Already subscribed, mark as subscribed
          if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_KEY_SUBSCRIBED, 'true');
            localStorage.setItem(STORAGE_KEY_DISMISSED, Date.now().toString());
            localStorage.setItem(STORAGE_KEY_DISMISSAL_TYPE, DISMISSAL_TYPES.SUBSCRIBED);
          }
          setIsSuccess(true);
          setTimeout(() => {
            handleClose(DISMISSAL_TYPES.SUBSCRIBED);
          }, 2000);
        } else {
          throw error;
        }
      } else {
        // Successfully subscribed
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_SUBSCRIBED, 'true');
          localStorage.setItem(STORAGE_KEY_DISMISSED, Date.now().toString());
          localStorage.setItem(STORAGE_KEY_DISMISSAL_TYPE, DISMISSAL_TYPES.SUBSCRIBED);
        }
        setIsSuccess(true);
        setTimeout(() => {
          handleClose(DISMISSAL_TYPES.SUBSCRIBED);
        }, 2000);
      }
    } catch (error) {
      console.error('Error subscribing phone number:', error);
      setIsSubmitting(false);
      toast({
        title: language === 'en' ? "Error" : "Erreur",
        description: language === 'en' 
          ? "Failed to subscribe. Please try again later."
          : "Échec de l'abonnement. Veuillez réessayer plus tard.",
        variant: "destructive",
      });
    }
  };

  // Debug: Log why popup might not be showing (remove in production)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Popup Debug:', {
        isVisible,
        isSubscribed: isSubscribed(),
        canShowAfterDismissal: canShowAfterDismissal(),
        isAllowedPath: isAllowedPath(),
        hasScrolled,
        scrollPercentage,
        pathname: location.pathname,
        isMobile,
      });
    }
  }, [isVisible, hasScrolled, scrollPercentage, location.pathname, isMobile]);

  // Don't show if conditions aren't met
  if (!isVisible || isSubscribed() || !canShowAfterDismissal() || !isAllowedPath()) {
    return null;
  }

  const translations = {
    en: {
      title: "Don't miss the next big event 🎉",
      subtitle: "Get instant alerts for events in your city",
      description: "We'll notify you when tickets drop, events are about to sell out, or exclusive offers are released.",
      phonePlaceholder: "Enter your phone number",
      helperText: "Max 1–2 messages per week. No spam.",
      notifyMe: "Notify me",
      notNow: "Not now",
      maybeLater: "Maybe later",
      subscribing: "Subscribing...",
      success: "You're in! We'll notify you before tickets drop.",
      done: "Done",
    },
    fr: {
      title: "Ne manquez pas le prochain grand événement 🎉",
      subtitle: "Recevez des alertes instantanées pour les événements de votre ville",
      description: "Nous vous avertirons lorsque les billets seront disponibles, que les événements seront sur le point d'être complets ou que des offres exclusives seront publiées.",
      phonePlaceholder: "Entrez votre numéro de téléphone",
      helperText: "Maximum 1–2 messages par semaine. Pas de spam.",
      notifyMe: "M'avertir",
      notNow: "Pas maintenant",
      maybeLater: "Peut-être plus tard",
      subscribing: "Abonnement...",
      success: "Vous êtes inscrit ! Nous vous avertirons avant la mise en vente des billets.",
      done: "Terminé",
    },
  };

  const t = translations[language];

  // Mobile Bottom Sheet Design
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className={cn(
            "fixed inset-0 bg-black/35 backdrop-blur-sm z-[99998] transition-opacity duration-300",
            isExiting ? "opacity-0" : "opacity-100"
          )}
          onClick={() => handleClose(DISMISSAL_TYPES.CLOSED)}
        />
        
        {/* Bottom Sheet Modal */}
        <div
          className={cn(
            "fixed bottom-0 left-0 right-0 z-[99999] pointer-events-none",
            isExiting ? "translate-y-full opacity-0" : "translate-y-0 opacity-100",
            "transition-all duration-300 ease-out"
          )}
        >
          <div className="pointer-events-auto bg-card border-t border-border/50 rounded-t-[16px] shadow-[0_-4px_24px_rgba(0,0,0,0.3)] max-h-[70vh] flex flex-col">
            {/* Drag Indicator */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1 bg-foreground/20 rounded-full" />
            </div>
            
            {/* Close Button (small, optional) */}
            <button
              onClick={() => handleClose(DISMISSAL_TYPES.CLOSED)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors"
            >
              <X className="w-4 h-4 text-foreground/60" />
            </button>
            
            {/* Content */}
            <div className="px-6 pb-6 overflow-y-auto flex-1">
              {/* Header - Centered */}
              <div className="text-center mb-6 pt-2">
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {t.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t.subtitle}
                </p>
              </div>
              
              {/* Form or Success State */}
              {!isSuccess ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Phone Input */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {/* Country Code */}
                      <div className="flex items-center gap-1.5 px-4 py-3 bg-muted/50 rounded-[12px] border border-border/50 flex-shrink-0">
                        <span className="text-lg">🇹🇳</span>
                        <span className="text-sm font-medium text-foreground">+216</span>
                      </div>
                      
                      {/* Phone Input */}
                      <Input
                        type="tel"
                        inputMode="numeric"
                        value={phoneNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 8) {
                            setPhoneNumber(value);
                          }
                        }}
                        placeholder={t.phonePlaceholder}
                        className="flex-1 h-12 text-base rounded-[12px] bg-background border-border/50 focus:border-primary/50"
                        disabled={isSubmitting}
                        required
                        autoFocus
                      />
                    </div>
                    
                    {/* Helper Text */}
                    <p className="text-xs text-muted-foreground px-1">
                      {t.helperText}
                    </p>
                  </div>
                  
                  {/* CTA Button - Sticky at bottom */}
                  <div className="pt-2 space-y-2">
                    <Button
                      type="submit"
                      className="w-full h-12 text-base font-semibold rounded-[12px] shadow-lg"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>{t.subscribing}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4" />
                          <span>{t.notifyMe}</span>
                        </div>
                      )}
                    </Button>
                    
                    {/* Secondary Button */}
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleClose(DISMISSAL_TYPES.LATER)}
                      className="w-full text-sm text-muted-foreground hover:text-foreground"
                    >
                      {t.notNow}
                    </Button>
                  </div>
                </form>
              ) : (
                /* Success State */
                <div className="text-center py-8 space-y-4">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-[zoom-in_0.3s_ease-out]">
                      <CheckCircle2 className="w-8 h-8 text-primary" />
                    </div>
                  </div>
                  <p className="text-base text-foreground font-medium">
                    {t.success}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // Desktop Centered Modal Design
  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 backdrop-blur-sm z-[99998] transition-opacity duration-300",
          isExiting ? "opacity-0" : "opacity-100"
        )}
        onClick={() => handleClose(DISMISSAL_TYPES.CLOSED)}
      />
      
      {/* Centered Modal Card */}
      <div
        className={cn(
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[99999] pointer-events-none",
          isExiting ? "scale-95 opacity-0" : "scale-100 opacity-100",
          "transition-all duration-300 ease-out"
        )}
      >
        <div className="pointer-events-auto w-[420px] max-w-[90vw] bg-card border border-border/50 rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.3)] overflow-hidden">
          {/* Close Button */}
          <button
            onClick={() => handleClose(DISMISSAL_TYPES.CLOSED)}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors z-10"
          >
            <X className="w-4 h-4 text-foreground/60" />
          </button>
          
          {/* Content */}
          <div className="p-6">
            {/* Header - Left-aligned */}
            <div className="mb-6 pr-8">
              <h3 className="text-2xl font-bold text-foreground mb-2">
                {t.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t.subtitle}
              </p>
            </div>
            
            {/* Form or Success State */}
            {!isSuccess ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Phone Input Row */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {/* Country Code */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 rounded-[12px] border border-border/50 flex-shrink-0">
                      <span className="text-lg">🇹🇳</span>
                      <span className="text-sm font-medium text-foreground">+216</span>
                    </div>
                    
                    {/* Phone Input */}
                    <Input
                      type="tel"
                      inputMode="numeric"
                      value={phoneNumber}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        if (value.length <= 8) {
                          setPhoneNumber(value);
                        }
                      }}
                      placeholder={t.phonePlaceholder}
                      className="flex-1 h-12 rounded-[12px] bg-background border-border/50 focus:border-primary/50"
                      disabled={isSubmitting}
                      required
                      autoFocus
                    />
                  </div>
                  
                  {/* Helper Text */}
                  <p className="text-xs text-muted-foreground px-1">
                    {t.helperText}
                  </p>
                </div>
                
                {/* CTA Buttons */}
                <div className="flex flex-col gap-3 pt-2">
                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-semibold rounded-[12px] shadow-lg hover:scale-[1.02] transition-transform"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{t.subscribing}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4" />
                        <span>{t.notifyMe}</span>
                      </div>
                    )}
                  </Button>
                  
                  {/* Secondary Link */}
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleClose(DISMISSAL_TYPES.LATER)}
                    className="w-full text-sm text-muted-foreground hover:text-foreground hover:scale-[1.02] transition-transform"
                  >
                    {t.maybeLater}
                  </Button>
                </div>
              </form>
            ) : (
              /* Success State */
              <div className="text-center py-8 space-y-4">
                <div className="flex justify-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-[zoom-in_0.3s_ease-out]">
                    <CheckCircle2 className="w-8 h-8 text-primary" />
                  </div>
                </div>
                <p className="text-base text-foreground font-medium">
                  {t.success}
                </p>
                <Button
                  onClick={() => handleClose(DISMISSAL_TYPES.SUBSCRIBED)}
                  className="mt-4"
                >
                  {t.done}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PhoneSubscriptionPopup;
