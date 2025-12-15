import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Users, CreditCard, ShoppingCart, ArrowLeft, CheckCircle, XCircle, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { CITIES, SOUSSE_VILLES } from '@/lib/constants';
import { API_ROUTES, buildFullApiUrl } from '@/lib/api-routes';
import { sanitizeUrl } from '@/lib/url-validator';

interface Event {
  id: string;
  name: string;
  description: string;
  date: string;
  venue: string;
  city: string;
  poster_url?: string;
  standard_price?: number;
  vip_price?: number;
  capacity?: number;
  age_restriction?: number;
  dress_code?: string;
  special_notes?: string;
}

interface SelectedPass {
  passType: 'standard' | 'vip';
  quantity: number;
  price: number;
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
  const [customerInfo, setCustomerInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: '',
    ville: ''
  });
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod' | ''>('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const t = {
    en: {
      title: "Purchase Pass",
      subtitle: "Secure your spot at this amazing event",
      backToEvents: "Back to Events",
      eventDetails: "Event Details",
      passSelection: "Select Passes",
      customerInfo: "Personal Information",
      payment: "Payment Method",
      summary: "Order Summary",
      standardPass: "Standard Pass",
      vipPass: "VIP Pass",
      quantity: "Quantity",
      total: "Total",
      fullName: "Full Name",
      email: "Email",
      phone: "Phone Number",
      city: "City",
      ville: "Ville (Neighborhood)",
      onlinePayment: "Online Payment",
      codPayment: "Cash on Delivery (COD)",
      codAvailable: "Available only for Sousse",
      codNotAvailable: "COD is only available for Sousse city",
      proceedToPayment: "Proceed to Payment",
      submitOrder: "Submit Order",
      processing: "Processing...",
      success: "Order submitted successfully!",
      successMessageOnline: "Your order has been submitted. Redirecting to payment...",
      successMessageCOD: "Your order has been submitted. An ambassador will contact you soon.",
      error: "Error",
      required: "This field is required",
      fixFormErrors: "Please fix the errors in the form",
      invalidEmail: "Please enter a valid email",
      invalidPhone: "Invalid phone number format (8 digits starting with 2, 5, 9, or 4)",
      invalidName: "Please enter a valid name (minimum 2 characters)",
      selectAtLeastOnePass: "Please select at least one pass",
      selectPaymentMethod: "Please select a payment method",
      villeRequired: "Ville is required when city is Sousse",
      acceptTerms: "By placing this order, you agree to our",
      termsLink: "Terms of Service",
      refundLink: "Refund & Cancellation Policy",
      termsRequired: "You must accept the Terms of Service and Refund & Cancellation Policy",
      orderConfirmation: "Order Confirmation",
      orderNumber: "Order Number",
      thankYou: "Thank you for your order!",
      redirecting: "Redirecting...",
      orderDetails: "Order Details"
    },
    fr: {
      title: "Acheter un Pass",
      subtitle: "Sécurisez votre place à cet événement incroyable",
      backToEvents: "Retour aux Événements",
      eventDetails: "Détails de l'Événement",
      passSelection: "Sélectionner les Passes",
      customerInfo: "Informations Personnelles",
      payment: "Méthode de Paiement",
      summary: "Résumé de la Commande",
      standardPass: "Pass Standard",
      vipPass: "Pass VIP",
      quantity: "Quantité",
      total: "Total",
      fullName: "Nom Complet",
      email: "Email",
      phone: "Numéro de Téléphone",
      city: "Ville",
      ville: "Quartier",
      onlinePayment: "Paiement en Ligne",
      codPayment: "Paiement à la Livraison (COD)",
      codAvailable: "Disponible uniquement pour Sousse",
      codNotAvailable: "Le COD est disponible uniquement pour la ville de Sousse",
      proceedToPayment: "Procéder au Paiement",
      submitOrder: "Soumettre la Commande",
      processing: "Traitement...",
      success: "Commande soumise avec succès!",
      successMessageOnline: "Votre commande a été soumise. Redirection vers le paiement...",
      successMessageCOD: "Votre commande a été soumise. Un ambassadeur vous contactera bientôt.",
      error: "Erreur",
      required: "Ce champ est requis",
      fixFormErrors: "Veuillez corriger les erreurs dans le formulaire",
      invalidEmail: "Veuillez entrer un email valide",
      invalidPhone: "Format de numéro invalide (8 chiffres commençant par 2, 5, 9 ou 4)",
      invalidName: "Veuillez entrer un nom valide (minimum 2 caractères)",
      selectAtLeastOnePass: "Veuillez sélectionner au moins un pass",
      selectPaymentMethod: "Veuillez sélectionner une méthode de paiement",
      villeRequired: "Le quartier est requis lorsque la ville est Sousse",
      acceptTerms: "En passant cette commande, vous acceptez nos",
      termsLink: "Conditions d'Utilisation",
      refundLink: "Politique de Remboursement et d'Annulation",
      termsRequired: "Vous devez accepter les Conditions d'Utilisation et la Politique de Remboursement et d'Annulation",
      orderConfirmation: "Confirmation de Commande",
      orderNumber: "Numéro de Commande",
      thankYou: "Merci pour votre commande!",
      redirecting: "Redirection...",
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
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) throw error;
      setEvent(data);
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

  // Update pass quantity (0-10)
  const updatePassQuantity = (passType: 'standard' | 'vip', quantity: number) => {
    const clampedQuantity = Math.max(0, Math.min(10, quantity));
    if (clampedQuantity === 0) {
      const newPasses = { ...selectedPasses };
      delete newPasses[passType];
      setSelectedPasses(newPasses);
    } else {
      setSelectedPasses(prev => ({
        ...prev,
        [passType]: clampedQuantity
      }));
    }
  };

  // Calculate total price
  const calculateTotal = (): number => {
    let total = 0;
    Object.entries(selectedPasses).forEach(([passType, quantity]) => {
      if (passType === 'standard' && event?.standard_price) {
        total += event.standard_price * quantity;
      } else if (passType === 'vip' && event?.vip_price) {
        total += event.vip_price * quantity;
      }
    });
    return total;
  };

  // Get selected passes as array
  const getSelectedPassesArray = (): SelectedPass[] => {
    const passes: SelectedPass[] = [];
    Object.entries(selectedPasses).forEach(([passType, quantity]) => {
      if (quantity > 0) {
        if (passType === 'standard' && event?.standard_price) {
          passes.push({
            passType: 'standard',
            quantity,
            price: event.standard_price
          });
        } else if (passType === 'vip' && event?.vip_price) {
          passes.push({
            passType: 'vip',
            quantity,
            price: event.vip_price
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
    if (Object.keys(selectedPasses).length === 0 || 
        Object.values(selectedPasses).every(qty => qty === 0)) {
      errors.passes = t[language].selectAtLeastOnePass;
    }

    // Validate full name
    if (!customerInfo.fullName.trim() || customerInfo.fullName.trim().length < 2) {
      errors.fullName = t[language].invalidName;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customerInfo.email.trim() || !emailRegex.test(customerInfo.email)) {
      errors.email = t[language].invalidEmail;
    }

    // Validate phone
    const phoneRegex = /^[2594][0-9]{7}$/;
    if (!customerInfo.phone.trim() || !phoneRegex.test(customerInfo.phone)) {
      errors.phone = t[language].invalidPhone;
    }

    // Validate city
    if (!customerInfo.city.trim()) {
      errors.city = t[language].required;
    }

    // Validate ville if city is Sousse
    if (customerInfo.city === 'Sousse' && !customerInfo.ville.trim()) {
      errors.ville = t[language].villeRequired;
    }

    // Validate payment method
    if (!paymentMethod) {
      errors.paymentMethod = t[language].selectPaymentMethod;
    }

    // Check COD availability
    if (paymentMethod === 'cod' && customerInfo.city !== 'Sousse') {
      errors.paymentMethod = t[language].codNotAvailable;
    }

    // Validate terms acceptance
    if (!termsAccepted) {
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

    setProcessing(true);

    try {
      const selectedPassesArray = getSelectedPassesArray();
      const totalPrice = calculateTotal();

      if (paymentMethod === 'online') {
        // Online Payment - Create order and redirect to payment gateway
        await createOnlineOrder(selectedPassesArray, totalPrice);
      } else if (paymentMethod === 'cod') {
        // COD Payment - Create order and assign ambassador
        await createCODOrder(selectedPassesArray, totalPrice);
      }
    } catch (error: any) {
      console.error('Order submission error:', error);
      const errorMessage = error.message || error.error?.message || (language === 'en' ? 'Failed to submit order' : 'Échec de la soumission de la commande');
      toast({
        title: t[language].error,
        description: errorMessage,
        variant: "destructive",
      });
      setProcessing(false);
    }
  };

  // Create online order
  const createOnlineOrder = async (passes: SelectedPass[], totalPrice: number) => {
    // Calculate total quantity across all pass types
    const totalQuantity = passes.reduce((sum, pass) => sum + pass.quantity, 0);
    
    // Determine primary pass type (first selected pass type, or 'mixed' if multiple types)
    const primaryPassType = passes.length === 1 ? passes[0].passType : 'mixed';

    // Create ONE order with all pass types stored in notes
    const orderData: any = {
      source: 'platform_online',
      user_name: customerInfo.fullName.trim(),
      user_phone: customerInfo.phone.trim(),
      user_email: customerInfo.email.trim() || null,
      city: customerInfo.city.trim(),
      ville: customerInfo.ville.trim() || null,
      event_id: eventId || null,
      pass_type: primaryPassType, // Primary pass type (or 'mixed' if multiple)
      quantity: totalQuantity, // Total quantity of all passes
      total_price: totalPrice, // Total price of all passes combined
      payment_method: 'online',
      status: 'PENDING_AMBASSADOR' // Order status (separate from payment status)
    };

    // Note: payment_status will be set to PENDING_PAYMENT by default (via migration or database default)
    // Since payment gateway is not yet integrated, all online orders start as PENDING_PAYMENT
    // Admin can manually update to PAID, FAILED, or REFUNDED in the admin dashboard

    // Add notes if column exists (optional field)
    try {
      orderData.notes = JSON.stringify({
        all_passes: passes, // Store all pass types with their quantities and prices
        total_order_price: totalPrice,
        pass_count: passes.length, // Number of different pass types
        payment_gateway: 'pending'
      });
    } catch (e) {
      // If notes column doesn't exist, continue without it
      console.warn('Could not add notes to order:', e);
    }

    console.log('Creating online order with data:', orderData);

    const { data: order, error } = await supabase.from('orders').insert(orderData).select().single();

    if (error) {
      console.error('Error creating order:', error);
      throw new Error(error.message || 'Failed to create order');
    }
    
    toast({
      title: t[language].success,
      description: t[language].successMessageOnline,
      variant: "default",
    });

    // TODO: Redirect to payment gateway
    // For now, show confirmation
    setSubmitted(true);
    setProcessing(false);

    // In production, redirect to payment gateway:
    // window.location.href = `/payment-gateway?orderId=${order.id}`;
  };

  // Create COD order
  const createCODOrder = async (passes: SelectedPass[], totalPrice: number) => {
    if (customerInfo.city !== 'Sousse' || !customerInfo.ville.trim()) {
      throw new Error(t[language].codNotAvailable);
    }

    // Calculate total quantity across all pass types
    const totalQuantity = passes.reduce((sum, pass) => sum + pass.quantity, 0);
    
    // Determine primary pass type (first selected pass type, or 'mixed' if multiple types)
    const primaryPassType = passes.length === 1 ? passes[0].passType : 'mixed';

    // Create ONE order with all pass types stored in notes
    const orderData: any = {
      source: 'platform_cod',
      user_name: customerInfo.fullName.trim(),
      user_phone: customerInfo.phone.trim(),
      user_email: customerInfo.email.trim() || null,
      city: customerInfo.city.trim(),
      ville: customerInfo.ville.trim() || null,
      event_id: eventId || null,
      pass_type: primaryPassType, // Primary pass type (or 'mixed' if multiple)
      quantity: totalQuantity, // Total quantity of all passes
      total_price: totalPrice, // Total price of all passes combined
      payment_method: 'cod',
      status: 'PENDING_AMBASSADOR'
    };

    // Add notes if column exists (optional field)
    try {
      orderData.notes = JSON.stringify({
        all_passes: passes, // Store all pass types with their quantities and prices
        total_order_price: totalPrice,
        pass_count: passes.length // Number of different pass types
      });
    } catch (e) {
      // If notes column doesn't exist, continue without it
      console.warn('Could not add notes to order:', e);
    }

    console.log('Creating COD order with data:', orderData);

    const { data: order, error } = await supabase.from('orders').insert(orderData).select().single();

    if (error) {
      console.error('Error creating order:', error);
      throw new Error(error.message || 'Failed to create order');
    }

    // Assign order via round-robin
    try {
      const apiBase = sanitizeUrl(import.meta.env.VITE_API_URL || 'http://localhost:8082');
      const apiUrl = buildFullApiUrl(API_ROUTES.ASSIGN_ORDER, apiBase);
      
      if (!apiUrl) {
        throw new Error('Invalid API URL configuration');
      }
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          order_id: order.id,
          ville: customerInfo.ville.trim()
        })
      });

      if (!response.ok) {
        console.error('Error assigning order:', await response.text());
      }
    } catch (error) {
      console.error('Error assigning order:', error);
      // Order is still created, just not assigned yet
    }

    toast({
      title: t[language].success,
      description: t[language].successMessageCOD,
      variant: "default",
    });

    setSubmitted(true);
    setProcessing(false);
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

  // Success/Confirmation Screen
  if (submitted) {
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
                {paymentMethod === 'online' 
                  ? t[language].successMessageOnline
                  : t[language].successMessageCOD}
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
                  <p className="text-2xl font-bold text-primary">{calculateTotal()} TND</p>
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

  const totalPrice = calculateTotal();
  const hasSelectedPasses = Object.keys(selectedPasses).length > 0 && 
                            Object.values(selectedPasses).some(qty => qty > 0);

  return (
    <div className="min-h-screen bg-gradient-dark pt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/events')}
            className="text-white hover:text-primary"
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
                  <div>
                    <h3 className="text-xl font-bold text-primary mb-2">{event.name}</h3>
                    <p className="text-muted-foreground text-sm mb-4">{event.description}</p>
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
              {/* Pass Selection */}
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-gradient-neon">{t[language].passSelection}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Standard Pass */}
                    {event.standard_price && (
                      <div className="border rounded-lg p-4 space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold">{t[language].standardPass}</h3>
                          <p className="text-2xl font-bold text-primary">{event.standard_price} TND</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>{t[language].quantity}</Label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updatePassQuantity('standard', (selectedPasses.standard || 0) - 1)}
                            >
                              -
                            </Button>
                            <span className="w-12 text-center font-semibold">
                              {selectedPasses.standard || 0}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updatePassQuantity('standard', (selectedPasses.standard || 0) + 1)}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* VIP Pass */}
                    {event.vip_price && event.vip_price > 0 && (
                      <div className="border rounded-lg p-4 space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold">{t[language].vipPass}</h3>
                          <p className="text-2xl font-bold text-primary">{event.vip_price} TND</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <Label>{t[language].quantity}</Label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updatePassQuantity('vip', (selectedPasses.vip || 0) - 1)}
                            >
                              -
                            </Button>
                            <span className="w-12 text-center font-semibold">
                              {selectedPasses.vip || 0}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => updatePassQuantity('vip', (selectedPasses.vip || 0) + 1)}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {validationErrors.passes && (
                    <p className="text-red-500 text-sm mt-2">{validationErrors.passes}</p>
                  )}
                </CardContent>
              </Card>

              {/* Customer Information */}
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-gradient-neon">{t[language].customerInfo}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fullName">{t[language].fullName} *</Label>
                      <Input
                        id="fullName"
                        value={customerInfo.fullName}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, fullName: e.target.value })}
                        className={validationErrors.fullName ? 'border-red-500' : ''}
                        required
                      />
                      {validationErrors.fullName && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.fullName}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="phone">{t[language].phone} *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={customerInfo.phone}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value.replace(/\D/g, '') })}
                        maxLength={8}
                        className={validationErrors.phone ? 'border-red-500' : ''}
                        required
                      />
                      {validationErrors.phone && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.phone}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="email">{t[language].email} *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={customerInfo.email}
                        onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                        className={validationErrors.email ? 'border-red-500' : ''}
                        required
                      />
                      {validationErrors.email && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="city">{t[language].city} *</Label>
                      <Select
                        value={customerInfo.city}
                        onValueChange={(value) => setCustomerInfo({ ...customerInfo, city: value, ville: '' })}
                      >
                        <SelectTrigger className={validationErrors.city ? 'border-red-500' : ''}>
                          <SelectValue placeholder={language === 'en' ? "Select city" : "Sélectionner une ville"} />
                        </SelectTrigger>
                        <SelectContent>
                          {CITIES.map(city => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {validationErrors.city && (
                        <p className="text-red-500 text-xs mt-1">{validationErrors.city}</p>
                      )}
                    </div>
                    {customerInfo.city === 'Sousse' && (
                      <div className="md:col-span-2">
                        <Label htmlFor="ville">{t[language].ville} *</Label>
                        <Select
                          value={customerInfo.ville}
                          onValueChange={(value) => setCustomerInfo({ ...customerInfo, ville: value })}
                        >
                          <SelectTrigger className={validationErrors.ville ? 'border-red-500' : ''}>
                            <SelectValue placeholder={language === 'en' ? "Select ville" : "Sélectionner un quartier"} />
                          </SelectTrigger>
                          <SelectContent>
                            {SOUSSE_VILLES.map(ville => (
                              <SelectItem key={ville} value={ville}>{ville}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {validationErrors.ville && (
                          <p className="text-red-500 text-xs mt-1">{validationErrors.ville}</p>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Payment Method */}
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-gradient-neon">{t[language].payment}</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod(value as 'online' | 'cod')}
                  >
                    <div className="space-y-4">
                      <div className="flex items-start space-x-3 p-4 border rounded-lg">
                        <RadioGroupItem value="online" id="online" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="online" className="flex items-center cursor-pointer">
                            <CreditCard className="w-5 h-5 mr-2" />
                            <span className="font-semibold">{t[language].onlinePayment}</span>
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {language === 'en' 
                              ? 'Pay securely with your credit card'
                              : 'Payez en toute sécurité avec votre carte de crédit'}
                          </p>
                        </div>
                      </div>
                      <div className={`flex items-start space-x-3 p-4 border rounded-lg ${
                        customerInfo.city !== 'Sousse' ? 'opacity-50' : ''
                      }`}>
                        <RadioGroupItem 
                          value="cod" 
                          id="cod" 
                          className="mt-1"
                          disabled={customerInfo.city !== 'Sousse'}
                        />
                        <div className="flex-1">
                          <Label htmlFor="cod" className="flex items-center cursor-pointer">
                            <Wallet className="w-5 h-5 mr-2" />
                            <span className="font-semibold">{t[language].codPayment}</span>
                            {customerInfo.city === 'Sousse' && (
                              <Badge variant="secondary" className="ml-2">{t[language].codAvailable}</Badge>
                            )}
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {customerInfo.city === 'Sousse'
                              ? (language === 'en' 
                                  ? 'Pay when you receive your passes'
                                  : 'Payez à la réception de vos passes')
                              : t[language].codNotAvailable}
                          </p>
                        </div>
                      </div>
                    </div>
                  </RadioGroup>
                  {validationErrors.paymentMethod && (
                    <p className="text-red-500 text-sm mt-2">{validationErrors.paymentMethod}</p>
                  )}
                </CardContent>
              </Card>

              {/* Order Summary */}
              {hasSelectedPasses && (
                <Card className="glass border-2 border-primary/30">
                  <CardHeader>
                    <CardTitle className="text-gradient-neon">{t[language].summary}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      {getSelectedPassesArray().map((pass, index) => (
                        <div key={index} className="flex justify-between">
                          <span>
                            {pass.passType === 'standard' ? t[language].standardPass : t[language].vipPass} 
                            {' x '}{pass.quantity}
                          </span>
                          <span className="font-semibold">{pass.price * pass.quantity} TND</span>
                        </div>
                      ))}
                      <div className="border-t pt-3">
                        <div className="flex justify-between font-bold text-lg">
                          <span>{t[language].total}:</span>
                          <span className="text-primary">{totalPrice} TND</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Terms Acceptance */}
                    <div className="mb-4">
                      <div className="flex items-start space-x-2">
                        <Checkbox
                          id="terms"
                          checked={termsAccepted}
                          onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                          className={validationErrors.termsAccepted ? 'border-red-500' : ''}
                        />
                        <Label htmlFor="terms" className="text-sm leading-relaxed peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                          {t[language].acceptTerms}{' '}
                          <Link to="/terms" className="text-primary hover:underline underline-offset-2">
                            {t[language].termsLink}
                          </Link>
                          {' '}{language === 'en' ? 'and' : 'et'}{' '}
                          <Link to="/refund-policy" className="text-primary hover:underline underline-offset-2">
                            {t[language].refundLink}
                          </Link>
                          .
                        </Label>
                      </div>
                      {validationErrors.termsAccepted && (
                        <p className="text-sm text-red-500 mt-1">{validationErrors.termsAccepted}</p>
                      )}
                    </div>
                    
                    <Button
                      type="submit"
                      disabled={processing}
                      className="w-full btn-gradient"
                    >
                      {processing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          {t[language].processing}
                        </>
                      ) : (
                        <>
                          {paymentMethod === 'online' ? (
                            <>
                              <CreditCard className="w-4 h-4 mr-2" />
                              {t[language].proceedToPayment}
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="w-4 h-4 mr-2" />
                              {t[language].submitOrder}
                            </>
                          )}
                        </>
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
