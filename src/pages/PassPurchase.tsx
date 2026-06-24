import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle, XCircle, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';
import Loader from '@/components/ui/Loader';
import { getApiBaseUrl, API_ROUTES } from '@/lib/api-routes';
import { formatDateDMY, isPassPurchaseWindowClosed } from '@/lib/date-utils';
import { cn, generateSlug, findEventByPublicUrlSlug, normalizeCommonEmailTypos } from '@/lib/utils';
import { isLocalhostClient } from '@/lib/localhost';
import { computeOnlinePaymentFeesDisplay } from '@/lib/onlinePaymentFee';
import { useCountdownBannerSettings } from '@/hooks/useCountdownBannerSettings';
import { useAmbassadorSelectionSettings } from '@/hooks/useAmbassadorSelectionSettings';
import { isAmbassadorCityWide } from '@/lib/ambassadorSelectionSettings';
import { PassPurchaseCountdownStrip } from '@/components/countdown/PassPurchaseCountdownStrip';
import {
  COUNTDOWN_LABEL_DEFAULT_EN,
  COUNTDOWN_LABEL_DEFAULT_FR,
} from '@/lib/countdownBannerSettings';

// New unified order system components
import { CustomerInfoForm } from '@/components/orders/CustomerInfoForm';
import { PaymentOptionSelector } from '@/components/orders/PaymentOptionSelector';
import { AmbassadorSelector } from '@/components/orders/AmbassadorSelector';
import { OrderSummary } from '@/components/orders/OrderSummary';
import { PromoCodeField } from '@/components/orders/PromoCodeField';
import { useEventPromoCheckout } from '@/hooks/useEventPromoCheckout';
import { OrderSuccessScreen } from '@/components/orders/OrderSuccessScreen';
import { PassPurchaseEventDetails } from '@/components/orders/PassPurchaseEventDetails';
import { PassPurchaseSeatingChart } from '@/components/orders/PassPurchaseSeatingChart';
import { PassPurchaseWizardPanel, PassPurchaseWizardStep } from '@/components/orders/PassPurchaseWizardStep';
import { usePaymentOptions } from '@/hooks/usePaymentOptions';
import { useActiveAmbassadors } from '@/hooks/useActiveAmbassadors';
import { PaymentMethod } from '@/lib/constants/orderStatuses';
import { CustomerInfo, SelectedPass, Ambassador } from '@/types/orders';
import { createOrder } from '@/lib/orders/orderService';
import { PageMeta } from '@/components/PageMeta';
import {
  parsePresaleDiscountPolicyFromApi,
  presaleAdjustedUnitPrice,
  roundPresaleMoneyDisplay,
  type PresaleDiscountPolicy,
} from '@/lib/presale/presaleDiscount';
import { trackEvent } from '@/lib/ga';
import {
  createMetaEventId,
  getMetaAttributionContext,
  isValidTicketMetaPixelPayload,
  trackPurchaseFromBackend,
} from '@/lib/meta';
import { v4 as uuidv4 } from 'uuid';
import {
  passPurchaseValidationCopy,
  validatePassPurchasePasses,
  validatePassPurchaseIdentity,
  validatePassPurchaseEmailStep,
  validatePassPurchaseLocation,
  validatePassPurchasePaymentStep,
  validatePassPurchaseFull,
  validatePassPurchaseCustomer,
  firstPassPurchaseErrorField,
  firstPassPurchaseErrorMessage,
} from '@/lib/orders/passPurchaseValidation';
import { mapPublicError, mapThrownError } from '@/lib/userErrors';
import { isPublicOrderError } from '@/lib/orders/PublicOrderError';
interface EventPass {
  id: string;
  name: string;
  price: number;
  description?: string;
  is_primary: boolean;
  // Stock information
  max_quantity?: number | null;
  sold_quantity?: number;
  remaining_quantity?: number | null;
  is_unlimited?: boolean;
  is_sold_out?: boolean;
  // Payment method restrictions (UX only - backend is authoritative)
  allowed_payment_methods?: string[] | null;
}

interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  venue: string;
  city: string;
  poster_url?: string;
  seating_chart_url?: string | null;
  passes?: EventPass[];
  is_test?: boolean;
  event_status?: string;
  event_type?: string;
  slug?: string | null;
  presale_enabled?: boolean;
  presale_active_from?: string | null;
  presale_active_until?: string | null;
  presale_hide_from_public_list?: boolean;
}

interface PassPurchaseProps {
  language: 'en' | 'fr';
}

const WIZARD_STEP_COUNT = 5;
const RECAPTCHA_BADGE_HIDE_STYLE_ID = 'pass-purchase-recaptcha-badge-hide';

/** DB / PostgREST may surface booleans inconsistently; server 403 on passes is authoritative for gating. */
function isPresaleEnabledOnEvent(ev: { presale_enabled?: unknown } | null | undefined): boolean {
  const v = ev?.presale_enabled;
  return v === true || v === 1 || v === '1' || v === 't' || v === 'T' || v === 'true' || v === 'TRUE';
}

const PRESALE_CSRF_STORAGE_PREFIX = 'andiamo_presale_csrf:';
function readPresaleCsrfFromStorage(eventId: string): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(`${PRESALE_CSRF_STORAGE_PREFIX}${eventId}`);
    return v && String(v).trim() ? String(v).trim() : null;
  } catch {
    return null;
  }
}
function writePresaleCsrfToStorage(eventId: string, token: string) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(`${PRESALE_CSRF_STORAGE_PREFIX}${eventId}`, token);
  } catch {
    /* ignore */
  }
}
function clearPresaleCsrfFromStorage(eventId: string) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(`${PRESALE_CSRF_STORAGE_PREFIX}${eventId}`);
  } catch {
    /* ignore */
  }
}

function mapPassesFromApiResponse(passesData: unknown[]): EventPass[] {
  return (passesData || []).map((raw) => {
    const p = raw as Record<string, unknown>;
    const priceRaw = p.price;
    const price =
      typeof priceRaw === 'number' ? priceRaw : parseFloat(String(priceRaw ?? 0)) || 0;
    return {
      id: String(p.id ?? ''),
      name: String(p.name ?? ''),
      price,
      description: String(p.description ?? ''),
      is_primary: Boolean(p.is_primary),
      max_quantity: (p.max_quantity as number | null | undefined) ?? undefined,
      sold_quantity: typeof p.sold_quantity === 'number' ? p.sold_quantity : 0,
      remaining_quantity: (p.remaining_quantity as number | null | undefined) ?? undefined,
      is_unlimited: Boolean(p.is_unlimited),
      is_sold_out: Boolean(p.is_sold_out),
      allowed_payment_methods: (p.allowed_payment_methods as string[] | null | undefined) ?? null,
    };
  });
}

