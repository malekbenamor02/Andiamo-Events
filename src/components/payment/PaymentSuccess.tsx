import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface PaymentSuccessProps {
  language?: 'en' | 'fr';
}

const PaymentSuccess = ({ language = 'en' }: PaymentSuccessProps) => {
  const navigate = useNavigate();

  const t = {
    en: {
      title: 'Payment Successful',
      description: 'Your payment has been confirmed.\nYou will receive your tickets via email shortly.',
      backToEvents: 'Back to Events'
    },
    fr: {
      title: 'Paiement Réussi',
      description: 'Votre paiement a été confirmé.\nVous recevrez vos billets par email sous peu.',
      backToEvents: 'Retour aux Événements'
    }
  };

  const handleBackToEvents = () => {
    navigate('/events');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background Gradient */}
      <div 
        className="absolute inset-0 bg-gradient-to-b from-black via-[#0a0a0a] to-[#1a1a1a]"
        aria-hidden="true"
      />
      
      {/* Subtle Red Glow (Optional - low opacity) */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          background: 'radial-gradient(circle at 30% 50%, hsl(352 80% 49% / 0.4) 0%, transparent 50%), radial-gradient(circle at 70% 50%, hsl(352 80% 49% / 0.3) 0%, transparent 50%)',
        }}
        aria-hidden="true"
      />

      {/* Success Card */}
      <Card 
        className="w-full max-w-[480px] relative z-10 rounded-[20px] backdrop-blur-xl"
        style={{
          background: 'rgba(31, 31, 31, 0.75)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        }}
      >
        <CardContent className="p-[40px] text-center animate-page-intro">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative w-[72px] h-[72px] flex items-center justify-center">
              {/* Glow effect - subtle pulse animation */}
              <div 
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, hsl(142, 65%, 52% / 0.25) 0%, transparent 70%)',
                  animation: 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }}
                aria-hidden="true"
              />
              {/* Icon with soft green color and glow */}
              <CheckCircle 
                className="w-[72px] h-[72px] relative z-10"
                style={{
                  color: 'hsl(142, 65%, 52%)',
                  filter: 'drop-shadow(0 0 16px hsl(142, 65%, 52% / 0.4))',
                }}
                strokeWidth={2}
              />
            </div>
          </div>

          {/* Title */}
          <h1 
            className="text-3xl md:text-4xl font-semibold mb-4"
            style={{
              color: 'hsl(352, 80%, 49%)',
              textShadow: '0 0 20px hsl(352, 80%, 49% / 0.25)',
            }}
          >
            {t[language].title}
          </h1>

          {/* Description */}
          <p 
            className="text-base mb-8 whitespace-pre-line"
            style={{
              color: 'hsl(0, 0%, 72%)',
              lineHeight: '1.6',
            }}
          >
            {t[language].description}
          </p>

          {/* Back to Events Button */}
          <Button
            onClick={handleBackToEvents}
            className="w-full btn-gradient rounded-full py-6 text-base font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              boxShadow: '0 4px 20px hsl(352, 80%, 49% / 0.3)',
            }}
          >
            {t[language].backToEvents}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;

