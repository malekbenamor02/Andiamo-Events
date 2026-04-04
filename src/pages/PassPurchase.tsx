import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, MapPin, Users, ArrowLeft, CheckCircle, XCircle, Lock } from 'lucide-react';
import { ExpandableText } from '@/components/ui/expandable-text';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';
import Loader from '@/components/ui/Loader';
import { getApiBaseUrl, API_ROUTES } from '@/lib/api-routes';
import { formatDateDMY, isPassPurchaseWindowClosed } from '@/lib/date-utils';
import { generateSlug } from '@/lib/utils';

// New unified order system components
import { CustomerInfoForm } from '@/components/orders/CustomerInfoForm';
import { PaymentOptionSelector } from '@/components/orders/PaymentOptionSelector';
import { AmbassadorSelector } from '@/components/orders/AmbassadorSelector';
import { OrderSummary } from '@/components/orders/OrderSummary';
import { OrderSuccessScreen } from '@/components/orders/OrderSuccessScreen';
import { usePaymentOptions } from '@/hooks/usePaymentOptions';
import { useActiveAmbassadors } from '@/hooks/useActiveAmbassadors';
import { PaymentMethod } from '@/lib/constants/orderStatuses';
import { CustomerInfo, SelectedPass, Ambassador } from '@/types/orders';
import { createOrder } from '@/lib/orders/orderService';
import { PageMeta } from '@/components/PageMeta';
import { trackEvent } from '@/lib/ga';
import { trackMetaEvent, trackMetaViewContent, trackMetaInitiateCheckout } from '@/lib/meta';
import { createMetaEventId, getMetaAttributionContext } from '@/lib/metaAttribution';

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
  passes?: EventPass[];
  capacity?: number;
  age_restriction?: number;
  dress_code?: string;
  special_notes?: string;
  is_test?: boolean;
  event_status?: string;
  event_type?: string;
  slug?: string | null;
}

interface PassPurchaseProps {
  language: 'en' | 'fr';
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
  
  // Fetch payment options
  const { data: paymentOptions = [], isLoading: loadingPaymentOptions } = usePaymentOptions();
  
  // Fetch active ambassadors to get full details (including social_link)
  const { data: activeAmbassadors = [] } = useActiveAmbassadors(
    customerInfo.city, 
    customerInfo.ville
  );

