import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, MapPin, Users, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { ExpandableText } from '@/components/ui/expandable-text';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';

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

interface EventPass {
  id: string;
  name: string;
  price: number;
  description?: string;
  is_primary: boolean;
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
}

interface PassPurchaseProps {
  language: 'en' | 'fr';
}

const PassPurchase = ({ language }: PassPurchaseProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId');
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
  
  // Fetch payment options
  const { data: paymentOptions = [], isLoading: loadingPaymentOptions } = usePaymentOptions();
  
  // Fetch active ambassadors to get full details (including social_link)
  const { data: activeAmbassadors = [] } = useActiveAmbassadors(
    customerInfo.city, 
    customerInfo.ville
  );

  // Reset ambassador selection when payment method changes
  useEffect(() => {
    if (paymentMethod !== PaymentMethod.AMBASSADOR_CASH) {
      setSelectedAmbassadorId(null);
      setTermsAccepted(false);
      setSelectedAmbassadorDetails(null);
    }
  }, [paymentMethod]);

  // Update selected ambassador details when ambassador ID changes
  useEffect(() => {
    if (selectedAmbassadorId && activeAmbassadors.length > 0) {
      const ambassador = activeAmbassadors.find(a => a.id === selectedAmbassadorId);
      setSelectedAmbassadorDetails(ambassador || null);
    } else {
      setSelectedAmbassadorDetails(null);
    }
  }, [selectedAmbassadorId, activeAmbassadors]);

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
      successMessageOnline: "Your order has been submitted. Redirecting to payment...",
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
      successMessageOnline: "Votre commande a été soumise. Redirection vers le paiement...",
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
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      // Check if we're on localhost (for testing) or production
      const isLocalhost = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.0.')
      );

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;

      // Block test events on production (not localhost)
      if (!isLocalhost && eventData?.is_test) {
        // Redirect to home page or show error
        toast({
          title: t[language].error,
          description: language === 'en' 
            ? 'This event is not available.' 
            : 'Cet événement n\'est pas disponible.',
          variant: 'destructive'
        });
        navigate('/');
        return;
      }

      const { data: passesData, error: passesError } = await supabase
        .from('event_passes')
        .select('*')
        .eq('event_id', eventId)
        .order('is_primary', { ascending: false })
        .order('price', { ascending: true });

      if (passesError && passesError.code !== 'PGRST116') {
        console.error('Error fetching passes:', passesError);
      }

      const passes = (passesData || []).map((p: any) => ({
        id: p.id,
        name: p.name || '',
        price: typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0,
        description: p.description || '',
        is_primary: p.is_primary || false
      }));

      setEvent({
        ...eventData,
        passes: passes
      });

      // All passes start at 0 - no default selection
    } catch (error) {
      console.error('Error fetching event:', error);
      toast({
        title: t[language].error,
        description: language === 'en' ? 'Failed to load event' : 'Échec du chargement de l\'événement',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Update pass quantity
  const updatePassQuantity = (passId: string, quantity: number) => {
    const clampedQuantity = Math.max(0, Math.min(10, quantity));
    const newPasses = { ...selectedPasses };
    
    if (clampedQuantity === 0) {
      delete newPasses[passId];
    } else {
      newPasses[passId] = clampedQuantity;
    }
    
    setSelectedPasses(newPasses);
  };

  // Calculate total price
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
      if (!termsAccepted) {
        errors.terms = t[language].termsRequired;
      }
    }

    // Validate terms acceptance for online payments
    if (paymentMethod === PaymentMethod.ONLINE && !termsAccepted) {
      errors.termsAccepted = t[language].termsRequired;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
      const order = await createOrder({
        customerInfo,
        passes: selectedPassesArray,
        paymentMethod,
        ambassadorId: paymentMethod === PaymentMethod.AMBASSADOR_CASH ? selectedAmbassadorId || undefined : undefined,
        eventId: eventId || undefined
      });

      // Handle redirect based on payment method
      if (paymentMethod === PaymentMethod.ONLINE) {
        toast({
          title: t[language].success,
          description: t[language].successMessageOnline,
          variant: "default",
        });
        navigate(`/payment-processing?orderId=${order.id}`);
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
        variant="default" 
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

  // Calculate values that might be needed in early returns
  const totalPrice = calculateTotal();
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
          totalPrice={totalPrice}
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
                    {new Date(event.date).toLocaleDateString(language)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t[language].total}</p>
                  <p className="text-2xl font-bold text-primary">{totalPrice} TND</p>
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

  return (
    <div className="min-h-screen bg-gradient-dark pt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/events')}
            className="text-white hover:text-primary hover:bg-transparent"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t[language].backToEvents}
          </Button>
          <h1 className="text-3xl font-heading font-bold text-gradient-neon ml-4">
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
                      <span>{new Date(event.date).toLocaleDateString(language)}</span>
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
                      {event.passes.map((pass) => {
                        const quantity = selectedPasses[pass.id] || 0;
                        return (
                          <div 
                            key={pass.id}
                            className={`border rounded-lg p-4 space-y-4 ${
                              event.passes!.length === 1 ? 'w-full max-w-md' : ''
                            }`}
                          >
                            <div>
                              <h3 className="text-lg font-semibold mb-1">{pass.name}</h3>
                              <p className="text-2xl font-bold text-primary">{pass.price} TND</p>
                              {pass.description && (
                                <p className="text-sm text-muted-foreground mt-1">{pass.description}</p>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-sm">{t[language].quantity}</span>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
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
                                  onClick={() => updatePassQuantity(pass.id, quantity + 1)}
                                >
                                  +
                                </Button>
                              </div>
                            </div>
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
                          // Validate customer info and passes before proceeding
                          const errors: Record<string, string> = {};
                          
                          // Check at least one pass selected
                          const hasSelectedPass = Object.values(selectedPasses).some(qty => qty > 0);
                          if (!hasSelectedPass) {
                            errors.passes = t[language].selectAtLeastOnePass;
                          }

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
                            const order = await createOrder({
                              customerInfo,
                              passes: selectedPassesArray,
                              paymentMethod: PaymentMethod.EXTERNAL_APP,
                              eventId: eventId || undefined
                            });

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
                            console.error('Order submission error:', error);
                            const errorMessage = error.message || (language === 'en' ? 'Failed to submit order' : 'Échec de la soumission de la commande');
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
              {hasSelectedPasses && paymentMethod && (
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
                    />
                    
                    {/* Validation errors for terms */}
                    {(validationErrors.terms || validationErrors.termsAccepted) && (
                      <p className="text-red-500 text-sm mt-2">
                        {validationErrors.terms || validationErrors.termsAccepted}
                      </p>
                    )}
                    
                    {/* Submit Button */}
                    <Button
                      type="submit"
                      disabled={processing || !hasSelectedPasses}
                      className="w-full btn-gradient disabled:opacity-50"
                    >
                      {processing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
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
    </div>
  );
};

export default PassPurchase;