const PassPurchase = ({ language }: PassPurchaseProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { eventSlug } = useParams<{ eventSlug?: string }>();
  // Support both new slug-based URLs and legacy eventId query param
  const eventIdFromQuery = searchParams.get('eventId');
  const eventId = eventIdFromQuery || null;
  const { toast } = useToast();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPasses, setSelectedPasses] = useState<Record<string, number>>({});
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    full_name: '',
    email: '',
    phone: '',
    city: '',
    ville: undefined
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [selectedAmbassadorId, setSelectedAmbassadorId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [selectedAmbassadorDetails, setSelectedAmbassadorDetails] = useState<Ambassador | null>(null);
  const [purchaseBlockedReason, setPurchaseBlockedReason] = useState<'completed' | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [maxVisitedStep, setMaxVisitedStep] = useState(1);
  const [emailConfirm, setEmailConfirm] = useState('');
  const [presaleCsrfToken, setPresaleCsrfToken] = useState<string | null>(null);
  /** True after GET /api/passes/:id returns 403 (presale session required) even if client event row omits presale_enabled. */
  const [passesForbiddenPresale, setPassesForbiddenPresale] = useState(false);
  /** From GET /api/presale/required — authoritative DB flag; undefined = meta request failed, fall back to client row. */
  const [serverPresaleRequired, setServerPresaleRequired] = useState<boolean | undefined>(undefined);
  const [presaleCodeDraft, setPresaleCodeDraft] = useState('');
  const [presaleRedeeming, setPresaleRedeeming] = useState(false);
  /** Mirrors presale_codes discount for the active session (from session or redeem API). */
  const [presaleDiscountPolicy, setPresaleDiscountPolicy] = useState<PresaleDiscountPolicy | null>(null);
  /** Server session expiry (ms since epoch); used to re-lock at 3.5 minutes. */
  const [presaleSessionExpiresAt, setPresaleSessionExpiresAt] = useState<number | null>(null);
  const presaleExpiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [checkoutPromoDraft, setCheckoutPromoDraft] = useState('');
  const [promoCheckoutAvailable, setPromoCheckoutAvailable] = useState(false);
  /** Cart lines at list price — used with presaleDiscountPolicy for totals (matches server order math). */
  const presaleLineList = useMemo((): { passId: string; unitList: number; qty: number }[] => {
    if (!event?.passes) return [];
    const out: { passId: string; unitList: number; qty: number }[] = [];
    for (const [passId, quantity] of Object.entries(selectedPasses)) {
      if (quantity <= 0) continue;
      const pass = event.passes.find((p) => p.id === passId);
      if (pass) out.push({ passId, unitList: pass.price, qty: quantity });
    }
    return out;
  }, [event?.passes, selectedPasses]);

  const promoCartLines = useMemo(
    () =>
      presaleLineList.map((l) => ({
        passId: l.passId,
        quantity: l.qty,
      })),
    [presaleLineList]
  );

  const { preview: promoPreview, promoSubmitCode } = useEventPromoCheckout({
    eventId: event?.id,
    promoAvailable: promoCheckoutAvailable,
    promoCodeDraft: checkoutPromoDraft,
    passes: promoCartLines,
    paymentMethod,
  });

  useEffect(() => {
    const evId = event?.id;
    const presaleOn =
      serverPresaleRequired === true ||
      (serverPresaleRequired !== false && isPresaleEnabledOnEvent(event));
    if (!evId || presaleOn) {
      setPromoCheckoutAvailable(false);
      setCheckoutPromoDraft('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `${getApiBaseUrl()}${API_ROUTES.EVENT_PROMO_AVAILABILITY(evId)}`
        );
        const j = await r.json().catch(() => ({}));
        if (!cancelled) setPromoCheckoutAvailable(!!j.available);
      } catch {
        if (!cancelled) setPromoCheckoutAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [event?.id, event?.presale_enabled, serverPresaleRequired]);

  /** Glass card that wraps the step fields — scroll this into view on Continue/Back so it stays visible (esp. mobile). */
  const wizardFieldsBoxRef = useRef<HTMLDivElement>(null);
  /** Step 5 footer (terms + Back / Submit) — scroll here on mobile after ambassador pick. */
  const step5SubmitScrollRef = useRef<HTMLDivElement>(null);
  /** Skip auto-scroll on first paint so event details stay visible at the top on load. */
  const skipInitialWizardScrollRef = useRef(true);
  /** User used Back from payment step — do not create an order until they press Proceed again. */
  const checkoutBackFromPaymentRef = useRef(false);
  /** Prevents double "Proceed" / duplicate createOrder while async work runs. */
  const checkoutSubmitInFlightRef = useRef(false);
  /** Abort in-flight POST /api/orders/create when leaving payment step during checkout. */
  const activeCheckoutAbortRef = useRef<AbortController | null>(null);

  // Fetch payment options
  const { data: paymentOptions = [], isLoading: loadingPaymentOptions } = usePaymentOptions();

  const clearPresaleExpiryTimer = useCallback(() => {
    if (presaleExpiryTimerRef.current) {
      clearTimeout(presaleExpiryTimerRef.current);
      presaleExpiryTimerRef.current = null;
    }
  }, []);

  const lockPresaleGate = useCallback(
    async (eventId: string, showExpiredToast = false) => {
      clearPresaleExpiryTimer();
      setPresaleCsrfToken(null);
      setPresaleSessionExpiresAt(null);
      setPresaleDiscountPolicy(null);
      setPassesForbiddenPresale(true);
      setEvent((prev) => (prev ? ({ ...prev, passes: [] } as Event) : prev));
      clearPresaleCsrfFromStorage(eventId);
      try {
        const apiBase = getApiBaseUrl();
        await fetch(`${apiBase}${API_ROUTES.PRESALE_SESSION_CLEAR}`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        /* ignore */
      }
      if (showExpiredToast) {
        toast({
          title: language === 'en' ? 'Session expired' : 'Session expirée',
          description:
            language === 'en'
              ? 'Your presale access has expired. Enter your code again to continue.'
              : 'Votre accès prévente a expiré. Entrez votre code à nouveau pour continuer.',
          variant: 'default',
        });
      }
    },
    [clearPresaleExpiryTimer, language, toast]
  );

  const schedulePresaleExpiry = useCallback(
    (eventId: string, expiresAtMs: number) => {
      clearPresaleExpiryTimer();
      setPresaleSessionExpiresAt(expiresAtMs);
      const delay = expiresAtMs - Date.now();
      if (delay <= 0) {
        void lockPresaleGate(eventId, true);
        return;
      }
      presaleExpiryTimerRef.current = setTimeout(() => {
        void lockPresaleGate(eventId, true);
      }, delay);
    },
    [clearPresaleExpiryTimer, lockPresaleGate]
  );

  const applyActivePresaleSession = useCallback(
    (
      eventId: string,
      csrfTok: string,
      expiresAtRaw: unknown,
      discount: PresaleDiscountPolicy | null
    ) => {
      setPresaleCsrfToken(csrfTok);
      writePresaleCsrfToStorage(eventId, csrfTok);
      setPassesForbiddenPresale(false);
      if (discount) setPresaleDiscountPolicy(discount);
      const expiresMs =
        typeof expiresAtRaw === 'string' ? new Date(expiresAtRaw).getTime() : NaN;
      if (Number.isFinite(expiresMs)) {
        schedulePresaleExpiry(eventId, expiresMs);
      }
    },
    [schedulePresaleExpiry]
  );

  useEffect(() => () => clearPresaleExpiryTimer(), [clearPresaleExpiryTimer]);

  const presaleLocked = useMemo(() => {
    if (presaleCsrfToken) {
      if (presaleSessionExpiresAt != null && presaleSessionExpiresAt <= Date.now()) {
        return true;
      }
      return false;
    }
    if (passesForbiddenPresale) return true;
    if (serverPresaleRequired === true) return true;
    if (serverPresaleRequired === false) return false;
    return isPresaleEnabledOnEvent(event);
  }, [event, presaleCsrfToken, presaleSessionExpiresAt, passesForbiddenPresale, serverPresaleRequired]);

  // Fetch active ambassadors to get full details (including social_link)
  const { data: ambassadorSelectionSettings } = useAmbassadorSelectionSettings();
  const ambassadorCityWide = isAmbassadorCityWide(
    customerInfo.city,
    ambassadorSelectionSettings
  );
  const { data: activeAmbassadors = [] } = useActiveAmbassadors(
    customerInfo.city,
    customerInfo.ville,
    { cityWide: ambassadorCityWide }
  );

  const { data: countdownSettings, isSuccess: countdownSettingsReady } = useCountdownBannerSettings();

  /** Presale countdown targeting when row flag, API, or locked gate says presale (server `false` wins). */
  const effectivePresaleForCountdown = useMemo(() => {
    if (!event) return false;
    if (serverPresaleRequired === false) return false;
    return (
      isPresaleEnabledOnEvent(event) ||
      passesForbiddenPresale ||
      serverPresaleRequired === true
    );
  }, [event, passesForbiddenPresale, serverPresaleRequired]);

  const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  // Load reCAPTCHA v3 on payment step or presale gate (redeem uses v3 action presale_redeem)
  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY || typeof window === 'undefined') return;
    const needScript = wizardStep === WIZARD_STEP_COUNT || presaleLocked;
    if (!needScript) return;
    if ((window as any).grecaptcha) return;

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    // Intentionally no cleanup: presale gate and payment step both need grecaptcha; removing the script
    // when leaving the gate would break step 5 if the user had not visited it yet.
  }, [RECAPTCHA_SITE_KEY, wizardStep, presaleLocked]);

  // Hide the floating reCAPTCHA badge on presale and early wizard steps; show only on checkout (step 5).
  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY || typeof window === 'undefined') return;
    const showBadge = !presaleLocked && wizardStep === WIZARD_STEP_COUNT;
    const existing = document.getElementById(RECAPTCHA_BADGE_HIDE_STYLE_ID);
    if (showBadge) {
      existing?.remove();
      return;
    }
    if (existing) return;
    const style = document.createElement('style');
    style.id = RECAPTCHA_BADGE_HIDE_STYLE_ID;
    style.textContent = '.grecaptcha-badge { visibility: hidden !important; }';
    document.head.appendChild(style);
    return () => {
      document.getElementById(RECAPTCHA_BADGE_HIDE_STYLE_ID)?.remove();
    };
  }, [RECAPTCHA_SITE_KEY, presaleLocked, wizardStep]);

  const RECAPTCHA_TIMEOUT_MS = 15000;

  const executeRecaptchaForOrder = async (): Promise<string | null> => {
    if (isLocalhostClient()) return 'localhost-bypass-token';
    if (!RECAPTCHA_SITE_KEY || !(window as any).grecaptcha) return null;
    const gr = (window as any).grecaptcha;
    await new Promise<void>((resolve) => {
      if (typeof gr.ready === 'function') gr.ready(() => resolve());
      else resolve();
    });
    try {
      const executePromise = gr.execute(RECAPTCHA_SITE_KEY, { action: 'order_create' });
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('RECAPTCHA_TIMEOUT')), RECAPTCHA_TIMEOUT_MS);
      });
      return await Promise.race([executePromise, timeoutPromise]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'RECAPTCHA_TIMEOUT' || (typeof msg === 'string' && msg.includes('reCAPTCHA Timeout'))) {
        throw new Error('RECAPTCHA_TIMEOUT');
      }
      return null;
    }
  };

  const executeRecaptchaPresaleRedeem = async (): Promise<string | null> => {
    if (isLocalhostClient()) return 'localhost-bypass-token';
    if (!RECAPTCHA_SITE_KEY || !(window as any).grecaptcha) return null;
    const gr = (window as any).grecaptcha;
    await new Promise<void>((resolve) => {
      if (typeof gr.ready === 'function') gr.ready(() => resolve());
      else resolve();
    });
    try {
      const executePromise = gr.execute(RECAPTCHA_SITE_KEY, { action: 'presale_redeem' });
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('RECAPTCHA_TIMEOUT')), RECAPTCHA_TIMEOUT_MS);
      });
      return await Promise.race([executePromise, timeoutPromise]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'RECAPTCHA_TIMEOUT' || (typeof msg === 'string' && msg.includes('reCAPTCHA Timeout'))) {
        throw new Error('RECAPTCHA_TIMEOUT');
      }
      return null;
    }
  };

  // Reset ambassador selection when payment method changes
  useEffect(() => {
    if (paymentMethod !== PaymentMethod.AMBASSADOR_CASH) {
      setSelectedAmbassadorId(null);
      setSelectedAmbassadorDetails(null);
    }
  }, [paymentMethod]);

  // Narrow viewports: choosing an ambassador leaves summary + Submit below the fold — scroll them into view
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (wizardStep !== WIZARD_STEP_COUNT) return;
    if (paymentMethod !== PaymentMethod.AMBASSADOR_CASH) return;
    if (!selectedAmbassadorId) return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        step5SubmitScrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
    });
  }, [selectedAmbassadorId, paymentMethod, wizardStep]);

  // Clear payment method if it becomes incompatible with selected passes (UX only - backend is authoritative)
  useEffect(() => {
    if (paymentMethod && event?.passes && Object.keys(selectedPasses).some(id => selectedPasses[id] > 0)) {
      const selectedPassIds = Object.keys(selectedPasses).filter(id => selectedPasses[id] > 0);
      let isCompatible = true;
      const incompatiblePasses: string[] = [];
      
      for (const passId of selectedPassIds) {
        const pass = event.passes.find(p => p.id === passId);
        if (!pass) continue;
        
        // If pass has no restrictions, it's compatible with all methods
        if (!pass.allowed_payment_methods || pass.allowed_payment_methods.length === 0) {
          continue;
        }
        
        // Check if the payment method is in the allowed list
        if (!pass.allowed_payment_methods.includes(paymentMethod)) {
          isCompatible = false;
          incompatiblePasses.push(pass.name);
        }
      }
      
      // If payment method is no longer compatible, clear it
      if (!isCompatible) {
        setPaymentMethod(null);
        toast({
          title: language === 'en' ? 'Payment method cleared' : 'Méthode de paiement effacée',
          description: language === 'en'
            ? `The selected payment method is not available for: ${incompatiblePasses.join(', ')}`
            : `La méthode de paiement sélectionnée n'est pas disponible pour : ${incompatiblePasses.join(', ')}`,
          variant: 'default',
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPasses, event?.passes]);

  // Update selected ambassador details when ambassador ID changes
  useEffect(() => {
    if (!selectedAmbassadorId) {
      setSelectedAmbassadorDetails(null);
      return;
    }
    if (activeAmbassadors.length === 0) return;

    const ambassador = activeAmbassadors.find((a) => a.id === selectedAmbassadorId);
    if (ambassador) {
      setSelectedAmbassadorDetails(ambassador);
    } else {
      setSelectedAmbassadorId(null);
      setSelectedAmbassadorDetails(null);
    }
  }, [selectedAmbassadorId, activeAmbassadors]);

  // Track visit to the pass purchase flow (once event is loaded and purchase is allowed)
  useEffect(() => {
    if (event && !purchaseBlockedReason) {
      const page_path = typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined;
      trackEvent('pass_purchase_visit', {
        event_id: event.id,
        event_name: event.name,
        language,
        ...(page_path && { page_path }),
      });
    }
  }, [event?.id, purchaseBlockedReason, language, event?.name]);

  // Scroll the wizard fields card into view on every step change (Continue / Back), not on first load (event details stay first).
  useEffect(() => {
    if (!event || loading || purchaseBlockedReason || submitted || presaleLocked) return;
    if (skipInitialWizardScrollRef.current) {
      skipInitialWizardScrollRef.current = false;
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        wizardFieldsBoxRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest',
        });
      });
    });
  }, [wizardStep, event?.id, loading, purchaseBlockedReason, submitted, presaleLocked]);

  const t = {
    en: {
      title: "Purchase Pass",
      backToEvents: "Back to Events",
      passSelection: "Select Passes",
      customerInfo: "Personal Information",
      payment: "Payment Method",
      summary: "Order Summary",
      quantity: "Quantity",
      total: "Total",
      proceedToPayment: "Proceed to Payment",
      submitOrder: "Submit Order",
      processing: "Processing...",
      success: "Order submitted successfully!",
      successMessageOnline: "Your order has been submitted. You will receive payment instructions by email.",
      successMessageAmbassador: "Your order has been submitted. An ambassador will contact you soon.",
      error: "Error",
      required: "This field is required",
      fixFormErrors: "Please fix the errors in the form",
      selectAtLeastOnePass: "Please select at least one pass",
      selectPaymentMethod: "Please select a payment method",
      termsRequired: "You must accept the Terms of Service and Refund & Cancellation Policy",
      thankYou: "Thank you for your order!",
      orderDetails: "Order Details",
      stepOf: "Step {n} of {total}",
      stepIdentity: "Your name & phone",
      stepEmail: "Your email",
      stepLocation: "City & neighborhood",
      stepPaymentSummary: "Payment & order summary",
      completePaymentToSubmit: "Select a payment method above to continue.",
      next: "Continue",
      back: "Back",
      presaleTitle: "So you think you're VIP?",
      presaleHint: "Unlock access for our community members.",
      presalePlaceholder: "Presale code",
      presaleUnlock: "Prove It",
      presaleInvalid: "Invalid or expired code. Try again.",
    },
    fr: {
      title: "Acheter un Pass",
      backToEvents: "Retour aux Événements",
      passSelection: "Sélectionner les Passes",
      customerInfo: "Informations Personnelles",
      payment: "Méthode de Paiement",
      summary: "Résumé de la Commande",
      quantity: "Quantité",
      total: "Total",
      proceedToPayment: "Procéder au Paiement",
      submitOrder: "Soumettre la Commande",
      processing: "Traitement...",
      success: "Commande soumise avec succès!",
      successMessageOnline: "Votre commande a été soumise. Vous recevrez les instructions de paiement par email.",
      successMessageAmbassador: "Votre commande a été soumise. Un ambassadeur vous contactera bientôt.",
      error: "Erreur",
      required: "Ce champ est requis",
      fixFormErrors: "Veuillez corriger les erreurs dans le formulaire",
      selectAtLeastOnePass: "Veuillez sélectionner au moins un pass",
      selectPaymentMethod: "Veuillez sélectionner une méthode de paiement",
      termsRequired: "Vous devez accepter les Conditions d'Utilisation et la Politique de Remboursement et d'Annulation",
      thankYou: "Merci pour votre commande!",
      orderDetails: "Détails de la Commande",
      stepOf: "Étape {n} sur {total}",
      stepIdentity: "Nom et téléphone",
      stepEmail: "Votre email",
      stepLocation: "Ville et quartier",
      stepPaymentSummary: "Paiement et récapitulatif",
      completePaymentToSubmit: "Choisissez un mode de paiement ci-dessus pour continuer.",
      next: "Continuer",
      back: "Retour",
      presaleTitle: "Oh… alors tu te crois VIP ?",
      presaleHint: "Débloquez l'accès réservé aux membres de notre communauté.",
      presalePlaceholder: "Code prévente",
      presaleUnlock: "Prouve-le",
      presaleInvalid: "Code invalide ou expiré. Réessayez.",
    }
  };

  function presaleRedeemErrorDescription(
    lang: 'en' | 'fr',
    reason: string | undefined,
    serverMessage: string | undefined
  ): string {
    return mapPublicError({ reason, message: serverMessage }, lang).description;
  }

  useEffect(() => {
    if (eventSlug || eventId) {
      fetchEvent();
    } else {
      // No event identifier provided, show error
      setEvent(null);
      setLoading(false);
      toast({
        title: t[language].error,
        description: language === 'en' 
          ? 'Event not specified' 
          : 'Événement non spécifié',
        variant: 'destructive'
      });
    }
  }, [eventSlug, eventId]);

  const fetchEvent = async () => {
    try {
      setLoading(true);
      setPurchaseBlockedReason(null);
      setPresaleCsrfToken(null);
      setPresaleSessionExpiresAt(null);
      clearPresaleExpiryTimer();
      setPassesForbiddenPresale(false);
      setServerPresaleRequired(undefined);
      setPresaleDiscountPolicy(null);

      const isLocal = isLocalhostClient();

      let eventData: any = null;
      let eventError: any = null;
      let resolvedEventId: string | null = null;

      // Fetch event by slug or eventId
      if (eventSlug) {
        const normalizedSlug = decodeURIComponent(eventSlug).toLowerCase().trim();
        // Prefer DB `slug` column; then same fallbacks as UpcomingEvent / GalleryEvent (name slug, event-{id})
        const { data: byDbSlug, error: slugColError } = await supabase
          .from('events')
          .select('*')
          .eq('slug', normalizedSlug)
          .maybeSingle();

        if (slugColError) {
          eventError = slugColError;
        } else if (byDbSlug) {
          eventData = byDbSlug;
          resolvedEventId = byDbSlug.id;
        } else {
          const { data: allRows, error: allErr } = await supabase.from('events').select('*');
          if (allErr) {
            eventError = allErr;
          } else {
            const pool = isLocal ? allRows || [] : (allRows || []).filter((ev: { is_test?: boolean }) => !ev.is_test);
            const found = findEventByPublicUrlSlug(pool, normalizedSlug);
            if (found) {
              eventData = found;
              resolvedEventId = found.id;
            }
          }
        }
      } else if (eventId) {
        // Legacy URL: fetch by eventId
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('id', eventId)
          .single();
        
        eventData = data;
        eventError = error;
        resolvedEventId = eventId;
      } else {
        setEvent(null);
        setLoading(false);
        return;
      }

      if (eventError) {
        // Handle specific error cases
        if (eventError.code === 'PGRST116') {
          // Event not found
          setEvent(null);
          setLoading(false);
          return;
        }
        throw eventError;
      }

      // Check if event exists
      if (!eventData) {
        setEvent(null);
        setLoading(false);
        return;
      }

      // Type cast to access additional properties that might not be in the inferred type
      const event = eventData as any;

      // Block test events on production — except code-gated presale (direct URL / QA; still not on public lists)
      if (!isLocal && event?.is_test && !isPresaleEnabledOnEvent(event)) {
        toast({
          title: t[language].error,
          description: language === 'en' 
            ? 'This event is not available.' 
            : 'Cet événement n\'est pas disponible.',
          variant: 'destructive'
        });
        setEvent(null);
        setLoading(false);
        return;
      }

      // Cancelled: same UX as missing event (do not disclose cancellation)
      if (event?.event_status === 'cancelled') {
        setEvent(null);
        setLoading(false);
        return;
      }

      // Block pass purchase when admin marked completed (cancelled handled above)
      if (isPassPurchaseWindowClosed(event.date, event.event_status)) {
        setPurchaseBlockedReason('completed');
        setEvent({ ...event, passes: [] } as Event);
        setLoading(false);
        toast({
          title: language === 'en' ? 'Sales are closed' : 'Ventes fermées',
          description: language === 'en'
            ? 'Pass purchase for this event is closed. You can still view the event recap on the gallery page.'
            : 'L\'achat de passes pour cet événement est fermé. Vous pouvez voir le récapitulatif sur la page galerie.',
          variant: 'default'
        });
        return;
      }

      // Fetch passes from server (stock + payment rules; presale events require HttpOnly session cookie)
      let passes: EventPass[] = [];
      let presaleOn = isPresaleEnabledOnEvent(event);
      try {
        const apiBase = getApiBaseUrl();
        if (!resolvedEventId) {
          throw new Error('Event ID not resolved');
        }
        try {
          const metaRes = await fetch(
            `${apiBase}${API_ROUTES.PRESALE_REQUIRED}?eventId=${encodeURIComponent(String(resolvedEventId).trim())}`,
            { credentials: 'include' }
          );
          const metaJson = await metaRes.json().catch(() => ({}));
          if (metaRes.ok && typeof metaJson.required === 'boolean' && metaJson.found === true) {
            presaleOn = metaJson.required;
            setServerPresaleRequired(metaJson.required);
          } else {
            // Do not set false here: /api/passes returns authoritative presale_required after this.
            setServerPresaleRequired(undefined);
          }
        } catch (e) {
          console.warn('PassPurchase: /api/presale/required failed', e);
          setServerPresaleRequired(undefined);
        }

        const idForPasses = encodeURIComponent(String(resolvedEventId).trim());
        const privatePassesResponse = await fetch(`${apiBase}/api/passes/${idForPasses}`, {
          credentials: 'include',
        });
        if (privatePassesResponse.status === 403) {
          passes = [];
          setPresaleCsrfToken(null);
          setPassesForbiddenPresale(true);
          setPresaleDiscountPolicy(null);
        } else if (privatePassesResponse.ok) {
          const passesResult = await privatePassesResponse.json();
          if (typeof passesResult.presale_required === 'boolean') {
            presaleOn = passesResult.presale_required;
            setServerPresaleRequired(passesResult.presale_required);
          }
          const mappedPasses = mapPassesFromApiResponse(passesResult.passes || []);
          if (presaleOn) {
            const eid = String(resolvedEventId).trim();
            const sessRes = await fetch(`${apiBase}${API_ROUTES.PRESALE_SESSION}`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ eventId: eid }),
            });
            const sessJson = await sessRes.json().catch(() => ({}));
            let csrfTok =
              typeof sessJson.csrfToken === 'string' && sessJson.csrfToken.trim()
                ? sessJson.csrfToken.trim()
                : readPresaleCsrfFromStorage(eid);
            const sessionOk = sessRes.ok && sessJson.valid === true && !!csrfTok;
            if (sessionOk) {
              applyActivePresaleSession(
                eid,
                csrfTok,
                sessJson.expiresAt,
                parsePresaleDiscountPolicyFromApi(sessJson as Record<string, unknown>)
              );
              passes = mappedPasses;
            } else {
              setPresaleCsrfToken(null);
              setPassesForbiddenPresale(true);
              setPresaleDiscountPolicy(null);
              passes = [];
            }
          } else {
            setPresaleCsrfToken(null);
            setPassesForbiddenPresale(false);
            setPresaleDiscountPolicy(null);
            passes = mappedPasses;
          }
        } else if (privatePassesResponse.status === 404) {
          passes = [];
          setPresaleCsrfToken(null);
          if (presaleOn) {
            setPassesForbiddenPresale(true);
            // Presale: no passes list until unlock; 404 often means API DB env mismatch — avoid scary toast
          } else {
            setPassesForbiddenPresale(false);
            const errorText = await privatePassesResponse.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText };
            }
            console.error('❌ Failed to fetch passes for event:', resolvedEventId, {
              status: 404,
              error: errorData,
            });
            const passErr = mapPublicError(
              {
                error: typeof errorData?.error === 'string' ? errorData.error : 'passes_unavailable',
                message: typeof errorData?.message === 'string' ? errorData.message : undefined,
                status: 404,
              },
              language
            );
            toast({
              title: passErr.title,
              description: passErr.description,
              variant: 'destructive',
            });
          }
        } else {
          const errorText = await privatePassesResponse.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText };
          }
          console.error('❌ Failed to fetch passes for event:', resolvedEventId, {
            status: privatePassesResponse.status,
            statusText: privatePassesResponse.statusText,
            error: errorData
          });
          if (presaleOn) {
            setPresaleCsrfToken(null);
            setPassesForbiddenPresale(true);
          }
          const passErr = mapPublicError(
            {
              error: typeof errorData?.error === 'string' ? errorData.error : 'passes_unavailable',
              message: typeof errorData?.message === 'string' ? errorData.message : undefined,
              status: privatePassesResponse.status,
            },
            language
          );
          toast({
            title: passErr.title,
            description: passErr.description,
            variant: 'destructive',
          });
        }
      } catch (passError: any) {
        // Passes fetch error, but we still show the event
        console.error('❌ Error fetching passes for event:', resolvedEventId, passError);
        const passErr = mapThrownError(passError, language);
        toast({
          title: passErr.title,
          description: passErr.description,
          variant: 'destructive',
        });
      }

      setEvent({ ...event, passes } as Event);

      // All passes start at 0 - no default selection
    } catch (error) {
      console.error('Error fetching event:', error);
      // Only show "Event Not Found" if the event itself failed to load
      setEvent(null);
      toast({
        title: t[language].error,
        description: language === 'en' ? 'Failed to load event' : 'Échec du chargement de l\'événement',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePresaleRedeem = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!event?.id) return;
    const code = presaleCodeDraft.trim();
    if (!code) {
      toast({
        title: t[language].error,
        description: language === 'en' ? 'Enter your presale code.' : 'Entrez votre code prévente.',
        variant: 'destructive',
      });
      return;
    }
    setPresaleRedeeming(true);
    try {
      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = await executeRecaptchaPresaleRedeem();
      } catch (recaptchaErr: unknown) {
        if (recaptchaErr instanceof Error && recaptchaErr.message === 'RECAPTCHA_TIMEOUT') {
          toast({
            title: language === 'en' ? 'Verification timed out' : 'Vérification expirée',
            description: language === 'en'
              ? "Verification timed out. Please try again or open this page in your device's browser instead of the in-app browser."
              : 'Vérification expirée. Réessayez ou ouvrez cette page dans le navigateur de votre appareil.',
            variant: 'destructive',
          });
          return;
        }
        throw recaptchaErr;
      }
      if (!isLocalhostClient() && !recaptchaToken) {
        toast({
          title: t[language].error,
          description: language === 'en' ? 'reCAPTCHA verification failed. Please try again.' : 'La vérification reCAPTCHA a échoué. Veuillez réessayer.',
          variant: 'destructive',
        });
        return;
      }
      const apiBase = getApiBaseUrl();
      const r = await fetch(`${apiBase}${API_ROUTES.PRESALE_REDEEM}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          code,
          recaptchaToken: recaptchaToken ?? undefined,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body.success) {
        const reason = typeof body.reason === 'string' ? body.reason : undefined;
        const serverMessage = typeof body.message === 'string' ? body.message : undefined;
        toast({
          title: t[language].error,
          description: presaleRedeemErrorDescription(language, reason, serverMessage),
          variant: 'destructive',
        });
        return;
      }
      const csrfFromRedeem =
        typeof body.csrfToken === 'string' && body.csrfToken.trim()
          ? body.csrfToken.trim()
          : null;
      const discFromRedeem = parsePresaleDiscountPolicyFromApi(body as Record<string, unknown>);

      const passesRes = await fetch(`${apiBase}/api/passes/${event.id}`, { credentials: 'include' });
      if (!passesRes.ok) {
        toast({
          title: t[language].error,
          description: t[language].presaleInvalid,
          variant: 'destructive',
        });
        return;
      }
      const passesJson = await passesRes.json();
      if (typeof passesJson.presale_required === 'boolean') {
        setServerPresaleRequired(passesJson.presale_required);
      }
      const mapped = mapPassesFromApiResponse(passesJson.passes || []);

      // Unlock only after passes are loaded so `presaleLocked` never goes false while `event.passes` is still empty (avoids "no passes" flash).
      if (csrfFromRedeem) {
        applyActivePresaleSession(
          event.id,
          csrfFromRedeem,
          body.expiresAt,
          discFromRedeem
        );
      } else if (discFromRedeem) {
        setPresaleDiscountPolicy(discFromRedeem);
      }
      setPassesForbiddenPresale(false);
      setPresaleCodeDraft('');
      setEvent((prev) => (prev ? ({ ...prev, passes: mapped } as Event) : prev));
    } finally {
      setPresaleRedeeming(false);
    }
  };

  // Helper function to check if a pass is compatible with a payment method (UX only - backend is authoritative)
  const isPassCompatibleWithPaymentMethod = (pass: EventPass, method: PaymentMethod | null): boolean => {
    // If no payment method selected, show all passes (user hasn't chosen yet)
    if (!method) return true;
    
    // If pass has no restrictions (NULL or empty array), allow all methods
    if (!pass.allowed_payment_methods || pass.allowed_payment_methods.length === 0) {
      return true;
    }
    
    // Check if the selected payment method is in the allowed list
    return pass.allowed_payment_methods.includes(method);
  };

  // Get payment method display name for restrictions message
  const getPaymentMethodDisplayName = (method: string, lang: 'en' | 'fr'): string => {
    const names: Record<string, { en: string; fr: string }> = {
      'online': { en: 'Online Payment', fr: 'Paiement en ligne' },
      'external_app': { en: 'External App', fr: 'Application externe' },
      'ambassador_cash': { en: 'Cash on Delivery', fr: 'Paiement à la livraison' }
    };
    return names[method]?.[lang] || method;
  };

  // Update pass quantity (respects stock limits)
  const updatePassQuantity = (passId: string, quantity: number) => {
    const pass = event?.passes?.find(p => p.id === passId);
    if (!pass) return;

    // Check if pass is sold out
    if (pass.is_sold_out) {
      toast({
        title: t[language].error,
        description: language === 'en' 
          ? `"${pass.name}" is sold out` 
          : `"${pass.name}" est épuisé`,
        variant: "destructive",
      });
      return;
    }

    // Determine max quantity based on stock (remaining_quantity is always a number)
    const remaining = pass.remaining_quantity ?? 0;
    const maxAllowed = Math.min(10, remaining);

    const previousQuantity = selectedPasses[passId] || 0;
    const clampedQuantity = Math.max(0, Math.min(maxAllowed, quantity));
    const newPasses = { ...selectedPasses };
    
    if (clampedQuantity === 0) {
      delete newPasses[passId];
    } else {
      newPasses[passId] = clampedQuantity;
    }
    
    // Track first-time pass selection
    if (previousQuantity === 0 && clampedQuantity > 0 && event) {
      trackEvent('pass_select', {
        event_id: event.id,
        event_name: event.name,
        pass_id: pass.id,
        pass_name: pass.name,
        quantity: clampedQuantity,
        price: pass.price,
        language,
      });
    }

    setSelectedPasses(newPasses);
    // Note: useEffect will handle clearing payment method if it becomes incompatible
  };

  // Calculate total price (subtotal before any online payment fees; presale discount matches server)
  const calculateTotal = (): number => {
    if (presaleLineList.length === 0) return 0;
    return presaleLineList.reduce(
      (sum, l) =>
        sum + presaleAdjustedUnitPrice(l.unitList, l.passId, presaleDiscountPolicy) * l.qty,
      0
    );
  };

  // Get selected passes as array
  const getSelectedPassesArray = (): SelectedPass[] => {
    if (!event?.passes) return [];

    const passes: SelectedPass[] = [];
    Object.entries(selectedPasses).forEach(([passId, quantity]) => {
      if (quantity > 0) {
        const pass = event.passes?.find((p) => p.id === passId);
        if (pass) {
          passes.push({
            passId: pass.id,
            passName: pass.name,
            quantity,
            price: presaleAdjustedUnitPrice(pass.price, pass.id, presaleDiscountPolicy),
          });
        }
      }
    });
    return passes;
  };

  const validationCopy = passPurchaseValidationCopy(language);

  const runFullValidation = (): Record<string, string> => {
    const emailNorm = normalizeCommonEmailTypos(customerInfo.email);
    const confirmNorm = normalizeCommonEmailTypos(emailConfirm);
    return validatePassPurchaseFull({
      selectedPasses,
      customerInfo: { ...customerInfo, email: emailNorm },
      emailConfirm: confirmNorm,
      paymentMethod,
      selectedAmbassadorId,
      copy: validationCopy,
    });
  };

  const firstWizardStepForErrors = (errors: Record<string, string>): number | null => {
    if (errors.passes) return 1;
    if (errors.full_name || errors.phone) return 2;
    if (errors.email || errors.email_confirm) return 3;
    if (errors.city || errors.ville) return 4;
    if (errors.paymentMethod || errors.ambassador) return 5;
    return null;
  };

  /** EN/FR error message shown in toast. */
  const passPurchaseValidationToastDescription = (errors: Record<string, string>) => {
    const primary = firstPassPurchaseErrorMessage(errors);
    if (!primary) return t[language].fixFormErrors;
    return primary;
  };

  const navigateToStep = useCallback(
    (targetStep: number, opts?: { skipVisitedCheck?: boolean }) => {
      if (targetStep < 1 || targetStep > WIZARD_STEP_COUNT) return;
      if (targetStep === wizardStep) return;
      if (!opts?.skipVisitedCheck && targetStep > maxVisitedStep) return;

      if (wizardStep === WIZARD_STEP_COUNT && targetStep < WIZARD_STEP_COUNT) {
        checkoutBackFromPaymentRef.current = true;
        activeCheckoutAbortRef.current?.abort();
      }

      setValidationErrors({});
      setWizardStep(targetStep);
    },
    [wizardStep, maxVisitedStep]
  );

  const wizardStepLabels = useMemo(
    () => [
      t[language].passSelection,
      t[language].stepIdentity,
      t[language].stepEmail,
      t[language].stepLocation,
      t[language].stepPaymentSummary,
    ],
    [language, t]
  );

  const goNext = () => {
    const copy = validationCopy;
    let e: Record<string, string> = {};
    switch (wizardStep) {
      case 1:
        e = validatePassPurchasePasses(selectedPasses, copy.selectAtLeastOnePass);
        break;
      case 2:
        e = validatePassPurchaseIdentity(customerInfo, copy);
        break;
      case 3: {
        const emailNorm = normalizeCommonEmailTypos(customerInfo.email);
        const confirmNorm = normalizeCommonEmailTypos(emailConfirm);
        if (emailNorm !== customerInfo.email) {
          setCustomerInfo((prev) => ({ ...prev, email: emailNorm }));
        }
        if (confirmNorm !== emailConfirm) {
          setEmailConfirm(confirmNorm);
        }
        e = validatePassPurchaseEmailStep(emailNorm, confirmNorm, copy);
        break;
      }
      case 4:
        e = validatePassPurchaseLocation(customerInfo, copy);
        break;
      default:
        break;
    }
    if (Object.keys(e).length > 0) {
      setValidationErrors(e);
      wizardFieldsBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setValidationErrors({});
    const nextStep = Math.min(WIZARD_STEP_COUNT, wizardStep + 1);
    setMaxVisitedStep((prev) => Math.max(prev, nextStep));
    navigateToStep(nextStep, { skipVisitedCheck: true });
  };

  const goBack = () => {
    navigateToStep(Math.max(1, wizardStep - 1));
  };

  const validateForm = (): { valid: boolean; errors: Record<string, string> } => {
    const emailNorm = normalizeCommonEmailTypos(customerInfo.email);
    const confirmNorm = normalizeCommonEmailTypos(emailConfirm);
    if (emailNorm !== customerInfo.email || confirmNorm !== emailConfirm) {
      setCustomerInfo((prev) => ({ ...prev, email: emailNorm }));
      setEmailConfirm(confirmNorm);
    }
    const errors = runFullValidation();
    setValidationErrors(errors);
    return { valid: Object.keys(errors).length === 0, errors };
  };

  const isAbortLikeError = (err: unknown): boolean => {
    if (!err || typeof err !== 'object') return false;
    const name = (err as { name?: string }).name;
    return name === 'AbortError';
  };

  /** Checkout runs only from an explicit Proceed click, not implicit Enter on the outer form. */
  const runPassCheckout = async () => {
    if (wizardStep !== WIZARD_STEP_COUNT) return;

    setTermsAccepted(true);

    const { valid, errors: submitErrors } = validateForm();
    if (!valid) {
      const st = firstWizardStepForErrors(submitErrors);
      if (st) navigateToStep(st);
      toast({
        title: t[language].error,
        description: passPurchaseValidationToastDescription(submitErrors),
        variant: "destructive",
      });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          wizardFieldsBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
      return;
    }

    if (!paymentMethod) {
      toast({
        title: t[language].error,
        description: t[language].selectPaymentMethod,
        variant: "destructive",
      });
      return;
    }

    if (checkoutSubmitInFlightRef.current) return;
    checkoutSubmitInFlightRef.current = true;
    checkoutBackFromPaymentRef.current = false;

    const abortCtl = new AbortController();
    activeCheckoutAbortRef.current = abortCtl;
    const endCheckoutAttempt = () => {
      checkoutSubmitInFlightRef.current = false;
      if (activeCheckoutAbortRef.current === abortCtl) {
        activeCheckoutAbortRef.current = null;
      }
    };

    setProcessing(true);

    const selectedPassesArray = getSelectedPassesArray();
    if (!selectedPassesArray || selectedPassesArray.length === 0) {
      toast({
        title: t[language].error,
        description: t[language].selectAtLeastOnePass,
        variant: "destructive",
      });
      setProcessing(false);
      endCheckoutAttempt();
      return;
    }

    if (
      promoCheckoutAvailable &&
      checkoutPromoDraft.trim() &&
      promoPreview.status !== 'valid'
    ) {
      toast({
        title: t[language].error,
        description:
          language === 'en'
            ? 'Enter a valid promo code or remove it to continue.'
            : 'Entrez un code promo valide ou retirez-le pour continuer.',
        variant: 'destructive',
      });
      setProcessing(false);
      endCheckoutAttempt();
      return;
    }

    const totalPrice =
      promoPreview.status === 'valid'
        ? promoPreview.discountedSubtotal
        : calculateTotal();
    const totalQuantity = selectedPassesArray.reduce((sum, p) => sum + p.quantity, 0);
    if (totalPrice <= 0) {
      toast({
        title: t[language].error,
        description: t[language].selectAtLeastOnePass,
        variant: "destructive",
      });
      setProcessing(false);
      endCheckoutAttempt();
      return;
    }

    try {
      const metaEventId = createMetaEventId('purchase');
      const metaAttribution = getMetaAttributionContext();

      const idempotencyKey = uuidv4();
      let recaptchaToken: string | null = null;
      try {
        recaptchaToken = await executeRecaptchaForOrder();
      } catch (recaptchaErr: unknown) {
        if (recaptchaErr instanceof Error && recaptchaErr.message === 'RECAPTCHA_TIMEOUT') {
          toast({
            title: language === 'en' ? 'Verification timed out' : 'Vérification expirée',
            description: language === 'en'
              ? "Verification timed out. Please try again or open this page in your device's browser (e.g. Safari or Chrome) instead of the in-app browser."
              : "Vérification expirée. Veuillez réessayer ou ouvrir cette page dans le navigateur de votre appareil (ex. Safari ou Chrome) plutôt que dans le navigateur intégré.",
            variant: 'destructive',
          });
          setProcessing(false);
          endCheckoutAttempt();
          return;
        }
        throw recaptchaErr;
      }
      if (!isLocalhostClient() && !recaptchaToken) {
        toast({
          title: t[language].error,
          description: language === 'en' ? 'reCAPTCHA verification failed. Please try again.' : 'La vérification reCAPTCHA a échoué. Veuillez réessayer.',
          variant: 'destructive',
        });
        setProcessing(false);
        endCheckoutAttempt();
        return;
      }

      if (checkoutBackFromPaymentRef.current) {
        setProcessing(false);
        endCheckoutAttempt();
        return;
      }

      const customerInfoForOrder: CustomerInfo = {
        ...customerInfo,
        email: normalizeCommonEmailTypos(customerInfo.email),
      };
      const { order, metaTracking } = await createOrder(
        {
          customerInfo: customerInfoForOrder,
          passes: selectedPassesArray,
          paymentMethod,
          ambassadorId: paymentMethod === PaymentMethod.AMBASSADOR_CASH ? selectedAmbassadorId || undefined : undefined,
          eventId: event?.id || eventId || undefined,
          recaptchaToken: recaptchaToken ?? undefined,
          idempotencyKey,
          metaEventId,
          metaFbp: metaAttribution.fbp,
          metaFbc: metaAttribution.fbc,
          metaFbclid: metaAttribution.fbclid,
          metaEventSourceUrl: metaAttribution.eventSourceUrl,
          presaleCsrfToken:
            (serverPresaleRequired === true ||
              (serverPresaleRequired !== false && isPresaleEnabledOnEvent(event))) &&
            presaleCsrfToken
              ? presaleCsrfToken
              : undefined,
          promoCode: promoSubmitCode || undefined,
        },
        { signal: abortCtl.signal }
      );

      // Handle redirect based on payment method
      if (paymentMethod === PaymentMethod.ONLINE) {
        const onlineParams = {
          event_id: event?.id || eventId || undefined,
          event_name: event?.name,
          order_id: order.id,
          value: totalPrice,
          currency: 'TND' as const,
          payment_method: 'online' as const,
          total_quantity: totalQuantity,
          language,
          items: selectedPassesArray.map((p) => ({
            item_id: p.passId,
            item_name: p.passName,
            quantity: p.quantity,
            price: p.price,
          })),
        };
        trackEvent('order_submit_online', onlineParams);

        endCheckoutAttempt();
        navigate(`/payment-processing?orderId=${order.id}&init=1`, { replace: true });
      } else if (paymentMethod === PaymentMethod.EXTERNAL_APP) {
        // TODO: Wire processConfirmedTicketPurchaseTracking when external_app has a confirmed PAID signal.
        const option = paymentOptions.find(o => o.option_type === 'external_app');
        if (option?.external_link) {
          endCheckoutAttempt();
          window.location.href = option.external_link;
        } else {
          toast({
            title: t[language].error,
            description: language === 'en' ? 'External payment link not configured' : 'Lien de paiement externe non configuré',
            variant: "destructive",
          });
          setProcessing(false);
          endCheckoutAttempt();
        }
      } else if (paymentMethod === PaymentMethod.AMBASSADOR_CASH) {
        const ambassadorParams = {
          event_id: event?.id || eventId || undefined,
          event_name: event?.name,
          order_id: order.id,
          value: totalPrice,
          currency: 'TND' as const,
          payment_method: 'ambassador_cash' as const,
          total_quantity: totalQuantity,
          language,
          ambassador_id: selectedAmbassadorId || undefined,
          items: selectedPassesArray.map((p) => ({
            item_id: p.passId,
            item_name: p.passName,
            quantity: p.quantity,
            price: p.price,
          })),
        };
        trackEvent('order_submit_ambassador', ambassadorParams);

        if (metaTracking?.pixel && isValidTicketMetaPixelPayload(metaTracking.pixel)) {
          trackPurchaseFromBackend(metaTracking.pixel);
        }

        endCheckoutAttempt();
        setSubmitted(true);
      }
    } catch (error: unknown) {
      if (isAbortLikeError(error)) {
        setProcessing(false);
        endCheckoutAttempt();
        return;
      }
      console.error('Order submission error:', error);
      const orderErr = isPublicOrderError(error)
        ? mapPublicError({ error: error.code, message: error.message }, language)
        : mapThrownError(error, language);
      toast({
        title: orderErr.title,
        description: orderErr.description,
        variant: 'destructive',
      });
      setProcessing(false);
      endCheckoutAttempt();
    }
  };

  const countdownLeftLabel =
    language === "en"
      ? (countdownSettings?.label_en ?? COUNTDOWN_LABEL_DEFAULT_EN)
      : (countdownSettings?.label_fr ?? COUNTDOWN_LABEL_DEFAULT_FR);

  const passCountdownBanner =
    !presaleLocked &&
    event &&
    countdownSettingsReady &&
    countdownSettings?.enabled === true ? (
      <PassPurchaseCountdownStrip
        event={event}
        language={language}
        leftLabel={countdownLeftLabel}
        countdownEnabled={
          event.event_status !== 'completed' && event.event_status !== 'cancelled'
        }
        treatAsPresale={effectivePresaleForCountdown}
      />
    ) : null;

  if (loading) {
    return (
      <LoadingScreen 
        size="fullscreen" 
        text={language === 'en' ? "Loading..." : "Chargement..."}
      />
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Event Not Found</h2>
            <p className="text-muted-foreground mb-4">
              {language === 'en' 
                ? "The event you're looking for doesn't exist or has been removed."
                : "L'événement que vous recherchez n'existe pas ou a été supprimé."}
            </p>
            <Button onClick={() => navigate('/events')}>
              {t[language].backToEvents}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin closed sales (completed): clear message + link to gallery recap
  if (purchaseBlockedReason) {
    const recapSlug = (event.slug && String(event.slug).trim()) || generateSlug(event.name);
    const galleryUrl = `/gallery/${recapSlug}`;
    return (
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <Lock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">
              {language === 'en' ? 'Pass sales are closed' : 'Vente des passes fermée'}
            </h2>
            <p className="text-muted-foreground mb-6">
              {language === 'en'
                ? 'This event is complete. View the gallery for photos and the recap.'
                : 'Événement terminé. Consultez la galerie pour les photos et le récapitulatif.'}
            </p>
            <Button className="w-full sm:w-auto" onClick={() => navigate(galleryUrl)}>
              {language === 'en' ? 'View event gallery' : 'Voir la galerie'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (presaleLocked) {
    const purchasePath = eventSlug ? `/${eventSlug}` : '/pass-purchase';
    const purchaseTitle =
      language === 'en' ? `Presale – ${event.name} | Andiamo Events` : `Prévente – ${event.name} | Andiamo Events`;
    return (
      <main className="min-h-screen bg-gradient-dark flex flex-col pt-16" id="main-content">
        <PageMeta title={purchaseTitle} description={event.description?.slice(0, 155) ?? ''} path={purchasePath} />
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-12">
        <Card className="flex w-full max-w-md flex-col items-stretch text-left glass border-border/60">
          <CardHeader className="items-stretch text-left">
            <h2 className="w-full text-left text-2xl font-semibold font-heading leading-snug tracking-tight text-primary">
              {t[language].presaleTitle}
            </h2>
          </CardHeader>
          <CardContent className="flex flex-col items-stretch space-y-4 text-left">
            <p className="w-full text-left text-sm text-muted-foreground">{t[language].presaleHint}</p>
            <form onSubmit={handlePresaleRedeem} className="flex w-full flex-col items-stretch space-y-3 text-left">
              <Input
                type="text"
                name="presale-code"
                autoComplete="off"
                value={presaleCodeDraft}
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => setPresaleCodeDraft(e.target.value.toUpperCase())}
                placeholder={t[language].presalePlaceholder}
                className="bg-background/50 text-left"
              />
              <Button
                type="submit"
                disabled={presaleRedeeming}
                className={cn('w-full', presaleRedeeming && 'disabled:!opacity-100')}
              >
                {presaleRedeeming ? (
                  <>
                    <Loader size="sm" className="!bg-white shrink-0" />
                    {t[language].processing}
                  </>
                ) : (
                  t[language].presaleUnlock
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        </div>
      </main>
    );
  }

  // Calculate values that might be needed in early returns
  const baseSubtotal = calculateTotal();
  const isOnlinePayment = paymentMethod === PaymentMethod.ONLINE;
  const onlineFees =
    isOnlinePayment && baseSubtotal > 0 && promoPreview.status !== 'valid'
      ? computeOnlinePaymentFeesDisplay(baseSubtotal)
      : null;
  const promoPreviewActive = promoPreview.status === 'valid';
  const totalPrice = promoPreviewActive ? promoPreview.discountedSubtotal : baseSubtotal;
  const onlineFeeAmount = promoPreviewActive
    ? promoPreview.feeAmount
    : onlineFees?.feeAmount ?? 0;
  const totalWithFees = promoPreviewActive
    ? promoPreview.totalWithFees
    : onlineFees?.totalWithFees ?? baseSubtotal;
  const hasSelectedPasses = Object.values(selectedPasses).some(qty => qty > 0);
  const selectedPassesArray = getSelectedPassesArray();
  const promoBlocksSubmit =
    promoCheckoutAvailable &&
    checkoutPromoDraft.trim().length > 0 &&
    promoPreview.status !== 'valid';
  const step5ReadyToSubmit =
    hasSelectedPasses &&
    !!paymentMethod &&
    (paymentMethod !== PaymentMethod.AMBASSADOR_CASH || !!selectedAmbassadorId) &&
    !promoBlocksSubmit &&
    !(checkoutPromoDraft.trim() && promoPreview.status === 'loading');

  // Success overlay after ambassador cash order
  if (submitted) {
    return (
      <OrderSuccessScreen
        eventName={event.name}
        totalPrice={totalPrice}
        message={t[language].successMessageAmbassador}
        onBackToEvents={() => navigate("/events")}
        language={language}
      />
    );
  }

  const purchasePath = eventSlug ? `/${eventSlug}` : '/pass-purchase';
  const purchaseTitle = event ? `Buy Tickets – ${event.name} | Andiamo Events` : 'Buy Tickets | Andiamo Events';
  const purchaseDescription = event
    ? (event.description?.slice(0, 155) || `Get tickets for ${event.name} – ${event.venue}, ${event.city}.`)
    : 'Purchase event passes and tickets for Andiamo Events. Secure online payment. Tunisia.';

  return (
    <main className="min-h-screen bg-gradient-dark pt-[calc(4rem+var(--site-countdown-offset,0px))]" id="main-content">
      <PageMeta title={purchaseTitle} description={purchaseDescription} path={purchasePath} />
      {passCountdownBanner}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center sm:flex-row sm:items-center sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => navigate('/events')}
            className="hidden sm:inline-flex w-fit shrink-0 text-white hover:text-white/85 hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t[language].backToEvents}
          </Button>
          <h1 className="w-full text-center text-2xl font-heading font-bold uppercase leading-tight text-primary sm:ml-4 sm:w-auto sm:text-left sm:text-3xl">
            {t[language].title}
          </h1>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <PassPurchaseEventDetails event={event} language={language} />
            </div>

            {/* Seating map + purchase wizard */}
            <div className="flex flex-col gap-4 lg:col-span-2">
              {event.seating_chart_url?.trim() ? (
                <PassPurchaseSeatingChart
                  language={language}
                  imageUrl={event.seating_chart_url.trim()}
                />
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
                <span aria-live="polite">
                  {t[language].stepOf.replace('{n}', String(wizardStep)).replace('{total}', String(WIZARD_STEP_COUNT))}
                </span>
                <nav
                  className="flex gap-1.5 justify-center sm:justify-end"
                  aria-label={language === 'en' ? 'Purchase steps' : "Étapes d'achat"}
                >
                  {Array.from({ length: WIZARD_STEP_COUNT }, (_, i) => i + 1).map((n) => {
                    const isActive = n === wizardStep;
                    const isVisited = n <= maxVisitedStep;
                    const isClickable = isVisited && !isActive;
                    const segmentClass = cn(
                      'h-2 rounded-full transition-all duration-300 ease-out',
                      isActive ? 'w-8 sm:w-10 bg-primary' : 'w-6 sm:w-8',
                      isVisited && !isActive ? 'bg-primary/45' : !isActive && 'bg-muted'
                    );

                    if (isClickable) {
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => navigateToStep(n)}
                          className={cn(
                            segmentClass,
                            'cursor-pointer hover:bg-primary/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
                          )}
                          aria-label={
                            language === 'en'
                              ? `Go to step ${n}: ${wizardStepLabels[n - 1]}`
                              : `Aller à l'étape ${n} : ${wizardStepLabels[n - 1]}`
                          }
                        />
                      );
                    }

                    return (
                      <span
                        key={n}
                        className={segmentClass}
                        aria-current={isActive ? 'step' : undefined}
                        aria-label={wizardStepLabels[n - 1]}
                      />
                    );
                  })}
                </nav>
              </div>

              <Card
                ref={wizardFieldsBoxRef}
                className={cn(
                  'glass scroll-mt-24',
                  wizardStep === 5 && 'border-2 border-primary/30'
                )}
              >
                <CardHeader>
                  <CardTitle
                    key={wizardStep}
                    className={cn(
                      'text-primary animate-in fade-in duration-200',
                      wizardStep <= 4 && 'leading-snug'
                    )}
                  >
                    {wizardStepLabels[wizardStep - 1]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PassPurchaseWizardStep step={wizardStep} maxMountedStep={maxVisitedStep}>
                  <PassPurchaseWizardPanel step={1}>
                  <div className="space-y-4">
                  {event.passes && event.passes.length > 0 ? (
                    <div className={`${event.passes.length === 1 ? 'flex justify-center' : 'grid grid-cols-1 md:grid-cols-2'} gap-4`}>
                      {event.passes.map((pass: any) => {
                        const quantity = selectedPasses[pass.id] || 0;
                        const isSoldOut = pass.is_sold_out || false;
                        const remainingQuantity = pass.remaining_quantity ?? 0;
                        const maxAllowed = Math.min(10, remainingQuantity);
                        const isLowStock = !isSoldOut && remainingQuantity <= 5;
                        const displayUnitPrice = presaleAdjustedUnitPrice(
                          pass.price,
                          pass.id,
                          presaleDiscountPolicy
                        );
                        const showPresaleStrike =
                          presaleDiscountPolicy != null &&
                          roundPresaleMoneyDisplay(displayUnitPrice) < roundPresaleMoneyDisplay(pass.price);
                        
                        // Check if pass is compatible with selected payment method (UX only - backend is authoritative)
                        const isCompatible = isPassCompatibleWithPaymentMethod(pass, paymentMethod);
                        const isIncompatible = paymentMethod !== null && !isCompatible;
                        
                        return (
                          <div 
                            key={pass.id}
                            className={`border rounded-lg p-4 space-y-4 transition-all duration-200 ${
                              event.passes!.length === 1 ? 'w-full max-w-md' : ''
                            } ${
                              isSoldOut 
                                ? 'opacity-45 grayscale-[0.3] pointer-events-none cursor-not-allowed blur-[0.5px]' 
                                : isIncompatible
                                ? 'opacity-60 border-muted-foreground/50'
                                : 'hover:border-primary/50'
                            }`}
                          >
                            <div>
                              <div className="mb-1">
                                <h3 className={`text-lg font-semibold ${isSoldOut ? 'text-muted-foreground' : ''}`}>
                                  {pass.name}
                                </h3>
                              </div>
                              <p className={`text-2xl font-bold ${isSoldOut ? 'text-muted-foreground' : 'text-primary'}`}>
                                {showPresaleStrike ? (
                                  <>
                                    <span>{displayUnitPrice} TND</span>
                                    <span className="line-through text-muted-foreground text-lg font-semibold ml-2">
                                      {pass.price} TND
                                    </span>
                                  </>
                                ) : (
                                  <>{displayUnitPrice} TND</>
                                )}
                              </p>
                              {pass.description && (
                                <p className={`text-sm mt-1 ${isSoldOut ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                                  {pass.description}
                                </p>
                              )}
                              {/* Stock warning - ONLY show when stock is low (≤ 5) */}
                              {isLowStock && !isIncompatible && (
                                <p className="text-sm text-orange-500 font-semibold mt-2 flex items-center gap-1">
                                  <span>⚠️</span>
                                  <span>
                                    {language === 'en' 
                                      ? `Only ${remainingQuantity} left!` 
                                      : `Il ne reste que ${remainingQuantity}!`}
                                  </span>
                                </p>
                              )}
                            </div>
                            
                            {/* Quantity controls - HIDE for sold-out or incompatible passes */}
                            {!isSoldOut && !isIncompatible ? (
                              <div className="flex items-center justify-between">
                                <span className="text-sm">{t[language].quantity}</span>
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={quantity <= 0}
                                    onClick={() => updatePassQuantity(pass.id, quantity - 1)}
                                  >
                                    -
                                  </Button>
                                  <span className="w-12 text-center font-semibold">
                                    {quantity}
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={quantity >= maxAllowed}
                                    onClick={() => updatePassQuantity(pass.id, quantity + 1)}
                                  >
                                    +
                                  </Button>
                                </div>
                              </div>
                            ) : isIncompatible ? (
                              <div className="flex items-center justify-center py-2">
                                <span className="text-sm font-medium text-amber-500">
                                  {language === 'en' ? 'Available only with online payment by AIO Events.' : 'Disponible uniquement avec le paiement en ligne par AIO Events.'}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center py-2">
                                <span className="shrink-0 whitespace-nowrap px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white rounded shadow-sm border border-red-700/90 inline-flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5 shrink-0" />
                                  {language === 'en' ? 'SOLD OUT' : 'ÉPUISÉ'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {language === 'en' ? 'No passes available for this event' : 'Aucun pass disponible pour cet événement'}
                    </div>
                  )}
                  {validationErrors.passes && (
                    <p className="text-red-500 text-sm mt-4">{validationErrors.passes}</p>
                  )}
                  </div>
                  </PassPurchaseWizardPanel>

                  <PassPurchaseWizardPanel step={2}>
                    <CustomerInfoForm
                      customerInfo={customerInfo}
                      onChange={setCustomerInfo}
                      errors={validationErrors}
                      language={language}
                      sections="identity"
                    />
                  </PassPurchaseWizardPanel>

                  <PassPurchaseWizardPanel step={3}>
                    <CustomerInfoForm
                      customerInfo={customerInfo}
                      onChange={setCustomerInfo}
                      errors={validationErrors}
                      language={language}
                      sections="email"
                      emailConfirm={emailConfirm}
                      onEmailConfirmChange={setEmailConfirm}
                    />
                  </PassPurchaseWizardPanel>

                  <PassPurchaseWizardPanel step={4}>
                    <CustomerInfoForm
                      customerInfo={customerInfo}
                      onChange={setCustomerInfo}
                      errors={validationErrors}
                      language={language}
                      sections="location"
                    />
                  </PassPurchaseWizardPanel>

                  <PassPurchaseWizardPanel step={5}>
                  <div className="space-y-6">
                  {loadingPaymentOptions ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {language === 'en' ? 'Loading payment options...' : 'Chargement des options de paiement...'}
                    </div>
                  ) : paymentOptions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="mb-2">
                        {language === 'en' 
                          ? 'No payment options are currently enabled.' 
                          : 'Aucune option de paiement n\'est actuellement activée.'}
                      </p>
                      <p className="text-sm">
                        {language === 'en' 
                          ? 'Please contact an administrator to enable payment options.' 
                          : 'Veuillez contacter un administrateur pour activer les options de paiement.'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <PaymentOptionSelector
                        options={paymentOptions}
                        selectedMethod={paymentMethod}
                        customerInfo={customerInfo}
                        selectedPasses={selectedPasses}
                        eventPasses={event?.passes || []}
                        onSelect={(method) => {
                          setPaymentMethod(method);
                          // Clear validation errors when selecting
                          if (validationErrors.paymentMethod) {
                            setValidationErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors.paymentMethod;
                              return newErrors;
                            });
                          }
                        }}
                        onExternalAppClick={async () => {
                          // Validate customer info only (pass selection not required)
                          const emailNorm = normalizeCommonEmailTypos(customerInfo.email);
                          const confirmNorm = normalizeCommonEmailTypos(emailConfirm);
                          if (emailNorm !== customerInfo.email) {
                            setCustomerInfo((prev) => ({ ...prev, email: emailNorm }));
                          }
                          if (confirmNorm !== emailConfirm) {
                            setEmailConfirm(confirmNorm);
                          }
                          const errors = validatePassPurchaseCustomer(
                            { ...customerInfo, email: emailNorm },
                            confirmNorm,
                            validationCopy
                          );

                          if (Object.keys(errors).length > 0) {
                            setValidationErrors(errors);
                            const st = firstWizardStepForErrors(errors);
                            if (st) navigateToStep(st);
                            toast({
                              title: t[language].error,
                              description: passPurchaseValidationToastDescription(errors),
                              variant: "destructive",
                            });
                            return;
                          }

                          setProcessing(true);

                          const selectedPassesArray = getSelectedPassesArray();
                          const totalPrice = calculateTotal();
                          const totalQuantity = selectedPassesArray.reduce((sum, pass) => sum + pass.quantity, 0);

                          try {

                            // Prepare event info
                            const eventInfo = event ? {
                              id: event.id,
                              name: event.name,
                              date: event.date,
                              venue: event.venue,
                              city: event.city
                            } : null;

                            // Save submission to AIO Events (no order creation, no emails/SMS)
                            const apiBase = getApiBaseUrl();
                            const response = await fetch(`${apiBase}${API_ROUTES.AIO_EVENTS_SAVE_SUBMISSION}`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({
                                customerInfo: {
                                  ...customerInfo,
                                  email: normalizeCommonEmailTypos(customerInfo.email),
                                },
                                eventInfo,
                                selectedPasses: selectedPassesArray,
                                totalPrice: totalPrice,
                                totalQuantity: totalQuantity,
                                language
                              })
                            });

                            const result = await response.json();

                            if (!response.ok) {
                              throw new Error(result.error || result.message || 'submission_failed');
                            }

                            // After saving, redirect to external payment link
                            const option = paymentOptions.find(o => o.option_type === 'external_app');
                            if (option?.external_link) {
                              window.location.href = option.external_link;
                            } else {
                              toast({
                                title: t[language].error,
                                description: language === 'en' ? 'External payment link not configured' : 'Lien de paiement externe non configuré',
                                variant: "destructive",
                              });
                              setProcessing(false);
                            }
                          } catch (error: unknown) {
                            console.error('AIO Events submission error:', error);
                            const mapped = mapThrownError(error, language);
                            toast({
                              title: mapped.title,
                              description: mapped.description,
                              variant: "destructive",
                            });
                            setProcessing(false);
                          }
                        }}
                        language={language}
                      />
                      {validationErrors.paymentMethod && (
                        <p className="text-red-500 text-sm mt-4">{validationErrors.paymentMethod}</p>
                      )}
                    </>
                  )}
                  {paymentMethod === PaymentMethod.AMBASSADOR_CASH && (
                    <div className="space-y-3 pt-2">
                      <AmbassadorSelector
                        city={customerInfo.city}
                        ville={customerInfo.ville}
                        cityWide={ambassadorCityWide}
                        selectedAmbassadorId={selectedAmbassadorId}
                        onSelect={(id) => {
                          setSelectedAmbassadorId(id);
                          if (validationErrors.ambassador) {
                            setValidationErrors((prev) => {
                              const next = { ...prev };
                              delete next.ambassador;
                              return next;
                            });
                          }
                        }}
                        language={language}
                      />
                      {validationErrors.ambassador && (
                        <p className="text-red-500 text-sm mt-1">{validationErrors.ambassador}</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-4 border-t border-border/40 pt-6 mt-2">
                    {promoCheckoutAvailable && wizardStep === WIZARD_STEP_COUNT && (
                      <PromoCodeField
                        language={language}
                        value={checkoutPromoDraft}
                        onChange={setCheckoutPromoDraft}
                        preview={promoPreview}
                        disabled={processing}
                      />
                    )}
                    <OrderSummary
                      selectedPasses={selectedPassesArray}
                      totalPrice={totalPrice}
                      paymentMethod={paymentMethod}
                      termsAccepted={termsAccepted}
                      onTermsChange={setTermsAccepted}
                      language={language}
                      feeAmount={onlineFeeAmount}
                      totalWithFees={totalWithFees}
                      promoCode={promoPreviewActive ? promoPreview.code : undefined}
                      promoDiscountAmount={
                        promoPreviewActive ? promoPreview.discountAmount : undefined
                      }
                      subtotalBeforePromo={
                        promoPreviewActive ? promoPreview.subtotalBeforePromo : undefined
                      }
                    />

                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground text-center">
                        {language === 'en' ? (
                          <>
                            By submitting this order, you accept our{' '}
                            <Link
                              to="/terms"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline underline-offset-2"
                            >
                              Terms and General Conditions of Sale
                            </Link>
                            .
                          </>
                        ) : (
                          <>
                            En soumettant cette commande, vous acceptez nos{' '}
                            <Link
                              to="/terms"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline underline-offset-2"
                            >
                              Terms et conditions générales de vente
                            </Link>
                            .
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  </div>
                  </PassPurchaseWizardPanel>

                  </PassPurchaseWizardStep>

                  <div
                    ref={step5SubmitScrollRef}
                    className="mt-8 pt-6 border-t border-border/40 space-y-3 scroll-mt-24"
                  >
                    {wizardStep === WIZARD_STEP_COUNT &&
                      !processing &&
                      hasSelectedPasses &&
                      !step5ReadyToSubmit && (
                        <p className="text-sm text-muted-foreground text-center sm:text-right">
                          {t[language].completePaymentToSubmit}
                        </p>
                      )}
                    <div
                      className={cn(
                        'flex gap-3 sm:flex-row sm:items-center',
                        wizardStep > 1 ? 'flex-col-reverse' : 'flex-col'
                      )}
                    >
                    {wizardStep > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={goBack}
                        className="w-full sm:w-auto border-border hover:bg-muted/50 hover:text-foreground"
                      >
                        {t[language].back}
                      </Button>
                    )}
                    {wizardStep < WIZARD_STEP_COUNT ? (
                      <Button
                        type="button"
                        onClick={goNext}
                        className="w-full sm:ml-auto sm:w-auto btn-gradient"
                      >
                        {t[language].next}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        disabled={processing || !step5ReadyToSubmit}
                        className={cn(
                          'w-full sm:ml-auto sm:w-auto btn-gradient disabled:opacity-50',
                          processing && 'disabled:!opacity-100'
                        )}
                        onClick={() => {
                          void runPassCheckout();
                        }}
                      >
                        {processing ? (
                          <>
                            <Loader size="sm" className="mr-2 shrink-0 !bg-white" />
                            {t[language].processing}
                          </>
                        ) : paymentMethod === PaymentMethod.ONLINE ? (
                          t[language].proceedToPayment
                        ) : (
                          t[language].submitOrder
                        )}
                      </Button>
                    )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
};

export default PassPurchase;
