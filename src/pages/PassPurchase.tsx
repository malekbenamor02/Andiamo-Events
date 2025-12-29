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
import { Calendar, MapPin, Users, CreditCard, ArrowLeft, CheckCircle, XCircle, Wallet, Phone, Instagram } from 'lucide-react';
import { ExpandableText } from '@/components/ui/expandable-text';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { CITIES, SOUSSE_VILLES, TUNIS_VILLES } from '@/lib/constants';

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

interface SelectedPass {
  passId: string;
  passName: string;
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
  const [selectedPasses, setSelectedPasses] = useState<Record<string, number>>({}); // passId -> quantity
  const [customerInfo, setCustomerInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: '',
    ville: ''
  });
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod' | ''>('online');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showAmbassadors, setShowAmbassadors] = useState(false);
  const [ambassadors, setAmbassadors] = useState<any[]>([]);
  const [loadingAmbassadors, setLoadingAmbassadors] = useState(false);
  const [filterCity, setFilterCity] = useState<string>('');
  const [filterVille, setFilterVille] = useState<string>('');

  // Fetch ambassadors when COD is selected
  useEffect(() => {
    if (paymentMethod === 'cod') {
      if (!showAmbassadors) {
        fetchAmbassadors();
        setShowAmbassadors(true);
      }
    } else {
      if (showAmbassadors) {
        setShowAmbassadors(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod]);

  // Reset ville filter when city filter changes
  useEffect(() => {
    if (!filterCity) {
      setFilterVille('');
    }
  }, [filterCity]);

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
      successMessageCOD: "Contact an ambassador below to place your order",
      contactAmbassador: "Contact Ambassador",
      selectAmbassador: "Select an Ambassador",
      ambassadorInstructions: "Choose an ambassador from your area and contact them directly via phone or Instagram to place your COD order.",
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
      successMessageCOD: "Contactez un ambassadeur ci-dessous pour passer votre commande",
      contactAmbassador: "Contacter l'Ambassadeur",
      selectAmbassador: "Sélectionner un Ambassadeur",
      ambassadorInstructions: "Choisissez un ambassadeur de votre région et contactez-le directement par téléphone ou Instagram pour passer votre commande COD.",
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
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;

      // Fetch passes for this event
      const { data: passesData, error: passesError } = await supabase
        .from('event_passes')
        .select('*')
        .eq('event_id', eventId)
        .order('is_primary', { ascending: false })
        .order('price', { ascending: true })
        .order('created_at', { ascending: true });

      if (passesError && passesError.code !== 'PGRST116' && passesError.message !== 'relation "public.event_passes" does not exist') {
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

      // Set primary pass as default selection
      if (passes.length > 0) {
        const primaryPass = passes.find(p => p.is_primary) || passes[0];
        setSelectedPasses({ [primaryPass.id]: 1 });
      }
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
  const updatePassQuantity = (passId: string, quantity: number) => {
    const clampedQuantity = Math.max(0, Math.min(10, quantity));
    const newPasses = { ...selectedPasses };
    
    if (clampedQuantity === 0) {
      delete newPasses[passId];
    } else {
      newPasses[passId] = clampedQuantity;
    }
    
    setSelectedPasses(newPasses);
    
    // Clear pass validation error when a pass is selected
    if (clampedQuantity > 0 && validationErrors.passes) {
      const newErrors = { ...validationErrors };
      delete newErrors.passes;
      setValidationErrors(newErrors);
    }
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

  // Validation (only for online payments)
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Check at least one pass selected with quantity > 0
    const hasSelectedPass = Object.values(selectedPasses).some(qty => qty > 0);
    if (!hasSelectedPass) {
      errors.passes = t[language].selectAtLeastOnePass;
    }

    // Only validate customer info for online payments
    if (paymentMethod === 'online') {
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

      // Validate terms acceptance
      if (!termsAccepted) {
        errors.termsAccepted = t[language].termsRequired;
      }
    }

    // Validate payment method
    if (!paymentMethod) {
      errors.paymentMethod = t[language].selectPaymentMethod;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission (only for online payments)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Only process online payments through form submission
    if (paymentMethod !== 'online') {
      return;
    }

    if (!validateForm()) {
      toast({
        title: t[language].error,
        description: t[language].fixFormErrors,
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);

    // Double check that at least one pass is selected
    const selectedPassesArray = getSelectedPassesArray();
    if (!selectedPassesArray || selectedPassesArray.length === 0 || !selectedPassesArray.some(p => p.quantity > 0)) {
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
        description: language === 'en' ? 'Please select at least one pass' : 'Veuillez sélectionner au moins un pass',
        variant: "destructive",
      });
      setProcessing(false);
      return;
    }

    try {
      // Online Payment - Create order and redirect to payment gateway
      await createOnlineOrder(selectedPassesArray, totalPrice);
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
    
    // Determine primary pass name (first selected pass name, or 'mixed' if multiple types)
    const primaryPassName = passes.length === 1 ? passes[0].passName : 'mixed';

    // Create ONE order with all pass types stored in notes
    const orderData: any = {
      source: 'platform_online',
      user_name: customerInfo.fullName.trim(),
      user_phone: customerInfo.phone.trim(),
      user_email: customerInfo.email.trim() || null,
      city: customerInfo.city.trim(),
      ville: customerInfo.ville.trim() || null,
      event_id: eventId || null,
      pass_type: primaryPassName, // Primary pass name (or 'mixed' if multiple)
      quantity: totalQuantity, // Total quantity of all passes
      total_price: totalPrice, // Total price of all passes combined
      payment_method: 'online',
      status: 'PENDING' // Order status (separate from payment status)
    };

    // Note: payment_status will be set to PENDING_PAYMENT by default (via migration or database default)
    // Since payment gateway is not yet integrated, all online orders start as PENDING_PAYMENT
    // Admin can manually update to PAID, FAILED, or REFUNDED in the admin dashboard

    // Add notes if column exists (optional field)
    try {
      orderData.notes = JSON.stringify({
        all_passes: passes.map(p => ({
          passId: p.passId,
          passName: p.passName,
          quantity: p.quantity,
          price: p.price
        })), // Store all pass types with their quantities and prices
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

  // Fetch ambassadors for COD
  const fetchAmbassadors = async () => {
    setLoadingAmbassadors(true);
    try {
      // Try to fetch social_link from ambassador_applications if available
      const { data: ambassadorsData, error } = await supabase
        .from('ambassadors')
        .select('id, full_name, phone, ville, city')
        .eq('status', 'approved')
        .eq('city', 'Sousse')
        .order('full_name');

      if (error) {
        console.error('Error fetching ambassadors:', error);
        throw new Error(error.message || 'Failed to fetch ambassadors');
      }

      // Try to enrich with social links from applications
      if (ambassadorsData) {
        const enrichedAmbassadors = await Promise.all(
          ambassadorsData.map(async (amb) => {
            // Try to find matching application by phone
            const { data: application } = await supabase
              .from('ambassador_applications')
              .select('social_link')
              .eq('phone_number', amb.phone)
              .maybeSingle();
            
            return {
              ...amb,
              social_link: application?.social_link || null
            };
          })
        );
        setAmbassadors(enrichedAmbassadors);
      } else {
        setAmbassadors([]);
      }
    } catch (error: any) {
      console.error('Error fetching ambassadors:', error);
      toast({
        title: t[language].error,
        description: error.message || (language === 'en' ? 'Failed to load ambassadors' : 'Échec du chargement des ambassadeurs'),
        variant: "destructive",
      });
    } finally {
      setLoadingAmbassadors(false);
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

  // Ambassador Listing Screen (COD)
  if (showAmbassadors) {
    return (
      <div className="min-h-screen pt-16" style={{ backgroundColor: '#1A1A1A' }}>
        {/* Subtle gradient navigation area */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center mb-8">
            <Button
              variant="ghost"
              onClick={() => {
                setShowAmbassadors(false);
                setPaymentMethod('');
              }}
              className="text-gray-400 hover:text-primary hover:bg-transparent transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {language === 'en' ? 'Back to Purchase' : 'Retour à l\'Achat'}
            </Button>
            <h1 className="text-3xl font-heading font-bold ml-4" style={{ color: '#E21836' }}>
              {t[language].selectAmbassador}
            </h1>
          </div>

          {/* Instructions */}
          <div 
            className="mb-6 rounded-lg p-6 border"
            style={{ 
              backgroundColor: '#1F1F1F',
              borderColor: '#2A2A2A'
            }}
          >
            <p className="text-gray-400 text-center text-sm">
              {t[language].ambassadorInstructions}
            </p>
          </div>

          {/* Filters */}
          {ambassadors.length > 0 && (
            <div 
              className="mb-6 rounded-lg p-4 border flex flex-wrap gap-4 items-end"
              style={{ 
                backgroundColor: '#1F1F1F',
                borderColor: '#2A2A2A'
              }}
            >
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm mb-2" style={{ color: '#B0B0B0' }}>
                  {language === 'en' ? 'Filter by City' : 'Filtrer par Ville'}
                </label>
                <Select value={filterCity} onValueChange={setFilterCity}>
                  <SelectTrigger 
                    className="w-full focus:ring-[#E21836] focus:ring-2"
                    style={{ 
                      backgroundColor: '#252525',
                      borderColor: filterCity ? '#E21836' : '#2A2A2A',
                      color: filterCity ? '#E21836' : '#B0B0B0'
                    }}
                  >
                    <SelectValue placeholder={language === 'en' ? 'All Cities' : 'Toutes les Villes'} />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: '#1F1F1F', borderColor: '#2A2A2A' }}>
                    {[...new Set(ambassadors.map(a => a.city).filter(Boolean))].sort().map((city) => (
                      <SelectItem 
                        key={city} 
                        value={city}
                        className="focus:bg-[#E21836]/20 focus:text-[#E21836] data-[highlighted]:bg-[#E21836]/20 data-[highlighted]:text-[#E21836]"
                        style={{ color: '#B0B0B0' }}
                      >
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm mb-2" style={{ color: '#B0B0B0' }}>
                  {language === 'en' ? 'Filter by Ville' : 'Filtrer par Quartier'}
                </label>
                <Select 
                  value={filterVille} 
                  onValueChange={setFilterVille}
                  disabled={!filterCity}
                >
                  <SelectTrigger 
                    className="w-full focus:ring-[#E21836] focus:ring-2"
                    style={{ 
                      backgroundColor: '#252525',
                      borderColor: filterVille ? '#E21836' : '#2A2A2A',
                      color: filterVille ? '#E21836' : '#B0B0B0',
                      opacity: !filterCity ? 0.5 : 1
                    }}
                  >
                    <SelectValue placeholder={language === 'en' ? 'All Villes' : 'Tous les Quartiers'} />
                  </SelectTrigger>
                  <SelectContent style={{ backgroundColor: '#1F1F1F', borderColor: '#2A2A2A' }}>
                    {filterCity && [...new Set(ambassadors.filter(a => a.city === filterCity).map(a => a.ville).filter(Boolean))].sort().map((ville) => (
                      <SelectItem 
                        key={ville} 
                        value={ville}
                        className="focus:bg-[#E21836]/20 focus:text-[#E21836] data-[highlighted]:bg-[#E21836]/20 data-[highlighted]:text-[#E21836]"
                        style={{ color: '#B0B0B0' }}
                      >
                        {ville}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(filterCity || filterVille) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFilterCity('');
                    setFilterVille('');
                  }}
                  className="text-sm transition-colors"
                  style={{ 
                    color: '#B0B0B0',
                    backgroundColor: 'transparent',
                    borderColor: '#2A2A2A'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#E21836';
                    e.currentTarget.style.borderColor = '#E21836';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#B0B0B0';
                    e.currentTarget.style.borderColor = '#2A2A2A';
                  }}
                >
                  {language === 'en' ? 'Clear Filters' : 'Effacer les Filtres'}
                </Button>
              )}
            </div>
          )}

          {/* Ambassadors List */}
          {loadingAmbassadors ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-gray-400">
                {language === 'en' ? 'Loading ambassadors...' : 'Chargement des ambassadeurs...'}
              </div>
            </div>
          ) : ambassadors.length === 0 ? (
            <div 
              className="rounded-lg p-8 text-center border"
              style={{ 
                backgroundColor: '#1F1F1F',
                borderColor: '#2A2A2A'
              }}
            >
              <Users className="w-16 h-16 mx-auto mb-4" style={{ color: '#4A4A4A' }} />
              <p className="text-gray-400">
                {language === 'en' 
                  ? 'No ambassadors available in your area at the moment.'
                  : 'Aucun ambassadeur disponible dans votre région pour le moment.'}
              </p>
            </div>
          ) : (() => {
            // Filter ambassadors based on selected filters
            const filteredAmbassadors = ambassadors.filter((ambassador) => {
              const matchesCity = !filterCity || ambassador.city === filterCity;
              const matchesVille = !filterVille || ambassador.ville === filterVille;
              return matchesCity && matchesVille;
            });

            return filteredAmbassadors.length === 0 ? (
              <div 
                className="rounded-lg p-8 text-center border"
                style={{ 
                  backgroundColor: '#1F1F1F',
                  borderColor: '#2A2A2A'
                }}
              >
                <Users className="w-16 h-16 mx-auto mb-4" style={{ color: '#4A4A4A' }} />
                <p className="text-gray-400">
                  {language === 'en' 
                    ? 'No ambassadors found with the selected filters.'
                    : 'Aucun ambassadeur trouvé avec les filtres sélectionnés.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAmbassadors.map((ambassador) => (
                <div
                  key={ambassador.id}
                  className="rounded-lg p-6 border transition-all duration-300"
                  style={{ 
                    backgroundColor: '#1F1F1F',
                    borderColor: '#2A2A2A'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#3A3A3A';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#2A2A2A';
                  }}
                >
                  <div className="space-y-3">
                    {/* Name - Red accent */}
                    <div>
                      <h3 className="text-xl font-bold" style={{ color: '#E21836' }}>
                        {ambassador.full_name}
                      </h3>
                    </div>

                    {/* Location Information - Soft light-gray */}
                    <div className="space-y-2">
                      {/* City */}
                      {ambassador.city && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" style={{ color: '#6B6B6B' }} />
                          <span className="text-sm" style={{ color: '#B0B0B0' }}>
                            {ambassador.city}
                          </span>
                        </div>
                      )}

                      {/* Ville */}
                      {ambassador.ville && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" style={{ color: '#6B6B6B' }} />
                          <span className="text-sm" style={{ color: '#B0B0B0' }}>
                            {ambassador.ville}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-2 pt-3 border-t" style={{ borderColor: '#2A2A2A' }}>
                      {/* Phone - Red accent */}
                      <div className="flex items-center gap-2">
                        <Phone 
                          className="w-4 h-4 transition-colors" 
                          style={{ color: '#6B6B6B' }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#E21836'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#6B6B6B'}
                        />
                        <a 
                          href={`tel:+216${ambassador.phone}`}
                          className="text-sm transition-colors"
                          style={{ color: '#E21836' }}
                          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                        >
                          +216 {ambassador.phone}
                        </a>
                      </div>

                      {/* Instagram/Social Link */}
                      {ambassador.social_link && (
                        <div className="flex items-center gap-2">
                          <Instagram 
                            className="w-4 h-4 transition-colors" 
                            style={{ color: '#6B6B6B' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#E21836'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#6B6B6B'}
                          />
                          <a 
                            href={ambassador.social_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm transition-colors"
                            style={{ color: '#B0B0B0' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#E21836';
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#B0B0B0';
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                          >
                            {ambassador.social_link.replace('https://www.instagram.com/', '').replace('https://instagram.com/', '').replace('/', '')}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            );
          })()}
        </div>
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
  const hasSelectedPasses = Object.values(selectedPasses).some(qty => qty > 0);

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
              {/* Payment Method - Show First */}
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
                      <div className="flex items-start space-x-3 p-4 border rounded-lg">
                        <RadioGroupItem 
                          value="cod" 
                          id="cod" 
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <Label htmlFor="cod" className="flex items-center cursor-pointer">
                            <Wallet className="w-5 h-5 mr-2" />
                            <span className="font-semibold">{t[language].codPayment}</span>
                            <Badge variant="secondary" className="ml-2">{t[language].codAvailable}</Badge>
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {language === 'en' 
                              ? 'Contact an ambassador directly to place your order'
                              : 'Contactez un ambassadeur directement pour passer votre commande'}
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

              {/* Pass Selection - Only for Online Payments */}
              {paymentMethod === 'online' && (
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
                              event.passes.length === 1 ? 'w-full max-w-md' : ''
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
                              <Label>{t[language].quantity}</Label>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updatePassQuantity(pass.id, quantity - 1)}
                                  className="hover:bg-muted hover:text-foreground hover:border-border"
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
                                  className="hover:bg-muted hover:text-foreground hover:border-border"
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
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-red-500 text-sm font-medium">{validationErrors.passes}</p>
                    </div>
                  )}
                  {!hasSelectedPasses && event.passes && event.passes.length > 0 && !validationErrors.passes && (
                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <p className="text-amber-500 text-sm">
                        {language === 'en' ? 'Please select at least one pass to continue' : 'Veuillez sélectionner au moins un pass pour continuer'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              )}

              {/* Customer Information - Only for Online Payments */}
              {paymentMethod === 'online' && (
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
                      {(customerInfo.city === 'Sousse' || customerInfo.city === 'Tunis') && (
                        <div className="md:col-span-2">
                          <Label htmlFor="ville">{t[language].ville}</Label>
                          <Select
                            value={customerInfo.ville}
                            onValueChange={(value) => setCustomerInfo({ ...customerInfo, ville: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={language === 'en' ? "Select ville (optional)" : "Sélectionner un quartier (optionnel)"} />
                            </SelectTrigger>
                            <SelectContent>
                              {customerInfo.city === 'Sousse' && SOUSSE_VILLES.map(ville => (
                                <SelectItem key={ville} value={ville}>{ville}</SelectItem>
                              ))}
                              {customerInfo.city === 'Tunis' && TUNIS_VILLES.map(ville => (
                                <SelectItem key={ville} value={ville}>{ville}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Order Summary - Only for Online Payments */}
              {paymentMethod === 'online' && hasSelectedPasses && (
                <Card className="glass border-2 border-primary/30">
                  <CardHeader>
                    <CardTitle className="text-gradient-neon">{t[language].summary}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 mb-4">
                      {getSelectedPassesArray().map((pass, index) => (
                        <div key={index} className="flex justify-between">
                          <span>
                            {pass.passName} 
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
                    
                    {/* Submit Button */}
                    <Button
                      type="submit"
                      disabled={processing || !hasSelectedPasses}
                      className="w-full btn-gradient disabled:opacity-50 disabled:cursor-not-allowed"
                      title={!hasSelectedPasses ? (language === 'en' ? 'Please select at least one pass' : 'Veuillez sélectionner au moins un pass') : ''}
                    >
                      {processing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          {t[language].processing}
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4 mr-2" />
                          {t[language].proceedToPayment}
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