  const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  // Load reCAPTCHA v3 script for order creation
  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY || typeof window === 'undefined') return;
    if ((window as any).grecaptcha) return;
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      const existing = document.querySelector('script[src*="recaptcha/api.js"]');
      if (existing?.parentNode) existing.parentNode.removeChild(existing);
      const badge = document.querySelector('.grecaptcha-badge') as HTMLElement | null;
      if (badge?.parentNode) badge.parentNode.removeChild(badge);
      delete (window as any).grecaptcha;
    };
  }, [RECAPTCHA_SITE_KEY]);

  const RECAPTCHA_TIMEOUT_MS = 15000;

  const executeRecaptchaForOrder = async (): Promise<string | null> => {
    const isLocalhost = window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.0.') ||
      window.location.hostname.startsWith('172.');
    if (isLocalhost) return 'localhost-bypass-token';
    if (!RECAPTCHA_SITE_KEY || !(window as any).grecaptcha) return null;
    try {
      const executePromise = (window as any).grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'order_create' });
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
    if (selectedAmbassadorId && activeAmbassadors.length > 0) {
      const ambassador = activeAmbassadors.find(a => a.id === selectedAmbassadorId);
      setSelectedAmbassadorDetails(ambassador || null);
    } else {
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
      trackMetaEvent('PassPurchaseVisit', {
        event_id: event.id,
        event_name: event.name,
        language,
        page_path: page_path ?? undefined,
      });
      trackMetaViewContent({
        content_type: 'product_group',
        content_ids: [event.id],
        content_name: event.name,
      });
    }
  }, [event?.id, purchaseBlockedReason, language, event?.name]);

  const t = {
    en: {
      title: "Purchase Pass",
      backToEvents: "Back to Events",
      eventDetails: "Event Details",
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
      orderDetails: "Order Details"
    },
    fr: {
      title: "Acheter un Pass",
      backToEvents: "Retour aux Événements",
      eventDetails: "Détails de l'Événement",
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
      orderDetails: "Détails de la Commande"
    }
  };

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
      
      // Check if we're on localhost (for testing) or production
      const isLocalhost = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.0.') ||
        window.location.hostname.startsWith('172.')
      );

      let eventData: any = null;
      let eventError: any = null;
      let resolvedEventId: string | null = null;

      // Fetch event by slug or eventId
      if (eventSlug) {
        // New friendly URL: fetch by slug
        const normalizedSlug = decodeURIComponent(eventSlug).toLowerCase().trim();
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('slug', normalizedSlug)
          .single();
        
        eventData = data;
        eventError = error;
        if (data) {
          resolvedEventId = data.id;
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

      // Block test events on production (not localhost)
      if (!isLocalhost && event?.is_test) {
        // Redirect to home page or show error
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

      // Check if event is cancelled
      if (event?.event_status === 'cancelled') {
        toast({
          title: t[language].error,
          description: language === 'en' 
            ? 'This event has been cancelled.' 
            : 'Cet événement a été annulé.',
          variant: 'destructive'
        });
        setEvent(null);
        setLoading(false);
        return;
      }

      // Block pass purchase when admin marked completed or cancelled (cancelled handled above)
      if (isPassPurchaseWindowClosed(event.date, event.event_status)) {
        setPurchaseBlockedReason('completed');
        setEvent({ ...event, passes: [] });
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

      // Fetch passes from server endpoint (includes stock information)
      let passes: any[] = [];
      try {
        // Use getApiBaseUrl() for consistent API routing
        const apiBase = getApiBaseUrl();
        if (!resolvedEventId) {
          throw new Error('Event ID not resolved');
        }
        const passesResponse = await fetch(`${apiBase}/api/passes/${resolvedEventId}`);
        
        if (passesResponse.ok) {
          const passesResult = await passesResponse.json();
          const passesData = passesResult.passes || [];

          // Map passes with stock information
          passes = passesData.map((p: any) => ({
            id: p.id,
            name: p.name || '',
            price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
            description: p.description || '',
            is_primary: p.is_primary || false,
            // Stock information
            max_quantity: p.max_quantity,
            sold_quantity: p.sold_quantity || 0,
            remaining_quantity: p.remaining_quantity,
            is_unlimited: p.is_unlimited || false,
            is_sold_out: p.is_sold_out || false,
            // Payment method restrictions (UX only - backend is authoritative)
            allowed_payment_methods: p.allowed_payment_methods || null
          }));
        } else {
          // Passes fetch failed, but we still show the event
          const errorText = await passesResponse.text();
          let errorData;
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText };
          }
          console.error('❌ Failed to fetch passes for event:', resolvedEventId, {
            status: passesResponse.status,
            statusText: passesResponse.statusText,
            error: errorData
          });
          toast({
            title: language === 'en' ? 'Warning' : 'Avertissement',
            description: language === 'en' 
              ? `Event loaded but passes could not be loaded (${passesResponse.status}). Please try again later.` 
              : `Événement chargé mais les passes n'ont pas pu être chargées (${passesResponse.status}). Veuillez réessayer plus tard.`,
            variant: "destructive",
          });
        }
      } catch (passError: any) {
        // Passes fetch error, but we still show the event
        console.error('❌ Error fetching passes for event:', resolvedEventId, passError);
        toast({
          title: language === 'en' ? 'Warning' : 'Avertissement',
          description: language === 'en' 
            ? `Event loaded but passes could not be loaded: ${passError.message || 'Network error'}. Please try again later.` 
            : `Événement chargé mais les passes n'ont pas pu être chargées: ${passError.message || 'Erreur réseau'}. Veuillez réessayer plus tard.`,
          variant: "destructive",
        });
      }

      // Set event with passes (even if empty array)
      setEvent({
        ...event,
        passes: passes
      });

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
      trackMetaEvent('PassSelect', {
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

  // Calculate total price (subtotal before any online payment fees)
  const calculateTotal = (): number => {
    if (!event?.passes) return 0;
    
    let total = 0;
    Object.entries(selectedPasses).forEach(([passId, quantity]) => {
      const pass = event.passes?.find(p => p.id === passId);
      if (pass && quantity > 0) {
        total += pass.price * quantity;
      }
    });
    return total;
  };

  // Get selected passes as array
  const getSelectedPassesArray = (): SelectedPass[] => {
    if (!event?.passes) return [];
    
    const passes: SelectedPass[] = [];
    Object.entries(selectedPasses).forEach(([passId, quantity]) => {
      if (quantity > 0) {
        const pass = event.passes?.find(p => p.id === passId);
        if (pass) {
          passes.push({
            passId: pass.id,
            passName: pass.name,
            quantity,
            price: pass.price
          });
        }
      }
    });
    return passes;
  };

  // Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Check at least one pass selected
    const hasSelectedPass = Object.values(selectedPasses).some(qty => qty > 0);
    if (!hasSelectedPass) {
      errors.passes = t[language].selectAtLeastOnePass;
    }

    // Validate customer info (required for all payment methods)
    if (!customerInfo.full_name.trim() || customerInfo.full_name.trim().length < 2) {
      errors.full_name = language === 'en' ? 'Please enter a valid name' : 'Veuillez entrer un nom valide';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customerInfo.email.trim() || !emailRegex.test(customerInfo.email)) {
      errors.email = language === 'en' ? 'Please enter a valid email' : 'Veuillez entrer un email valide';
    }

    const phoneRegex = /^[2594][0-9]{7}$/;
    if (!customerInfo.phone.trim() || !phoneRegex.test(customerInfo.phone)) {
      errors.phone = language === 'en' ? 'Invalid phone number format' : 'Format de numéro invalide';
    }

    if (!customerInfo.city.trim()) {
      errors.city = t[language].required;
    }

    // Validate payment method
    if (!paymentMethod) {
      errors.paymentMethod = t[language].selectPaymentMethod;
    }

    // Validate ambassador selection for ambassador_cash
    if (paymentMethod === PaymentMethod.AMBASSADOR_CASH) {
      if (!selectedAmbassadorId) {
        errors.ambassador = language === 'en' ? 'Please select an ambassador' : 'Veuillez sélectionner un ambassadeur';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Automatically accept terms when submitting
    setTermsAccepted(true);

    if (!validateForm()) {
      toast({
        title: t[language].error,
        description: t[language].fixFormErrors,
        variant: "destructive",
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

    setProcessing(true);

    const selectedPassesArray = getSelectedPassesArray();
    if (!selectedPassesArray || selectedPassesArray.length === 0) {
      toast({
        title: t[language].error,
        description: t[language].selectAtLeastOnePass,
        variant: "destructive",
      });
      setProcessing(false);
      return;
    }

    const totalPrice = calculateTotal();
    const totalQuantity = selectedPassesArray.reduce((sum, p) => sum + p.quantity, 0);
    if (totalPrice <= 0) {
      toast({
        title: t[language].error,
        description: t[language].selectAtLeastOnePass,
        variant: "destructive",
      });
      setProcessing(false);
      return;
    }

    try {
      const metaEventId = createMetaEventId('purchase');
      const metaAttribution = getMetaAttributionContext();
      trackMetaInitiateCheckout({
        value: totalPrice,
        currency: 'TND',
        num_items: totalQuantity,
        content_ids: selectedPassesArray.map((p) => p.passId),
        content_type: 'product',
      });

      const idempotencyKey = crypto.randomUUID();
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
          return;
        }
        throw recaptchaErr;
      }
      const isLocalhost = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.0.') ||
        window.location.hostname.startsWith('172.');
      if (!isLocalhost && !recaptchaToken) {
        toast({
          title: t[language].error,
          description: language === 'en' ? 'reCAPTCHA verification failed. Please try again.' : 'La vérification reCAPTCHA a échoué. Veuillez réessayer.',
          variant: 'destructive',
        });
        setProcessing(false);
        return;
      }
      const order = await createOrder({
        customerInfo,
        passes: selectedPassesArray,
        paymentMethod,
        ambassadorId: paymentMethod === PaymentMethod.AMBASSADOR_CASH ? selectedAmbassadorId || undefined : undefined,
        eventId: event?.id || eventId || undefined,
        recaptchaToken: recaptchaToken ?? undefined,
        idempotencyKey,
        metaEventId,
        metaFbp: metaAttribution.fbp,
        metaFbc: metaAttribution.fbc,
        metaEventSourceUrl: metaAttribution.eventSourceUrl,
      });

      // Handle redirect based on payment method
      if (paymentMethod === PaymentMethod.ONLINE) {
        // Track online payment order
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
        trackMetaEvent('OrderSubmitOnline', onlineParams);

        // Redirect to payment processing (ClicToPay flow)
        const passIds = selectedPassesArray.map((p) => p.passId).join(',');
        const redirectUrl =
          `/payment-processing?orderId=${order.id}` +
          `&init=1&meta_event_id=${encodeURIComponent(metaEventId)}` +
          `&value=${encodeURIComponent(String(totalPrice))}` +
          `&qty=${encodeURIComponent(String(totalQuantity))}` +
          `&pass_ids=${encodeURIComponent(passIds)}`;
        navigate(redirectUrl, { replace: true });
      } else if (paymentMethod === PaymentMethod.EXTERNAL_APP) {
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
      } else if (paymentMethod === PaymentMethod.AMBASSADOR_CASH) {
        // Track ambassador payment order
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
        trackMetaEvent('OrderSubmitAmbassador', ambassadorParams);

        toast({
          title: t[language].success,
          description: t[language].successMessageAmbassador,
          variant: "default",
        });
        setSubmitted(true);
      }
    } catch (error: any) {
      console.error('Order submission error:', error);
      const errorMessage = error.message || (language === 'en' ? 'Failed to submit order' : 'Échec de la soumission de la commande');
      toast({
        title: t[language].error,
        description: errorMessage,
        variant: "destructive",
      });
      setProcessing(false);
    }
  };

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

  // Calculate values that might be needed in early returns
  const totalPrice = calculateTotal();
  const isOnlinePayment = paymentMethod === PaymentMethod.ONLINE;
  const onlineFeeAmount =
    isOnlinePayment && totalPrice > 0
      ? Number((totalPrice * 0.05).toFixed(3))
      : 0;
  const totalWithFees = isOnlinePayment ? totalPrice + onlineFeeAmount : totalPrice;
  const hasSelectedPasses = Object.values(selectedPasses).some(qty => qty > 0);
  const selectedPassesArray = getSelectedPassesArray();

  // Success screen - show OrderSuccessScreen for ambassador cash, simple message for others
  if (submitted) {
    if (paymentMethod === PaymentMethod.AMBASSADOR_CASH && selectedAmbassadorDetails) {
      return (
        <OrderSuccessScreen
          ambassador={selectedAmbassadorDetails}
          eventName={event.name}
          eventDate={event.date}
          totalPrice={isOnlinePayment ? totalWithFees : totalPrice}
          passes={selectedPassesArray}
          onBackToEvents={() => navigate('/events')}
          language={language}
        />
      );
    }
    
    // Fallback for other payment methods
    return (
      <div className="min-h-screen bg-gradient-dark pt-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="glass border-2 border-green-500/30">
            <CardContent className="p-8 text-center">
              <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-gradient-neon mb-4">
                {t[language].thankYou}
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                {t[language].successMessageOnline}
              </p>
              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">{t[language].orderDetails}</p>
                  <p className="font-semibold">{event.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateDMY(event.date, language)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t[language].total}</p>
                  <p className="text-2xl font-bold text-primary">
                    {isOnlinePayment ? totalWithFees : totalPrice} TND
                  </p>
                </div>
              </div>
              <Button onClick={() => navigate('/events')} className="w-full">
                {t[language].backToEvents}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const purchasePath = eventSlug ? `/${eventSlug}` : '/pass-purchase';
  const purchaseTitle = event ? `Buy Tickets – ${event.name} | Andiamo Events` : 'Buy Tickets | Andiamo Events';
  const purchaseDescription = event
    ? (event.description?.slice(0, 155) || `Get tickets for ${event.name} – ${event.venue}, ${event.city}.`)
    : 'Purchase event passes and tickets for Andiamo Events. Secure online payment. Tunisia.';

  return (
    <main className="min-h-screen bg-gradient-dark pt-16" id="main-content">
      <PageMeta title={purchaseTitle} description={purchaseDescription} path={purchasePath} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center sm:flex-row sm:items-center sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => navigate('/events')}
            className="hidden sm:inline-flex w-fit shrink-0 text-white hover:text-primary hover:bg-transparent"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t[language].backToEvents}
          </Button>
          <h1 className="w-full text-center text-2xl font-heading font-bold uppercase leading-tight text-gradient-neon sm:ml-4 sm:w-auto sm:text-left sm:text-3xl">
            {t[language].title}
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Event Details */}
            <div className="lg:col-span-1">
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-gradient-neon">{t[language].eventDetails}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {event.poster_url && (
                    <img
                      src={event.poster_url}
                      alt={event.name}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  )}
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-primary mb-3">{event.name}</h3>
                    {event.description && (
                      <div className="mb-4">
                        <ExpandableText
                          text={event.description}
                          maxLength={150}
                          className="text-foreground text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words"
                          showMoreText={language === 'en' ? 'Show more' : 'Voir plus'}
                          showLessText={language === 'en' ? 'Show less' : 'Voir moins'}
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2 text-primary" />
                      <span>{formatDateDMY(event.date, language)}</span>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-2 text-primary" />
                      <span>{event.venue}, {event.city}</span>
                    </div>
                    {event.capacity && (
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-2 text-primary" />
                        <span>{event.capacity} {language === 'en' ? 'spots' : 'places'}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* STEP 1: Pass Selection */}
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-gradient-neon">{t[language].passSelection}</CardTitle>
                </CardHeader>
                <CardContent>
                  {event.passes && event.passes.length > 0 ? (
                    <div className={`${event.passes.length === 1 ? 'flex justify-center' : 'grid grid-cols-1 md:grid-cols-2'} gap-4`}>
                      {event.passes.map((pass: any) => {
                        const quantity = selectedPasses[pass.id] || 0;
                        const isSoldOut = pass.is_sold_out || false;
                        const remainingQuantity = pass.remaining_quantity ?? 0;
                        const maxAllowed = Math.min(10, remainingQuantity);
                        const isLowStock = !isSoldOut && remainingQuantity <= 5;
                        
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
                                {pass.price} TND
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
                </CardContent>
              </Card>

              {/* STEP 2: Customer Information */}
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-gradient-neon">{t[language].customerInfo}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CustomerInfoForm
                    customerInfo={customerInfo}
                    onChange={setCustomerInfo}
                    errors={validationErrors}
                    language={language}
                  />
                </CardContent>
              </Card>

              {/* STEP 3: Payment Options */}
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-gradient-neon">{t[language].payment}</CardTitle>
                </CardHeader>
                <CardContent>
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
                          const errors: Record<string, string> = {};

                          // Validate customer info
                          if (!customerInfo.full_name.trim() || customerInfo.full_name.trim().length < 2) {
                            errors.full_name = language === 'en' ? 'Please enter a valid name' : 'Veuillez entrer un nom valide';
                          }

                          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                          if (!customerInfo.email.trim() || !emailRegex.test(customerInfo.email)) {
                            errors.email = language === 'en' ? 'Please enter a valid email' : 'Veuillez entrer un email valide';
                          }

                          const phoneRegex = /^[2594][0-9]{7}$/;
                          if (!customerInfo.phone.trim() || !phoneRegex.test(customerInfo.phone)) {
                            errors.phone = language === 'en' ? 'Invalid phone number format' : 'Format de numéro invalide';
                          }

                          if (!customerInfo.city.trim()) {
                            errors.city = t[language].required;
                          }

                          // Check ville requirement
                          if ((customerInfo.city === 'Sousse' || customerInfo.city === 'Tunis') && !customerInfo.ville) {
                            errors.ville = language === 'en' ? 'Ville is required' : 'La ville est requise';
                          }

                          if (Object.keys(errors).length > 0) {
                            setValidationErrors(errors);
                            toast({
                              title: t[language].error,
                              description: t[language].fixFormErrors,
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
                                customerInfo,
                                eventInfo,
                                selectedPasses: selectedPassesArray,
                                totalPrice: totalPrice,
                                totalQuantity: totalQuantity,
                                language
                              })
                            });

                            const result = await response.json();

                            if (!response.ok) {
                              throw new Error(result.error || result.details || 'Failed to save submission');
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
                          } catch (error: any) {
                            console.error('AIO Events submission error:', error);
                            const errorMessage = error.message || (language === 'en' ? 'Failed to save submission' : 'Échec de l\'enregistrement');
                            toast({
                              title: t[language].error,
                              description: errorMessage,
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
                </CardContent>
              </Card>

              {/* STEP 4: Ambassador Selector (if ambassador_cash selected) */}
              {paymentMethod === PaymentMethod.AMBASSADOR_CASH && (
                <Card className="glass">
                  <CardHeader>
                    <CardTitle className="text-gradient-neon">
                      {language === 'en' ? 'Choose Your Ambassador' : 'Choisissez Votre Ambassadeur'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AmbassadorSelector
                      city={customerInfo.city}
                      ville={customerInfo.ville}
                      selectedAmbassadorId={selectedAmbassadorId}
                      onSelect={setSelectedAmbassadorId}
                      language={language}
                    />
                    {validationErrors.ambassador && (
                      <p className="text-red-500 text-sm mt-4">{validationErrors.ambassador}</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* STEP 5: Order Summary */}
              {/* Show summary only after:
                  - Passes are selected
                  - Payment method is selected
                  - If ambassador cash, ambassador must also be selected */}
              {hasSelectedPasses && paymentMethod && (
                paymentMethod === PaymentMethod.AMBASSADOR_CASH 
                  ? selectedAmbassadorId 
                  : true
              ) && (
                <Card className="glass border-2 border-primary/30">
                  <CardHeader>
                    <CardTitle className="text-gradient-neon">{t[language].summary}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <OrderSummary
                      selectedPasses={selectedPassesArray}
                      totalPrice={totalPrice}
                      paymentMethod={paymentMethod}
                      termsAccepted={termsAccepted}
                      onTermsChange={setTermsAccepted}
                      language={language}
                      feeAmount={onlineFeeAmount}
                      totalWithFees={totalWithFees}
                    />
                    
                    {/* Terms Acceptance Notice */}
                    <div className="mt-4 pt-4 border-t">
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
                    
                    {/* Submit Button */}
                    <Button
                      type="submit"
                      disabled={processing || !hasSelectedPasses}
                      className="w-full btn-gradient disabled:opacity-50 mt-4"
                    >
                      {processing ? (
                        <>
                          <Loader size="sm" className="mr-2 shrink-0 [background:white]" />
                          {t[language].processing}
                        </>
                      ) : (
                        paymentMethod === PaymentMethod.ONLINE 
                          ? t[language].proceedToPayment 
                          : t[language].submitOrder
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </form>
      </div>
    </main>
  );
};

export default PassPurchase;
