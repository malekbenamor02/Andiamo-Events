import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreditCard, Lock, Loader2 } from 'lucide-react';

interface CustomPaymentFormProps {
  amount: number;
  orderId: string;
  onPaymentInitiated: (paymentLink: string) => void;
  language: 'en' | 'fr';
}

const CustomPaymentForm = ({ amount, orderId, onPaymentInitiated, language }: CustomPaymentFormProps) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const t = {
    en: {
      title: 'Payment Information',
      cardNumber: 'Card Number',
      cardNumberPlaceholder: '1234 5678 9012 3456',
      expiry: 'Expiry Date',
      expiryPlaceholder: 'MM/YY',
      cvv: 'CVV',
      cvvPlaceholder: '123',
      cardholderName: 'Cardholder Name',
      cardholderNamePlaceholder: 'John Doe',
      payNow: 'Pay Now',
      processing: 'Processing...',
      securePayment: 'Your payment is secured by Flouci',
      invalidCardNumber: 'Invalid card number',
      invalidExpiry: 'Invalid expiry date (MM/YY)',
      invalidCvv: 'Invalid CVV',
      invalidName: 'Please enter cardholder name'
    },
    fr: {
      title: 'Informations de Paiement',
      cardNumber: 'Numéro de Carte',
      cardNumberPlaceholder: '1234 5678 9012 3456',
      expiry: 'Date d\'Expiration',
      expiryPlaceholder: 'MM/AA',
      cvv: 'CVV',
      cvvPlaceholder: '123',
      cardholderName: 'Nom du Titulaire',
      cardholderNamePlaceholder: 'Jean Dupont',
      payNow: 'Payer Maintenant',
      processing: 'Traitement...',
      securePayment: 'Votre paiement est sécurisé par Flouci',
      invalidCardNumber: 'Numéro de carte invalide',
      invalidExpiry: 'Date d\'expiration invalide (MM/AA)',
      invalidCvv: 'CVV invalide',
      invalidName: 'Veuillez entrer le nom du titulaire'
    }
  };

  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted.slice(0, 19); // Max 16 digits + 3 spaces
  };

  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate card number (13-19 digits)
    const cardNumberClean = cardNumber.replace(/\s/g, '');
    if (!cardNumberClean || cardNumberClean.length < 13 || cardNumberClean.length > 19) {
      newErrors.cardNumber = t[language].invalidCardNumber;
    }

    // Validate expiry (MM/YY)
    const expiryRegex = /^(0[1-9]|1[0-2])\/\d{2}$/;
    if (!expiry || !expiryRegex.test(expiry)) {
      newErrors.expiry = t[language].invalidExpiry;
    }

    // Validate CVV (3-4 digits)
    if (!cvv || cvv.length < 3 || cvv.length > 4) {
      newErrors.cvv = t[language].invalidCvv;
    }

    // Validate cardholder name
    if (!cardholderName.trim() || cardholderName.trim().length < 2) {
      newErrors.cardholderName = t[language].invalidName;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setProcessing(true);

    try {
      // Generate Flouci payment (card details are not sent - Flouci will collect them)
      // We're just using this form for better UX, but Flouci will still collect card info
      const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : '');
      const baseUrl = window.location.origin;
      const successLink = `${baseUrl}/payment-processing?orderId=${orderId}&status=success`;
      const failLink = `${baseUrl}/payment-processing?orderId=${orderId}&status=failed`;
      const webhookUrl = `${apiBase || baseUrl}/api/flouci-webhook`;

      const response = await fetch(`${apiBase}/api/flouci-generate-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount,
          successLink,
          failLink,
          webhookUrl
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.link) {
        throw new Error(data.error || 'Failed to generate payment');
      }

      // Redirect to Flouci payment page
      // Note: Flouci will collect card details on their secure page
      // This form is just for better UX - user will enter card again on Flouci
      onPaymentInitiated(data.link);
      
    } catch (error: any) {
      console.error('Payment error:', error);
      setErrors({ submit: error.message || 'Failed to process payment' });
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card className="glass border-2 border-primary/30">
        <CardHeader>
          <CardTitle className="text-gradient-neon flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            {t[language].title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Card Number */}
          <div>
            <Label htmlFor="cardNumber">{t[language].cardNumber} *</Label>
            <Input
              id="cardNumber"
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
              placeholder={t[language].cardNumberPlaceholder}
              maxLength={19}
              className={errors.cardNumber ? 'border-destructive' : ''}
            />
            {errors.cardNumber && (
              <p className="text-sm text-destructive mt-1">{errors.cardNumber}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Expiry */}
            <div>
              <Label htmlFor="expiry">{t[language].expiry} *</Label>
              <Input
                id="expiry"
                type="text"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                placeholder={t[language].expiryPlaceholder}
                maxLength={5}
                className={errors.expiry ? 'border-destructive' : ''}
              />
              {errors.expiry && (
                <p className="text-sm text-destructive mt-1">{errors.expiry}</p>
              )}
            </div>

            {/* CVV */}
            <div>
              <Label htmlFor="cvv">{t[language].cvv} *</Label>
              <Input
                id="cvv"
                type="text"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder={t[language].cvvPlaceholder}
                maxLength={4}
                className={errors.cvv ? 'border-destructive' : ''}
              />
              {errors.cvv && (
                <p className="text-sm text-destructive mt-1">{errors.cvv}</p>
              )}
            </div>
          </div>

          {/* Cardholder Name */}
          <div>
            <Label htmlFor="cardholderName">{t[language].cardholderName} *</Label>
            <Input
              id="cardholderName"
              type="text"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              placeholder={t[language].cardholderNamePlaceholder}
              className={errors.cardholderName ? 'border-destructive' : ''}
            />
            {errors.cardholderName && (
              <p className="text-sm text-destructive mt-1">{errors.cardholderName}</p>
            )}
          </div>

          {/* Security Notice */}
          <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <Lock className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground">
              {t[language].securePayment}
            </p>
          </div>

          {errors.submit && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <p className="text-sm text-destructive">{errors.submit}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={processing}
            className="w-full btn-gradient"
            size="lg"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t[language].processing}
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                {t[language].payNow} - {amount} TND
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
};

export default CustomPaymentForm;

