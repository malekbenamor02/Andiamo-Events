/**
 * Order Success Screen Component
 * Shows confirmation after order submission with ambassador information
 */

import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { Ambassador, SelectedPass } from '@/types/orders';

interface OrderSuccessScreenProps {
  ambassador: Ambassador | null;
  eventName: string;
  eventDate: string;
  totalPrice: number;
  passes?: SelectedPass[];
  onBackToEvents: () => void;
  language?: 'en' | 'fr';
}

export function OrderSuccessScreen({
  ambassador,
  eventName,
  eventDate,
  totalPrice,
  passes = [],
  onBackToEvents,
  language = 'en'
}: OrderSuccessScreenProps) {
  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const t = language === 'en' ? {
    title: 'Order Submitted Successfully!',
    thankYou: 'Thank you for your order!',
    message: 'Your order has been submitted successfully. The selected ambassador will contact you as soon as possible.',
    backToEvents: 'Back to Events'
  } : {
    title: 'Commande Soumise avec Succès!',
    thankYou: 'Merci pour votre commande!',
    message: 'Votre commande a été soumise avec succès. L\'ambassadeur sélectionné vous contactera dans les plus brefs délais.',
    backToEvents: 'Retour aux Événements'
  };

  return (
    <div className="min-h-screen bg-gradient-dark pt-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl animate-pulse" />
            <CheckCircle className="w-24 h-24 text-green-500 mx-auto relative z-10" />
          </div>
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gradient-neon mb-3">
            {t.title}
          </h1>
          <p className="text-xl text-muted-foreground">
            {t.thankYou}
          </p>
        </div>

        <div className="space-y-6">
          {/* Success Message */}
          <Card className="glass border-2 border-primary/30">
            <CardContent className="p-6">
              <p className="text-center text-base md:text-lg text-foreground">
                {t.message}
              </p>
            </CardContent>
          </Card>

          {/* Back Button */}
          <div className="flex justify-center">
            <Button
              onClick={onBackToEvents}
              className="btn-gradient"
              size="lg"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              {t.backToEvents}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

