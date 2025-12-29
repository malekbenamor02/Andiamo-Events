import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, CheckCircle, XCircle, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import LoadingScreen from '@/components/ui/LoadingScreen';
import { CITIES, SOUSSE_VILLES, TUNIS_VILLES } from '@/lib/constants';

interface CODOrderProps {
  language: 'en' | 'fr';
}

const CODOrder = ({ language }: CODOrderProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId');
  const { toast } = useToast();
  
  const [processing, setProcessing] = useState(false);
  const [formData, setFormData] = useState({
    customer_name: '',
    phone: '',
    email: '',
    city: '',
    ville: '',
    pass_type: 'standard',
    quantity: 1,
    termsAccepted: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const t = language === 'en' ? {
    title: "Cash on Delivery Order",
    subtitle: "Place your order and pay when you receive it",
    backToEvents: "Back to Events",
    customerName: "Full Name",
    phone: "Phone Number",
    email: "Email (Optional)",
    city: "City",
    ville: "Ville (Neighborhood)",
    passType: "Pass Type",
    quantity: "Quantity",
    standard: "Standard Pass",
    vip: "VIP Pass",
    acceptTerms: "By placing this order, you agree to our",
    termsLink: "Terms of Service",
    refundLink: "Refund & Cancellation Policy",
    termsRequired: "You must accept the Terms of Service and Refund & Cancellation Policy",
    submit: "Submit Order",
    processing: "Processing...",
    success: "Order submitted successfully!",
    successMessage: "Your order has been submitted. An ambassador will contact you soon.",
    error: "Error",
    required: "This field is required",
    invalidPhone: "Invalid phone number format (8 digits starting with 2, 5, 9, or 4)",
    invalidEmail: "Invalid email format",
    villeRequired: "Ville is required when city is Sousse"
  } : {
    title: "Commande Paiement à la Livraison",
    subtitle: "Passez votre commande et payez à la réception",
    backToEvents: "Retour aux Événements",
    customerName: "Nom Complet",
    phone: "Numéro de Téléphone",
    email: "Email (Optionnel)",
    city: "Ville",
    ville: "Quartier",
    passType: "Type de Pass",
    quantity: "Quantité",
    standard: "Pass Standard",
    vip: "Pass VIP",
    acceptTerms: "En passant cette commande, vous acceptez nos",
    termsLink: "Conditions d'Utilisation",
    refundLink: "Politique de Remboursement et d'Annulation",
    termsRequired: "Vous devez accepter les Conditions d'Utilisation et la Politique de Remboursement et d'Annulation",
    submit: "Soumettre la Commande",
    processing: "Traitement...",
    success: "Commande soumise avec succès!",
    successMessage: "Votre commande a été soumise. Un ambassadeur vous contactera bientôt.",
    error: "Erreur",
    required: "Ce champ est obligatoire",
    invalidPhone: "Format de numéro invalide (8 chiffres commençant par 2, 5, 9 ou 4)",
    invalidEmail: "Format d'email invalide",
    villeRequired: "Le quartier est requis lorsque la ville est Sousse"
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.customer_name.trim()) {
      newErrors.customer_name = t.required;
    }

    if (!formData.phone.trim()) {
      newErrors.phone = t.required;
    } else {
      const phoneRegex = /^[2594][0-9]{7}$/;
      if (!phoneRegex.test(formData.phone)) {
        newErrors.phone = t.invalidPhone;
      }
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t.invalidEmail;
    }

    if (!formData.city) {
      newErrors.city = t.required;
    }

    if ((formData.city === 'Sousse' || formData.city === 'Tunis') && !formData.ville) {
      newErrors.ville = t.villeRequired;
    }

    if (!formData.termsAccepted) {
      newErrors.termsAccepted = t.termsRequired;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: t.error,
        description: "Please fix the errors in the form",
        variant: "destructive"
      });
      return;
    }

    setProcessing(true);

    try {
      // Calculate price (you may want to fetch from a pricing table)
      const passPrice = formData.pass_type === 'vip' ? 50 : 30; // Example prices
      const totalPrice = passPrice * formData.quantity;

      // Create the order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          source: 'platform_cod',
          user_name: formData.customer_name, // Database uses user_name
          user_phone: formData.phone, // Database uses user_phone
          user_email: formData.email || null, // Database uses user_email
          city: formData.city,
          ville: formData.ville || null,
          pass_type: formData.pass_type,
          quantity: formData.quantity,
          total_price: totalPrice,
          payment_method: 'cod', // Use payment_method instead of payment_type
          status: 'PENDING_ADMIN_APPROVAL' // COD orders always start as PENDING_ADMIN_APPROVAL
        })
        .select()
        .single();

      if (orderError) throw orderError;


      toast({
        title: t.success,
        description: t.successMessage,
        variant: "default"
      });

      // Reset form
      setFormData({
        customer_name: '',
        phone: '',
        email: '',
        city: '',
        ville: '',
        pass_type: 'standard',
        quantity: 1,
        termsAccepted: false
      });

      // Redirect after a delay
      setTimeout(() => {
        navigate('/events');
      }, 2000);

    } catch (error: any) {
      console.error('Error submitting order:', error);
      toast({
        title: t.error,
        description: error.message || "Failed to submit order. Please try again.",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  if (processing) {
    return (
      <LoadingScreen 
        variant="default" 
        size="fullscreen" 
        text={t.processing}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-dark pt-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate('/events')}
            className="text-white hover:text-primary mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t.backToEvents}
          </Button>
        </div>

        <Card className="bg-card/95 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-gradient-neon">
              {t.title}
            </CardTitle>
            <p className="text-muted-foreground mt-2">{t.subtitle}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Customer Name */}
              <div>
                <Label htmlFor="customer_name">{t.customerName} *</Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className={errors.customer_name ? 'border-red-500' : ''}
                />
                {errors.customer_name && (
                  <p className="text-sm text-red-500 mt-1">{errors.customer_name}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <Label htmlFor="phone">{t.phone} *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                  maxLength={8}
                  placeholder="2XXXXXXX"
                  className={errors.phone ? 'border-red-500' : ''}
                />
                {errors.phone && (
                  <p className="text-sm text-red-500 mt-1">{errors.phone}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email">{t.email}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-red-500 mt-1">{errors.email}</p>
                )}
              </div>

              {/* City */}
              <div>
                <Label htmlFor="city">{t.city} *</Label>
                <Select
                  value={formData.city}
                  onValueChange={(value) => setFormData({ ...formData, city: value, ville: '' })}
                >
                  <SelectTrigger className={errors.city ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    {CITIES.map(city => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.city && (
                  <p className="text-sm text-red-500 mt-1">{errors.city}</p>
                )}
              </div>

              {/* Ville (only if city is Sousse) */}
              {(formData.city === 'Sousse' || formData.city === 'Tunis') && (
                <div>
                  <Label htmlFor="ville">{t.ville} *</Label>
                  <Select
                    value={formData.ville}
                    onValueChange={(value) => setFormData({ ...formData, ville: value })}
                  >
                    <SelectTrigger className={errors.ville ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select ville" />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.city === 'Sousse' && SOUSSE_VILLES.map(ville => (
                        <SelectItem key={ville} value={ville}>{ville}</SelectItem>
                      ))}
                      {formData.city === 'Tunis' && TUNIS_VILLES.map(ville => (
                        <SelectItem key={ville} value={ville}>{ville}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.ville && (
                    <p className="text-sm text-red-500 mt-1">{errors.ville}</p>
                  )}
                </div>
              )}

              {/* Pass Type */}
              <div>
                <Label htmlFor="pass_type">{t.passType}</Label>
                <Select
                  value={formData.pass_type}
                  onValueChange={(value) => setFormData({ ...formData, pass_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">{t.standard}</SelectItem>
                    <SelectItem value="vip">{t.vip}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity */}
              <div>
                <Label htmlFor="quantity">{t.quantity}</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>

              {/* Terms and Conditions */}
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={formData.termsAccepted}
                  onCheckedChange={(checked) => setFormData({ ...formData, termsAccepted: checked === true })}
                  className={errors.termsAccepted ? 'border-red-500' : ''}
                />
                <Label htmlFor="terms" className="text-sm leading-relaxed peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {t.acceptTerms}{' '}
                  <Link to="/terms" className="text-primary hover:underline underline-offset-2">
                    {t.termsLink}
                  </Link>
                  {' '}{language === 'en' ? 'and' : 'et'}{' '}
                  <Link to="/refund-policy" className="text-primary hover:underline underline-offset-2">
                    {t.refundLink}
                  </Link>
                  .
                </Label>
              </div>
              {errors.termsAccepted && (
                <p className="text-sm text-red-500">{errors.termsAccepted}</p>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={processing}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                {processing ? t.processing : t.submit}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CODOrder;

