import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, CreditCard, User, Mail, Phone, MapPin, CheckCircle, Loader2, Calendar, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CITIES, SOUSSE_VILLES, TUNIS_VILLES } from '@/lib/constants';

interface OnlinePaymentProps {
  language: 'en' | 'fr';
}

interface PassOption {
  id: string;
  name: string;
  price: number;
  description?: string;
}

const OnlinePayment = ({ language }: OnlinePaymentProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // 4 Pass options
  const [passes] = useState<PassOption[]>([
    { id: 'pass1', name: language === 'en' ? 'Standard Pass' : 'Pass Standard', price: 50, description: language === 'en' ? 'Basic entry to the event' : 'Entrée de base à l\'événement' },
    { id: 'pass2', name: language === 'en' ? 'VIP Pass' : 'Pass VIP', price: 100, description: language === 'en' ? 'VIP access with premium benefits' : 'Accès VIP avec avantages premium' },
    { id: 'pass3', name: language === 'en' ? 'Premium Pass' : 'Pass Premium', price: 150, description: language === 'en' ? 'Premium experience with all benefits' : 'Expérience premium avec tous les avantages' },
    { id: 'pass4', name: language === 'en' ? 'Platinum Pass' : 'Pass Platine', price: 200, description: language === 'en' ? 'Ultimate experience with exclusive access' : 'Expérience ultime avec accès exclusif' }
  ]);

  const [selectedPasses, setSelectedPasses] = useState<Record<string, number>>({});
  const [customerInfo, setCustomerInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: '',
    ville: ''
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Event details
  const eventDetails = {
    name: language === 'en' ? 'Winter Night Festival' : 'Festival de Nuit d\'Hiver',
    date: '2025-12-20',
    venue: language === 'en' ? 'Grand Arena' : 'Grande Arène',
    city: 'Tunis',
    description: language === 'en' 
      ? 'Join us for an unforgettable winter night of music, dance, and entertainment. Experience the best of nightlife with top DJs and performers in a magical winter atmosphere.'
      : 'Rejoignez-nous pour une nuit d\'hiver inoubliable de musique, de danse et de divertissement. Découvrez le meilleur de la vie nocturne avec les meilleurs DJ et artistes dans une atmosphère hivernale magique.',
    poster_url: '/assets/andiamo.png'
  };

  const t = {
    en: {
      title: "Online Payment",
      subtitle: "Complete your order and proceed to payment",
      personalInfo: "Personal Information",
      passSelection: "Select Your Passes",
      fullName: "Full Name",
      email: "Email Address",
      phone: "Phone Number",
      city: "City",
      ville: "Ville (Neighborhood)",
      quantity: "Quantity",
      total: "Total Amount",
      acceptTerms: "I accept the",
      termsLink: "Terms of Service",
      and: "and",
      refundLink: "Refund & Cancellation Policy",
      submit: "Submit Order",
      processing: "Processing...",
      required: "This field is required",
      invalidEmail: "Please enter a valid email",
      invalidPhone: "Invalid phone number format (8 digits starting with 2, 5, 9, or 4)",
      invalidName: "Please enter a valid name (minimum 2 characters)",
      selectAtLeastOnePass: "Please select at least one pass",
      termsRequired: "You must accept the Terms of Service and Refund & Cancellation Policy",
      success: "Order submitted successfully!",
      successMessage: "We will send you an email attached with your QR codes.",
      error: "Error",
      backToEvents: "Back to Events",
      orderComplete: "Order Complete",
      thankYou: "Thank you for your order!"
    },
    fr: {
      title: "Paiement en Ligne",
      subtitle: "Complétez votre commande et procédez au paiement",
      personalInfo: "Informations Personnelles",
      passSelection: "Sélectionnez Vos Passes",
      fullName: "Nom Complet",
      email: "Adresse Email",
      phone: "Numéro de Téléphone",
      city: "Ville",
      ville: "Quartier",
      quantity: "Quantité",
      total: "Montant Total",
      acceptTerms: "J'accepte les",
      termsLink: "Conditions d'Utilisation",
      and: "et",
      refundLink: "Politique de Remboursement et d'Annulation",
      submit: "Soumettre la Commande",
      processing: "Traitement...",
      required: "Ce champ est requis",
      invalidEmail: "Veuillez entrer un email valide",
      invalidPhone: "Format de numéro invalide (8 chiffres commençant par 2, 5, 9 ou 4)",
      invalidName: "Veuillez entrer un nom valide (minimum 2 caractères)",
      selectAtLeastOnePass: "Veuillez sélectionner au moins un pass",
      termsRequired: "Vous devez accepter les Conditions d'Utilisation et la Politique de Remboursement et d'Annulation",
      success: "Commande soumise avec succès!",
      successMessage: "Nous vous enverrons un email avec vos codes QR en pièce jointe.",
      error: "Erreur",
      backToEvents: "Retour aux Événements",
      orderComplete: "Commande Terminée",
      thankYou: "Merci pour votre commande!"
    }
  };

  const updatePassQuantity = (passId: string, quantity: number) => {
    const clampedQuantity = Math.max(0, Math.min(10, quantity));
    const newPasses = { ...selectedPasses };
    
    if (clampedQuantity === 0) {
      delete newPasses[passId];
    } else {
      newPasses[passId] = clampedQuantity;
    }
    
    setSelectedPasses(newPasses);
    
    // Clear pass validation error
    if (clampedQuantity > 0 && errors.passes) {
      const newErrors = { ...errors };
      delete newErrors.passes;
      setErrors(newErrors);
    }
  };

  const calculateTotal = (): number => {
    let total = 0;
    Object.entries(selectedPasses).forEach(([passId, quantity]) => {
      const pass = passes.find(p => p.id === passId);
      if (pass && quantity > 0) {
        total += pass.price * quantity;
      }
    });
    return total;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate passes
    const hasSelectedPass = Object.values(selectedPasses).some(qty => qty > 0);
    if (!hasSelectedPass) {
      newErrors.passes = t[language].selectAtLeastOnePass;
    }

    // Validate full name
    if (!customerInfo.fullName.trim() || customerInfo.fullName.trim().length < 2) {
      newErrors.fullName = t[language].invalidName;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customerInfo.email.trim() || !emailRegex.test(customerInfo.email)) {
      newErrors.email = t[language].invalidEmail;
    }

    // Validate phone
    const phoneRegex = /^[2594][0-9]{7}$/;
    if (!customerInfo.phone.trim() || !phoneRegex.test(customerInfo.phone)) {
      newErrors.phone = t[language].invalidPhone;
    }

    // Validate city
    if (!customerInfo.city.trim()) {
      newErrors.city = t[language].required;
    }

    // Validate terms
    if (!termsAccepted) {
      newErrors.termsAccepted = t[language].termsRequired;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: t[language].error,
        description: language === 'en' ? 'Please fix the errors in the form' : 'Veuillez corriger les erreurs dans le formulaire',
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);

    try {
      // Calculate order details
      const selectedPassesArray = Object.entries(selectedPasses)
        .filter(([_, qty]) => qty > 0)
        .map(([passId, quantity]) => {
          const pass = passes.find(p => p.id === passId);
          return {
            passId,
            passName: pass?.name || '',
            quantity,
            price: pass?.price || 0
          };
        });

      const totalPrice = calculateTotal();
      const totalQuantity = selectedPassesArray.reduce((sum, p) => sum + p.quantity, 0);
      const primaryPassName = selectedPassesArray.length === 1 
        ? selectedPassesArray[0].passName 
        : 'mixed';

      // Create order (for demo/preview - set to PAID to show successful order)
      const orderData: any = {
        source: 'platform_online',
        user_name: customerInfo.fullName.trim(),
        user_phone: customerInfo.phone.trim(),
        user_email: customerInfo.email.trim(),
        city: customerInfo.city.trim(),
        ville: customerInfo.ville.trim() || null,
        pass_type: primaryPassName,
        quantity: totalQuantity,
        total_price: totalPrice,
        payment_method: 'online',
        status: 'PAID', // For demo: show successful payment
        payment_status: 'PAID', // For demo: show successful payment
        payment_gateway_reference: `DEMO-${Date.now()}`,
        payment_response_data: {
          demo: true,
          processed_at: new Date().toISOString()
        }
      };

      // Add notes with all pass details
      try {
        orderData.notes = JSON.stringify({
          all_passes: selectedPassesArray,
          total_order_price: totalPrice,
          pass_count: selectedPassesArray.length
        });
      } catch (e) {
        console.warn('Could not add notes to order:', e);
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) {
        throw new Error(orderError.message || 'Failed to create order');
      }

      // Show success message
      setProcessing(false);
      setSubmitted(true);

    } catch (error: any) {
      console.error('Order submission error:', error);
      toast({
        title: t[language].error,
        description: error.message || (language === 'en' ? 'Failed to submit order' : 'Échec de la soumission de la commande'),
        variant: "destructive",
      });
      setProcessing(false);
    }
  };

  const totalPrice = calculateTotal();
  const hasSelectedPasses = Object.values(selectedPasses).some(qty => qty > 0);

  // Success Screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-dark pt-16 flex items-center justify-center px-4">
        <Card className="w-full max-w-md glass border-2 border-green-500/30">
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <CheckCircle className="w-20 h-20 text-green-500" />
                <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gradient-neon mb-2">
              {t[language].orderComplete}
            </h2>
            <p className="text-xl text-muted-foreground mb-4">
              {t[language].thankYou}
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              {t[language].successMessage}
            </p>
            <Button onClick={() => navigate('/events')} className="w-full btn-gradient">
              {t[language].backToEvents}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark pt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <div className="space-y-6">
            {/* Event Details */}
            <Card className="glass border-2 border-primary/30 overflow-hidden">
              {eventDetails.poster_url && (
                <div className="relative w-full h-80 bg-gradient-to-br from-card via-card/90 to-card/80">
                  <img
                    src={eventDetails.poster_url}
                    alt={eventDetails.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Hide image if it fails to load
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/50 to-transparent" />
                </div>
              )}
              <CardHeader className="relative">
                <CardTitle className="text-3xl font-heading font-bold text-gradient-neon mb-2">
                  {eventDetails.name}
                </CardTitle>
                {eventDetails.description && (
                  <p className="text-muted-foreground text-base leading-relaxed">
                    {eventDetails.description}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-card/50 border border-primary/20">
                    <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="font-medium">
                      {new Date(eventDetails.date).toLocaleDateString(language, { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-card/50 border border-primary/20">
                    <MapPin className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="font-medium">{eventDetails.venue}, {eventDetails.city}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Personal Information */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-gradient-neon flex items-center gap-2">
                  <User className="w-5 h-5" />
                  {t[language].personalInfo}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fullName">{t[language].fullName} *</Label>
                    <Input
                      id="fullName"
                      value={customerInfo.fullName}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, fullName: e.target.value })}
                      className={errors.fullName ? 'border-destructive' : ''}
                      placeholder="foulen ben foulen"
                    />
                    {errors.fullName && (
                      <p className="text-sm text-destructive mt-1">{errors.fullName}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="email">{t[language].email} *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={customerInfo.email}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                      className={errors.email ? 'border-destructive' : ''}
                      placeholder="foulen@example.com"
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive mt-1">{errors.email}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="phone">{t[language].phone} *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                      className={errors.phone ? 'border-destructive' : ''}
                      maxLength={8}
                    />
                    {errors.phone && (
                      <p className="text-sm text-destructive mt-1">{errors.phone}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="city">{t[language].city} *</Label>
                    <Select
                      value={customerInfo.city}
                      onValueChange={(value) => setCustomerInfo({ ...customerInfo, city: value, ville: '' })}
                    >
                      <SelectTrigger className={errors.city ? 'border-destructive' : ''}>
                        <SelectValue placeholder={language === 'en' ? 'Select city' : 'Sélectionner une ville'} />
                      </SelectTrigger>
                      <SelectContent>
                        {CITIES.map(city => (
                          <SelectItem key={city} value={city}>{city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.city && (
                      <p className="text-sm text-destructive mt-1">{errors.city}</p>
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
                          <SelectValue placeholder={language === 'en' ? 'Select ville (optional)' : 'Sélectionner un quartier (optionnel)'} />
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

            {/* Pass Selection */}
            <Card className="glass">
              <CardHeader>
                <CardTitle className="text-gradient-neon flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  {t[language].passSelection}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {passes.map((pass) => {
                    const quantity = selectedPasses[pass.id] || 0;
                    return (
                      <div
                        key={pass.id}
                        className="border rounded-lg p-4 space-y-4"
                      >
                        <div>
                          <h3 className="text-lg font-semibold mb-1">{pass.name}</h3>
                          <p className="text-2xl font-bold text-primary mb-2">{pass.price} TND</p>
                          {pass.description && (
                            <p className="text-sm text-muted-foreground">{pass.description}</p>
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
                {errors.passes && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <p className="text-red-500 text-sm font-medium">{errors.passes}</p>
                  </div>
                )}
                {!hasSelectedPasses && !errors.passes && (
                  <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-amber-500 text-sm">
                      {language === 'en' ? 'Please select at least one pass to continue' : 'Veuillez sélectionner au moins un pass pour continuer'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Summary & Terms */}
            <Card className="glass border-2 border-primary/30">
              <CardHeader>
                <CardTitle className="text-gradient-neon">{t[language].total}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Selected Passes Summary */}
                {hasSelectedPasses && (
                  <div className="space-y-2 mb-4">
                    {Object.entries(selectedPasses)
                      .filter(([_, qty]) => qty > 0)
                      .map(([passId, quantity]) => {
                        const pass = passes.find(p => p.id === passId);
                        return (
                          <div key={passId} className="flex justify-between text-sm">
                            <span>
                              {pass?.name} x {quantity}
                            </span>
                            <span className="font-semibold">
                              {(pass?.price || 0) * quantity} TND
                            </span>
                          </div>
                        );
                      })}
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between font-bold text-lg">
                        <span>{t[language].total}:</span>
                        <span className="text-primary">{totalPrice} TND</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Terms Acceptance */}
                <div className="space-y-2">
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="terms"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                      className={errors.termsAccepted ? 'border-destructive' : ''}
                    />
                    <Label htmlFor="terms" className="text-sm leading-relaxed">
                      {t[language].acceptTerms}{' '}
                      <span className="text-primary cursor-pointer hover:underline">
                        {t[language].termsLink}
                      </span>
                      {' '}{t[language].and}{' '}
                      <span className="text-primary cursor-pointer hover:underline">
                        {t[language].refundLink}
                      </span>
                    </Label>
                  </div>
                  {errors.termsAccepted && (
                    <p className="text-sm text-destructive">{errors.termsAccepted}</p>
                  )}
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={processing || !hasSelectedPasses}
                  className="w-full btn-gradient disabled:opacity-50 disabled:cursor-not-allowed"
                  size="lg"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t[language].processing}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {t[language].submit}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OnlinePayment;

