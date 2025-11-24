import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, MapPin, Users, CreditCard, ShoppingCart, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';

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

interface PassType {
  id: string;
  name: string;
  price: number;
  description: string;
  available: boolean;
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
    city: ''
  });
  const [validationErrors, setValidationErrors] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: ''
  });
  const [processing, setProcessing] = useState(false);

  const t = {
    en: {
      title: "Purchase Pass",
      subtitle: "Secure your spot at this amazing event",
      backToEvents: "Back to Events",
      eventDetails: "Event Details",
      passSelection: "Pass Selection",
      customerInfo: "Customer Information",
      payment: "Payment",
      summary: "Order Summary",
      standardPass: "Standard Pass",
      vipPass: "VIP Pass",
      quantity: "Quantity",
      total: "Total",
      fullName: "Full Name",
      email: "Email",
      phone: "Phone Number",
      city: "City",
      benefits: "Benefits",
      capacity: "Capacity",
      ageRestriction: "Age Restriction",
      dressCode: "Dress Code",
      specialNotes: "Special Notes",
      selectPass: "Select Pass Type",
      addToCart: "Add to Cart",
      proceedToPayment: "Proceed to Payment",
      processing: "Processing...",
      success: "Pass purchased successfully!",
      error: "Failed to purchase pass",
      networkError: "Network error. Please try again.",
      required: "This field is required",
      fixFormErrors: "Please fix the errors in the form",
      invalidEmail: "Please enter a valid email",
      invalidPhone: "Please enter a valid phone number",
      invalidName: "Please enter a valid name (minimum 2 characters)",
      invalidCity: "Please enter a valid city name",
      outOfStock: "Out of Stock",
      limitedAvailability: "Limited Availability",
      available: "Available"
    },
    fr: {
      title: "Acheter un Pass",
      subtitle: "Sécurisez votre place à cet événement incroyable",
      backToEvents: "Retour aux Événements",
      eventDetails: "Détails de l'Événement",
      passSelection: "Sélection du Pass",
      customerInfo: "Informations Client",
      payment: "Paiement",
      summary: "Résumé de la Commande",
      standardPass: "Pass Standard",
      vipPass: "Pass VIP",
      quantity: "Quantité",
      total: "Total",
      fullName: "Nom Complet",
      email: "Email",
      phone: "Numéro de Téléphone",
      city: "Ville",
      benefits: "Avantages",
      capacity: "Capacité",
      ageRestriction: "Restriction d'Âge",
      dressCode: "Code Vestimentaire",
      specialNotes: "Notes Spéciales",
      selectPass: "Sélectionner le Type de Pass",
      addToCart: "Ajouter au Panier",
      proceedToPayment: "Procéder au Paiement",
      processing: "Traitement...",
      success: "Pass acheté avec succès!",
      error: "Échec de l'achat du pass",
      networkError: "Erreur réseau. Veuillez réessayer.",
      required: "Ce champ est requis",
      fixFormErrors: "Veuillez corriger les erreurs dans le formulaire",
      invalidEmail: "Veuillez entrer un email valide",
      invalidPhone: "Veuillez entrer un numéro de téléphone valide",
      invalidName: "Veuillez entrer un nom valide (minimum 2 caractères)",
      invalidCity: "Veuillez entrer un nom de ville valide",
      outOfStock: "Rupture de Stock",
      limitedAvailability: "Disponibilité Limitée",
      available: "Disponible"
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
        description: t[language].networkError,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const passTypes: PassType[] = event ? [
    {
      id: 'standard',
      name: t[language].standardPass,
      price: event.standard_price || 0,
      description: language === 'en' 
        ? 'Access to the main event area with standard amenities'
        : 'Accès à la zone principale de l\'événement avec des commodités standard',
      available: true
    },
    ...(event.vip_price && event.vip_price > 0 ? [{
      id: 'vip',
      name: t[language].vipPass,
      price: event.vip_price,
      description: language === 'en'
        ? 'Premium experience with exclusive benefits and amenities'
        : 'Expérience premium avec des avantages et commodités exclusifs',
      available: true
    }] : [])
  ] : [];

  // Calculate total price from all selected passes
  const totalPrice = Object.entries(selectedPasses).reduce((total, [passId, qty]) => {
    const pass = passTypes.find(p => p.id === passId);
    return total + (pass ? pass.price * qty : 0);
  }, 0);

  // Toggle pass selection
  const togglePassSelection = (passId: string) => {
    setSelectedPasses(prev => {
      if (prev[passId]) {
        // Remove pass if already selected
        const newState = { ...prev };
        delete newState[passId];
        return newState;
      } else {
        // Add pass with quantity 1
        return { ...prev, [passId]: 1 };
      }
    });
  };

  // Update quantity for a specific pass
  const updatePassQuantity = (passId: string, quantity: number) => {
    if (quantity <= 0) {
      // Remove pass if quantity is 0
      setSelectedPasses(prev => {
        const newState = { ...prev };
        delete newState[passId];
        return newState;
      });
    } else {
      setSelectedPasses(prev => ({
        ...prev,
        [passId]: quantity
      }));
    }
  };

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    // Accepts formats: +216 XX XXX XXX, 216 XX XXX XXX, XX XXX XXX
    const phoneRegex = /^(\+?216\s?)?[0-9]{2}\s?[0-9]{3}\s?[0-9]{3}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  const validateName = (name: string): boolean => {
    return name.trim().length >= 2 && /^[a-zA-Z\s]+$/.test(name.trim());
  };

  const validateCity = (city: string): boolean => {
    return city.trim().length >= 2 && /^[a-zA-Z\s]+$/.test(city.trim());
  };

  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'fullName':
        return value.trim() === '' ? t[language].required : 
               !validateName(value) ? t[language].invalidName : '';
      case 'email':
        return value.trim() === '' ? t[language].required : 
               !validateEmail(value) ? t[language].invalidEmail : '';
      case 'phone':
        return value.trim() === '' ? t[language].required : 
               !validatePhone(value) ? t[language].invalidPhone : '';
      case 'city':
        return value.trim() !== '' && !validateCity(value) ? t[language].invalidCity : '';
      default:
        return '';
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }));
    const error = validateField(field, value);
    setValidationErrors(prev => ({ ...prev, [field]: error }));
  };

  const validateForm = () => {
    if (Object.keys(selectedPasses).length === 0) {
      toast({
        title: t[language].error,
        description: t[language].selectPass,
        variant: "destructive",
      });
      return false;
    }

    // Validate all required fields
    const errors = {
      fullName: validateField('fullName', customerInfo.fullName),
      email: validateField('email', customerInfo.email),
      phone: validateField('phone', customerInfo.phone),
      city: validateField('city', customerInfo.city)
    };

    setValidationErrors(errors);

    // Check if there are any errors
    const hasErrors = Object.values(errors).some(error => error !== '');
    
    if (hasErrors) {
      toast({
        title: t[language].error,
        description: t[language].fixFormErrors,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handlePurchase = async () => {
    if (!validateForm()) return;
    
    setProcessing(true);
    
    try {
      // Here you would integrate with your payment system
      // For now, we'll simulate a successful purchase
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Save purchase to database (commented out until table is created)
      // const { error } = await supabase
      //   .from('pass_purchases')
      //   .insert({
      //     event_id: eventId,
      //     pass_type: selectedPassType,
      //     quantity: quantity,
      //     total_price: totalPrice,
      //     customer_name: customerInfo.fullName,
      //     customer_email: customerInfo.email,
      //     customer_phone: customerInfo.phone,
      //     customer_city: customerInfo.city,
      //     status: 'confirmed'
      //   });

      // if (error) throw error;

      toast({
        title: t[language].success,
        description: language === 'en' 
          ? "You will receive a confirmation email shortly."
          : "Vous recevrez un email de confirmation sous peu.",
      });

      // Redirect to success page or back to events
      navigate('/events');
      
    } catch (error) {
      console.error('Purchase error:', error);
      toast({
        title: t[language].error,
        description: t[language].networkError,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <LoadingScreen 
        variant="default" 
        size="fullscreen" 
        text="Loading..."
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
              The event you're looking for doesn't exist or has been removed.
            </p>
            <Button onClick={() => navigate('/events')}>
              {t[language].backToEvents}
            </Button>
          </CardContent>
        </Card>
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
            className="text-white hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t[language].backToEvents}
          </Button>
          <h1 className="text-3xl font-heading font-bold text-gradient-neon ml-4">
            {t[language].title}
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Event Details */}
          <div className="lg:col-span-1">
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-gradient-neon">{t[language].eventDetails}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <img
                    src={event.poster_url || '/api/placeholder/400/300'}
                    alt={event.name}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <Badge className="absolute top-2 right-2">
                    {event.standard_price && event.vip_price ? 'Multiple Passes' : 'Single Pass'}
                  </Badge>
                </div>
                
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

                {event.age_restriction && (
                  <Alert>
                    <AlertDescription>
                      <strong>{t[language].ageRestriction}:</strong> {event.age_restriction}+ {language === 'en' ? 'years' : 'ans'}
                    </AlertDescription>
                  </Alert>
                )}

                {event.dress_code && (
                  <Alert>
                    <AlertDescription>
                      <strong>{t[language].dressCode}:</strong> {event.dress_code}
                    </AlertDescription>
                  </Alert>
                )}

                {event.special_notes && (
                  <Alert>
                    <AlertDescription>
                      <strong>{t[language].specialNotes}:</strong> {event.special_notes}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Pass Selection & Purchase */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pass Types - Modern Design */}
            <Card className="glass border-2 border-primary/20">
              <CardHeader className="pb-4">
                <CardTitle className="text-gradient-neon text-3xl font-bold text-center">
                  {t[language].passSelection}
                </CardTitle>
                <p className="text-center text-muted-foreground mt-2">
                  {language === 'en' ? 'Select one or more pass types' : 'Sélectionnez un ou plusieurs types de pass'}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {passTypes.map((passType, index) => {
                    const isSelected = selectedPasses[passType.id] !== undefined;
                    const quantity = selectedPasses[passType.id] || 0;
                    const isStandard = passType.id === 'standard';
                    
                    return (
                      <div
                        key={passType.id}
                        className={`relative group overflow-hidden rounded-2xl transition-all duration-500 ${
                          isSelected
                            ? 'scale-105 shadow-2xl'
                            : 'scale-100 hover:scale-[1.02]'
                        } ${!passType.available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        onClick={() => passType.available && togglePassSelection(passType.id)}
                        style={{
                          animationDelay: `${index * 100}ms`
                        }}
                      >
                        {/* Background Gradient */}
                        <div className={`absolute inset-0 transition-opacity duration-500 ${
                          isSelected
                            ? isStandard
                              ? 'bg-gradient-to-br from-purple-600/30 via-purple-500/20 to-blue-600/30'
                              : 'bg-gradient-to-br from-pink-600/30 via-pink-500/20 to-purple-600/30'
                            : isStandard
                              ? 'bg-gradient-to-br from-purple-500/10 via-purple-400/5 to-blue-500/10'
                              : 'bg-gradient-to-br from-pink-500/10 via-pink-400/5 to-purple-500/10'
                        }`} />
                        
                        {/* Border Glow Effect */}
                        <div className={`absolute inset-0 rounded-2xl transition-all duration-500 ${
                          isSelected
                            ? isStandard
                              ? 'border-2 border-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.6)]'
                              : 'border-2 border-pink-400 shadow-[0_0_30px_rgba(236,72,153,0.6)]'
                            : isStandard
                              ? 'border-2 border-purple-500/30 hover:border-purple-400/60'
                              : 'border-2 border-pink-500/30 hover:border-pink-400/60'
                        }`} />
                        
                        {/* Content */}
                        <div className="relative p-6">
                          {/* Selection Indicator */}
                          <div className="flex items-start justify-between mb-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                              isSelected
                                ? isStandard
                                  ? 'bg-purple-500 shadow-lg shadow-purple-500/50'
                                  : 'bg-pink-500 shadow-lg shadow-pink-500/50'
                                : 'bg-muted border-2 border-border'
                            }`}>
                              {isSelected && (
                                <CheckCircle className={`w-5 h-5 ${
                                  isStandard ? 'text-white' : 'text-white'
                                }`} />
                              )}
                            </div>
                            {!passType.available && (
                              <Badge variant="secondary" className="ml-auto">
                                {t[language].outOfStock}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Pass Type Name */}
                          <h3 className={`text-2xl font-bold mb-2 transition-colors duration-300 ${
                            isSelected
                              ? isStandard
                                ? 'text-purple-300'
                                : 'text-pink-300'
                              : 'text-foreground'
                          }`}>
                            {passType.name}
                          </h3>
                          
                          {/* Price */}
                          <div className="mb-4">
                            <p className={`text-4xl font-extrabold mb-1 transition-all duration-300 ${
                              isSelected
                                ? isStandard
                                  ? 'text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-blue-300'
                                  : 'text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-purple-300'
                                : 'text-primary'
                            }`}>
                              {passType.price} TND
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {language === 'en' ? 'per pass' : 'par pass'}
                            </p>
                          </div>
                          
                          {/* Description */}
                          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                            {passType.description}
                          </p>
                          
                          {/* Quantity Selector */}
                          {isSelected && (
                            <div 
                              className="mt-4 pt-4 border-t border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-300"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-between">
                                <Label htmlFor={`quantity-${passType.id}`} className="text-sm font-semibold">
                                  {t[language].quantity}:
                                </Label>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => updatePassQuantity(passType.id, Math.max(1, quantity - 1))}
                                  >
                                    -
                                  </Button>
                                  <div className={`w-12 h-8 flex items-center justify-center rounded-md font-bold ${
                                    isStandard
                                      ? 'bg-purple-500/20 text-purple-300 border border-purple-400/30'
                                      : 'bg-pink-500/20 text-pink-300 border border-pink-400/30'
                                  }`}>
                                    {quantity}
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => updatePassQuantity(passType.id, Math.min(10, quantity + 1))}
                                  >
                                    +
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Customer Information */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-gradient-neon">{t[language].customerInfo}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fullName">{t[language].fullName} *</Label>
                    <Input
                      id="fullName"
                      value={customerInfo.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      className={`mt-1 ${validationErrors.fullName ? 'border-red-500 focus:border-red-500' : ''}`}
                      placeholder={language === 'en' ? "Enter your full name" : "Entrez votre nom complet"}
                    />
                    {validationErrors.fullName && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.fullName}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="email">{t[language].email} *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={customerInfo.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={`mt-1 ${validationErrors.email ? 'border-red-500 focus:border-red-500' : ''}`}
                      placeholder={language === 'en' ? "Enter your email" : "Entrez votre email"}
                    />
                    {validationErrors.email && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.email}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="phone">{t[language].phone} *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={customerInfo.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className={`mt-1 ${validationErrors.phone ? 'border-red-500 focus:border-red-500' : ''}`}
                      placeholder={language === 'en' ? "+216 XX XXX XXX" : "+216 XX XXX XXX"}
                    />
                    {validationErrors.phone && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.phone}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="city">{t[language].city}</Label>
                    <Input
                      id="city"
                      value={customerInfo.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      className={`mt-1 ${validationErrors.city ? 'border-red-500 focus:border-red-500' : ''}`}
                      placeholder={language === 'en' ? "Enter your city (optional)" : "Entrez votre ville (optionnel)"}
                    />
                    {validationErrors.city && (
                      <p className="text-red-500 text-xs mt-1">{validationErrors.city}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Summary */}
            {Object.keys(selectedPasses).length > 0 && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-gradient-neon">{t[language].summary}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(selectedPasses).map(([passId, qty]) => {
                      const pass = passTypes.find(p => p.id === passId);
                      if (!pass) return null;
                      return (
                        <div key={passId} className="flex justify-between">
                          <span>{pass.name} x {qty}</span>
                          <span>{pass.price * qty} TND</span>
                        </div>
                      );
                    })}
                    <div className="border-t pt-3">
                      <div className="flex justify-between font-bold text-lg">
                        <span>{t[language].total}:</span>
                        <span className="text-primary">{totalPrice} TND</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    onClick={handlePurchase}
                    disabled={processing}
                    className="w-full mt-6 btn-gradient"
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
      </div>
    </div>
  );
};

export default PassPurchase; 