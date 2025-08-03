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
  const [selectedPassType, setSelectedPassType] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
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

  const selectedPass = passTypes.find(p => p.id === selectedPassType);
  const totalPrice = selectedPass ? selectedPass.price * quantity : 0;

  // Auto-select standard pass if it's the only option
  useEffect(() => {
    if (passTypes.length === 1 && passTypes[0].id === 'standard') {
      setSelectedPassType('standard');
    }
  }, [passTypes]);

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
    if (!selectedPassType) {
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
      <div className="min-h-screen bg-gradient-dark flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
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
          <h1 className="text-3xl font-orbitron font-bold text-gradient-neon ml-4">
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
            {/* Pass Types */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-gradient-neon">{t[language].passSelection}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {passTypes.map((passType) => (
                    <div
                      key={passType.id}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all duration-300 ${
                        selectedPassType === passType.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      } ${!passType.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => passType.available && setSelectedPassType(passType.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-primary">{passType.name}</h3>
                        <Badge variant={passType.available ? 'default' : 'secondary'}>
                          {passType.available ? t[language].available : t[language].outOfStock}
                        </Badge>
                      </div>
                      <p className="text-2xl font-bold text-primary mb-2">
                        {passType.price} TND
                      </p>
                      <p className="text-sm text-muted-foreground mb-3">
                        {passType.description}
                      </p>
                    </div>
                  ))}
                </div>

                {selectedPass && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <Label htmlFor="quantity">{t[language].quantity}:</Label>
                      <Select value={quantity.toString()} onValueChange={(value) => setQuantity(parseInt(value))}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map(num => (
                            <SelectItem key={num} value={num.toString()}>
                              {num}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
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
            {selectedPass && (
              <Card className="glass">
                <CardHeader>
                  <CardTitle className="text-gradient-neon">{t[language].summary}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span>{selectedPass.name} x {quantity}</span>
                      <span>{selectedPass.price * quantity} TND</span>
                    </div>
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