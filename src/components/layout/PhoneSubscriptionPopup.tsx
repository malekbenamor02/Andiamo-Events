import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface PhoneSubscriptionPopupProps {
  language: 'en' | 'fr';
}

// Pages where popup should NOT show
const EXCLUDED_PATHS = [
  '/admin',
  '/admin/login',
  '/ambassador/auth',
  '/ambassador/dashboard'
];

// LocalStorage keys
const STORAGE_KEY_SUBSCRIBED = 'andiamo_phone_subscribed';
const STORAGE_KEY_CLOSED = 'andiamo_phone_popup_closed';
const COOLDOWN_DAYS = 7;

const PhoneSubscriptionPopup = ({ language }: PhoneSubscriptionPopupProps) => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("+216 ");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const scrollTriggered = useRef(false);
  const timeTriggered = useRef(false);
  const exitIntentTriggered = useRef(false);
  const scrollPosition = useRef(0);

  // Check if popup should be shown based on localStorage
  const shouldShowPopup = (): boolean => {
    // Don't show on excluded pages
    if (EXCLUDED_PATHS.some(path => location.pathname.startsWith(path))) {
      return false;
    }

    // Don't show if user already subscribed
    const subscribed = localStorage.getItem(STORAGE_KEY_SUBSCRIBED);
    if (subscribed === 'true') {
      return false;
    }

    // Check if user closed popup recently (7 days cooldown)
    const closedTimestamp = localStorage.getItem(STORAGE_KEY_CLOSED);
    if (closedTimestamp) {
      const closedDate = new Date(parseInt(closedTimestamp));
      const now = new Date();
      const daysSinceClosed = (now.getTime() - closedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceClosed < COOLDOWN_DAYS) {
        return false;
      }
    }

    return true;
  };

  // Validate phone number: must start with +216 and have 8 digits after, first digit must be 2, 4, 9, or 5
  const validatePhone = (phone: string): boolean => {
    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    // Must start with +216
    if (!cleaned.startsWith('+216')) {
      return false;
    }
    
    // Must have exactly 8 digits after +216
    const digitsAfterCode = cleaned.slice(4);
    if (digitsAfterCode.length !== 8) {
      return false;
    }
    
    // Must be all numbers after +216
    if (!/^\d{8}$/.test(digitsAfterCode)) {
      return false;
    }
    
    // First digit after +216 must be 2, 4, 9, or 5
    const firstDigit = digitsAfterCode[0];
    if (!['2', '4', '9', '5'].includes(firstDigit)) {
      return false;
    }
    
    return true;
  };

  // Format phone number as user types - always keep +216 prefix
  const formatPhoneNumber = (value: string): string => {
    // Always ensure +216 is at the start
    if (!value.startsWith('+216')) {
      // If user is trying to delete +216, prevent it
      if (value.length < 4) {
        return '+216 ';
      }
      // If user typed digits, add +216 prefix
      const digits = value.replace(/[^\d]/g, '');
      if (digits.length > 0) {
        // Remove any leading 216 if user typed it
        const cleanDigits = digits.startsWith('216') ? digits.slice(3) : digits;
        if (cleanDigits.length <= 8) {
          const part1 = cleanDigits.slice(0, 2);
          const part2 = cleanDigits.slice(2, 5);
          const part3 = cleanDigits.slice(5, 8);
          
          let formatted = '+216';
          if (part1) formatted += ` ${part1}`;
          if (part2) formatted += ` ${part2}`;
          if (part3) formatted += ` ${part3}`;
          
          return formatted;
        }
      }
      return '+216 ';
    }
    
    // Remove all non-digit characters except +
    const cleaned = value.replace(/[^\d+]/g, '');
    
    // Extract digits after +216
    const digitsAfterCode = cleaned.slice(4);
    
    // Limit to 8 digits
    const limitedDigits = digitsAfterCode.slice(0, 8);
    
    // Format as +216 XX XXX XXX
    const part1 = limitedDigits.slice(0, 2);
    const part2 = limitedDigits.slice(2, 5);
    const part3 = limitedDigits.slice(5, 8);
    
    let formatted = '+216';
    if (part1) formatted += ` ${part1}`;
    if (part2) formatted += ` ${part2}`;
    if (part3) formatted += ` ${part3}`;
    
    return formatted;
  };

  // Handle scroll trigger (40-60% of page)
  useEffect(() => {
    if (!shouldShowPopup() || scrollTriggered.current) return;

    const handleScroll = () => {
      if (scrollTriggered.current) return; // Already triggered
      
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      
      // Calculate scroll percentage, handle edge case where page is shorter than viewport
      const maxScroll = Math.max(0, documentHeight - windowHeight);
      const scrollPercent = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;

      scrollPosition.current = scrollPercent;

      // Trigger between 40-60%
      if (scrollPercent >= 40 && scrollPercent <= 60) {
        scrollTriggered.current = true;
        setIsVisible(true);
      }
    };

    // Check initial scroll position
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [location.pathname]);

  // Handle time trigger (8-10 seconds)
  useEffect(() => {
    if (!shouldShowPopup() || timeTriggered.current) return;

    const randomDelay = Math.floor(Math.random() * 2000) + 8000; // 8-10 seconds
    
    const timer = setTimeout(() => {
      if (!scrollTriggered.current && !exitIntentTriggered.current) {
        timeTriggered.current = true;
        setIsVisible(true);
      }
    }, randomDelay);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Handle exit intent (desktop only)
  useEffect(() => {
    if (!shouldShowPopup() || exitIntentTriggered.current || isMobile) return;

    const handleMouseLeave = (e: MouseEvent) => {
      // Check if mouse is leaving the top of the viewport
      if (e.clientY <= 0) {
        if (!scrollTriggered.current && !timeTriggered.current) {
          exitIntentTriggered.current = true;
          setIsVisible(true);
        }
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [location.pathname, isMobile]);

  // Reset triggers on route change
  useEffect(() => {
    scrollTriggered.current = false;
    timeTriggered.current = false;
    exitIntentTriggered.current = false;
    setIsVisible(false);
    setIsExiting(false);
    setIsSuccess(false);
    setPhoneNumber("+216 ");
  }, [location.pathname]);

  const handleClose = () => {
    setIsExiting(true);
    
    // Save close timestamp to localStorage
    localStorage.setItem(STORAGE_KEY_CLOSED, Date.now().toString());
    
    setTimeout(() => {
      setIsVisible(false);
      setIsExiting(false);
      setIsSuccess(false);
      setPhoneNumber("+216 ");
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Validate phone number
    if (!validatePhone(phoneNumber)) {
      return;
    }

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Clean phone number (remove spaces, keep +216 and 8 digits)
      const cleanPhone = phoneNumber.replace(/\s/g, '');
      
      // Check if phone number already exists
      const { data: existing, error: checkError } = await supabase
        .from('phone_subscribers')
        .select('phone_number')
        .eq('phone_number', cleanPhone)
        .maybeSingle();
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is fine
        throw checkError;
      }
      
      if (existing) {
        // Phone number already exists
        setIsSubmitting(false);
        setIsSuccess(true);
        localStorage.setItem(STORAGE_KEY_SUBSCRIBED, 'true');
        
        // Auto close after 3 seconds
        setTimeout(() => {
          handleClose();
        }, 3000);
        return;
      }
      
      // Insert new phone number
      const { error } = await supabase
        .from('phone_subscribers')
        .insert({
          phone_number: cleanPhone,
          language: language,
        });

      if (error) {
        // Check if it's a duplicate error
        if (error.code === '23505') {
          // Still show success for duplicates
          setIsSuccess(true);
          localStorage.setItem(STORAGE_KEY_SUBSCRIBED, 'true');
          
          // Auto close after 3 seconds
          setTimeout(() => {
            handleClose();
          }, 3000);
        } else {
          console.error('Error subscribing phone number:', error);
          setIsSubmitting(false);
          // Show error to user
          alert(language === 'en' 
            ? 'Failed to subscribe. Please try again later.' 
            : 'Échec de l\'abonnement. Veuillez réessayer plus tard.');
        }
      } else {
        setIsSuccess(true);
        localStorage.setItem(STORAGE_KEY_SUBSCRIBED, 'true');
        
        // Auto close after 3 seconds
        setTimeout(() => {
          handleClose();
        }, 3000);
      }
    } catch (error) {
      console.error('Error subscribing phone number:', error);
      setIsSubmitting(false);
      alert(language === 'en' 
        ? 'An error occurred. Please try again later.' 
        : 'Une erreur s\'est produite. Veuillez réessayer plus tard.');
    }
  };

  // Don't show if conditions aren't met
  if (!shouldShowPopup() || !isVisible) return null;

  const translations = {
    en: {
      title: "🔔 Don't Miss the Next Party",
      subtitle: "Get exclusive event drops & VIP access via WhatsApp/SMS",
      placeholder: "+216 XX XXX XXX",
      cta: "Notify Me 🔥",
      microText: "No spam. 2–3 messages per month max.",
      successTitle: "✅ You're in!",
      successMessage: "We'll notify you before the next event drops 🔥",
      close: "Close",
    },
    fr: {
      title: "🔔 Ne Manquez Pas la Prochaine Soirée",
      subtitle: "Recevez des annonces d'événements exclusives et un accès VIP via WhatsApp/SMS",
      placeholder: "+216 XX XXX XXX",
      cta: "M'avertir 🔥",
      microText: "Pas de spam. 2–3 messages par mois maximum.",
      successTitle: "✅ Vous êtes inscrit !",
      successMessage: "Nous vous avertirons avant le prochain événement 🔥",
      close: "Fermer",
    },
  };

  const t = translations[language];
  const isValid = validatePhone(phoneNumber);
  const showValidationError = phoneNumber.length > 0 && !isValid && phoneNumber.length >= 4;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[99998] bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          isExiting ? "opacity-0" : "opacity-100"
        )}
        onClick={handleClose}
        style={{ pointerEvents: isExiting ? 'none' : 'auto' }}
      />

      {/* Popup - Bottom Sheet Style */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[99999]",
          "max-w-[360px] mx-auto",
          isExiting ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100",
          "transition-all duration-300 ease-out"
        )}
      >
        <div className="mx-4 mb-4" style={{ pointerEvents: 'auto' }}>
          <div
            className="relative rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #000000, #2A2A2A)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
              aria-label={t.close}
            >
              <X className="w-5 h-5 text-white/80" />
            </button>

            <div className="p-6">
              {!isSuccess ? (
                <>
                  {/* Title */}
                  <h3 className="text-xl font-bold text-white mb-2 pr-8">
                    {t.title}
                  </h3>

                  {/* Subtitle */}
                  <p className="text-sm text-white/80 mb-4">
                    {t.subtitle}
                  </p>

                  {/* Form */}
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSubmit(e);
                    }} 
                    className="space-y-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Phone Input */}
                    <div className="relative">
                      <Input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          // Prevent deletion of +216 prefix
                          if (inputValue.length < 4 || !inputValue.startsWith('+216')) {
                            setPhoneNumber('+216 ');
                            return;
                          }
                          const formatted = formatPhoneNumber(inputValue);
                          setPhoneNumber(formatted);
                        }}
                        onKeyDown={(e) => {
                          // Prevent backspace/delete from removing +216
                          if ((e.key === 'Backspace' || e.key === 'Delete') && phoneNumber.length <= 5) {
                            e.preventDefault();
                            return;
                          }
                          if (e.key === 'Enter' && isValid && !isSubmitting) {
                            e.preventDefault();
                            handleSubmit(e as any);
                          }
                        }}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pastedText = e.clipboardData.getData('text');
                          const digits = pastedText.replace(/[^\d]/g, '');
                          // Remove leading 216 if present
                          const cleanDigits = digits.startsWith('216') ? digits.slice(3) : digits;
                          if (cleanDigits.length <= 8) {
                            const formatted = formatPhoneNumber('+216' + cleanDigits);
                            setPhoneNumber(formatted);
                          }
                        }}
                        placeholder={t.placeholder}
                        className={cn(
                          "h-12 text-base bg-[#2A2A2A] border text-white placeholder:text-white/50",
                          showValidationError 
                            ? "border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                            : "border-white/20 focus:border-[#E21836] focus:ring-2 focus:ring-[#E21836]/20",
                          "transition-all duration-200"
                        )}
                        disabled={isSubmitting}
                        autoFocus
                      />
                      {showValidationError && (
                        <p className="text-xs text-red-400 mt-1">
                          {(() => {
                            const cleaned = phoneNumber.replace(/[^\d+]/g, '');
                            const digitsAfterCode = cleaned.slice(4);
                            if (digitsAfterCode.length !== 8) {
                              return language === 'en' 
                                ? 'Please enter 8 digits after +216'
                                : 'Veuillez entrer 8 chiffres après +216';
                            }
                            const firstDigit = digitsAfterCode[0];
                            if (!['2', '4', '9', '5'].includes(firstDigit)) {
                              return language === 'en' 
                                ? 'Phone number must start with 2, 4, 9, or 5'
                                : 'Le numéro doit commencer par 2, 4, 9 ou 5';
                            }
                            return language === 'en' 
                              ? 'Please enter a valid phone number'
                              : 'Veuillez entrer un numéro de téléphone valide';
                          })()}
                        </p>
                      )}
                    </div>

                    {/* CTA Button */}
                    <button
                      type="button"
                      disabled={!isValid || isSubmitting}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isValid && !isSubmitting) {
                          handleSubmit(e as any);
                        }
                      }}
                      className={cn(
                        "w-full h-12 text-base font-semibold rounded-md",
                        "bg-[#E21836] hover:bg-[#C0132C] text-white",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        "transition-all duration-200",
                        "shadow-lg shadow-[#E21836]/20",
                        "flex items-center justify-center",
                        "focus:outline-none focus:ring-2 focus:ring-[#E21836] focus:ring-offset-2 focus:ring-offset-transparent",
                        !isValid || isSubmitting ? "cursor-not-allowed" : "cursor-pointer"
                      )}
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>{language === 'en' ? 'Submitting...' : 'Envoi...'}</span>
                        </div>
                      ) : (
                        t.cta
                      )}
                    </button>

                    {/* Micro Text */}
                    <p className="text-xs text-white/60 text-center">
                      {t.microText}
                    </p>
                  </form>
                </>
              ) : (
                /* Success State */
                <div className="text-center py-4">
                  <h3 className="text-xl font-bold text-white mb-2">
                    {t.successTitle}
                  </h3>
                  <p className="text-sm text-white/80 mb-6">
                    {t.successMessage}
                  </p>
                  <Button
                    onClick={handleClose}
                    className={cn(
                      "w-full h-12 text-base font-semibold",
                      "bg-[#E21836] hover:bg-[#C0132C] text-white",
                      "transition-all duration-200"
                    )}
                  >
                    {t.close}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PhoneSubscriptionPopup;
