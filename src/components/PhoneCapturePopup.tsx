import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { API_ROUTES } from '@/lib/api-routes';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Loader from '@/components/ui/Loader';

interface PhoneCapturePopupProps {
  language: 'en' | 'fr';
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'andiamo_phone_submitted';
const STORAGE_KEY_DISMISSED = 'andiamo_phone_dismissed';

const PhoneCapturePopup: React.FC<PhoneCapturePopupProps> = ({
  language,
  isOpen,
  onClose,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { toast } = useToast();

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const translations = {
    en: {
      title: 'Stay Connected',
      description: 'Get notified about our latest events and exclusive offers',
      placeholder: 'Phone Number',
      submit: 'Subscribe',
      maybeLater: 'Maybe Later',
      invalidPhone: 'Invalid Phone Number',
      alreadyExists: 'This phone number is already registered',
      success: 'Thank you! You\'ll receive updates on our latest events.',
      error: 'Something went wrong. Please try again later.',
    },
    fr: {
      title: 'Restez Connecté',
      description: 'Soyez informé de nos derniers événements et offres exclusives',
      placeholder: 'Numéro de téléphone',
      submit: 'S\'abonner',
      maybeLater: 'Peut-être plus tard',
      invalidPhone: 'Numéro de téléphone invalide',
      alreadyExists: 'Ce numéro de téléphone est déjà enregistré',
      success: 'Merci ! Vous recevrez des mises à jour sur nos derniers événements.',
      error: 'Une erreur s\'est produite. Veuillez réessayer plus tard.',
    },
  };

  const t = translations[language];

  // Validate phone number: exactly 8 digits, numeric only, starts with 2, 4, 5, or 9
  const validatePhone = (phone: string): boolean => {
    const cleaned = phone.replace(/\s+/g, '');
    if (cleaned.length !== 8) return false;
    if (!/^\d+$/.test(cleaned)) return false;
    const firstDigit = cleaned[0];
    return ['2', '4', '5', '9'].includes(firstDigit);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');

    // Clean phone number (remove spaces)
    const cleanedPhone = phoneNumber.replace(/\s+/g, '');

    // Frontend validation
    if (!validatePhone(cleanedPhone)) {
      setError(t.invalidPhone);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(API_ROUTES.PHONE_SUBSCRIBE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: cleanedPhone,
          language: language,
        }),
      });

      // Check if response is ok before parsing JSON
      let data;
      try {
        const text = await response.text();
        if (!text) {
          setError(t.error);
          setIsSubmitting(false);
          return;
        }
        data = JSON.parse(text);
      } catch (parseError) {
        // If response is not JSON, it's likely a server error
        console.error('Failed to parse response as JSON:', parseError);
        setError('Server error. Please try again later.');
        setIsSubmitting(false);
        return;
      }

      if (!response.ok) {
        if (data.error === 'Phone number already exists') {
          setError(t.alreadyExists);
          // Mark as submitted to prevent future popups
          localStorage.setItem(STORAGE_KEY, 'true');
          localStorage.setItem(STORAGE_KEY_DISMISSED, Date.now().toString());
          // Close after a short delay
          setTimeout(() => {
            onClose();
          }, 2000);
        } else {
          setError(data.error || t.error);
        }
        setIsSubmitting(false);
        return;
      }

      // Success
      localStorage.setItem(STORAGE_KEY, 'true');
      localStorage.setItem(STORAGE_KEY_DISMISSED, Date.now().toString());
      
      toast({
        title: t.success,
        variant: 'default',
      });

      setPhoneNumber('');
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error('Error submitting phone number:', err);
      // Check if it's a network error
      if (err instanceof TypeError && (err.message.includes('fetch') || err.message.includes('Failed to fetch'))) {
        setError('Unable to connect to server. Please check your internet connection and try again.');
      } else if (err instanceof Error) {
        setError(err.message || t.error);
      } else {
        setError(t.error);
      }
      setIsSubmitting(false);
    }
  };

  const handleMaybeLater = () => {
    // Store dismissal timestamp (but not submission) so popup can appear again after 4 days
    localStorage.setItem(STORAGE_KEY_DISMISSED, Date.now().toString());
    onClose();
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Only digits
    if (value.length <= 8) {
      setPhoneNumber(value);
      setError(''); // Clear error on input change
    }
  };

  // Mobile: Use Sheet (bottom sheet)
  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          className={cn(
            "w-full rounded-t-2xl border-t border-border bg-card p-6 pb-8",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-300 ease-out"
          )}
        >
          <SheetHeader className="text-left mb-6">
            <SheetTitle className="text-2xl font-semibold text-foreground">
              {t.title}
            </SheetTitle>
            <SheetDescription className="text-base text-muted-foreground mt-2">
              {t.description}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="tel"
                placeholder={t.placeholder}
                value={phoneNumber}
                onChange={handlePhoneChange}
                className={cn(
                  "h-14 text-base",
                  error && "border-destructive focus-visible:ring-destructive"
                )}
                maxLength={8}
                autoFocus
                disabled={isSubmitting}
              />
              {error && (
                <p className="text-sm text-destructive mt-1">{error}</p>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting || !phoneNumber}
                className="h-14 text-base font-medium w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader size="sm" className="shrink-0 [background:white]" />
                    {t.submit}
                  </span>
                ) : (
                  t.submit
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleMaybeLater}
                disabled={isSubmitting}
                className="h-12 text-base text-muted-foreground hover:text-foreground"
              >
                {t.maybeLater}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Use Dialog (centered modal)
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "sm:max-w-md",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
          "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          "duration-300 ease-out"
        )}
        onInteractOutside={(e) => {
          // Allow closing by clicking outside
          onClose();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold text-foreground">
            {t.title}
          </DialogTitle>
          <DialogDescription className="text-base text-muted-foreground mt-2">
            {t.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Input
              type="tel"
              placeholder={t.placeholder}
              value={phoneNumber}
              onChange={handlePhoneChange}
              className={cn(
                "h-12",
                error && "border-destructive focus-visible:ring-destructive"
              )}
              maxLength={8}
              autoFocus
              disabled={isSubmitting}
            />
            {error && (
              <p className="text-sm text-destructive mt-1">{error}</p>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={handleMaybeLater}
              disabled={isSubmitting}
              className="sm:order-first"
            >
              {t.maybeLater}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !phoneNumber}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader size="sm" className="shrink-0 [background:white]" />
                  {t.submit}
                </span>
              ) : (
                t.submit
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PhoneCapturePopup;

