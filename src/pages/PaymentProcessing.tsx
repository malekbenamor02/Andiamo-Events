import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getOrderById, updateOrderStatus } from '@/lib/orders/orderService';
import { OrderStatus } from '@/lib/constants/orderStatuses';
import PaymentSuccess from '@/components/payment/PaymentSuccess';
// Payment generation and verification now handled via backend API

interface PaymentProcessingProps {
  language: 'en' | 'fr';
}

const PaymentProcessing = ({ language }: PaymentProcessingProps) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const orderId = searchParams.get('orderId');
  
  // Get reCAPTCHA site key from environment
  const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  
  const [status, setStatus] = useState<'loading' | 'redirecting' | 'verifying' | 'success' | 'failed' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const t = {
    en: {
      title: 'Processing Payment',
      redirecting: 'Redirecting to payment gateway...',
      verifying: 'Verifying payment...',
      success: 'Payment Successful',
      successMessage: 'Your payment has been confirmed. You will receive your tickets via email shortly.',
      failed: 'Payment Failed',
      failedMessage: 'Your payment could not be processed. Please try again.',
      error: 'Error',
      errorMessage: 'An error occurred while processing your payment.',
      backToEvents: 'Back to Events',
      retry: 'Retry Payment'
    },
    fr: {
      title: 'Traitement du Paiement',
      redirecting: 'Redirection vers la passerelle de paiement...',
      verifying: 'Vérification du paiement...',
      success: 'Paiement Réussi',
      successMessage: 'Votre paiement a été confirmé. Vous recevrez vos billets par email sous peu.',
      failed: 'Paiement Échoué',
      failedMessage: 'Votre paiement n\'a pas pu être traité. Veuillez réessayer.',
      error: 'Erreur',
      errorMessage: 'Une erreur s\'est produite lors du traitement de votre paiement.',
      backToEvents: 'Retour aux Événements',
      retry: 'Réessayer le Paiement'
    }
  };

  useEffect(() => {
    if (!orderId) {
      setStatus('error');
      setErrorMessage(t[language].errorMessage);
      return;
    }

    const statusParam = searchParams.get('status');
    
    // If we're returning from Flouci, handle verification in the second useEffect
    // Don't initialize payment again
    if (statusParam === 'success' || statusParam === 'failed') {
      console.log('🔄 Returning from Flouci, skipping payment initialization');
      // Verification will be handled by the second useEffect
      return;
    }

    // Only initialize payment if we're NOT returning from Flouci
    // Check if order is already paid first
    const checkOrderStatus = async () => {
      try {
        const order = await getOrderById(orderId!);
        if (order?.status === OrderStatus.PAID) {
          setStatus('success');
          return;
        }
        if (order?.status === OrderStatus.CANCELLED) {
          setStatus('failed');
          setErrorMessage(language === 'en' ? 'This order has been cancelled' : 'Cette commande a été annulée');
          return;
        }
        // Order not paid yet, initialize payment
        initializePayment();
      } catch (error) {
        console.error('Error checking order status:', error);
        initializePayment();
      }
    };
    
    checkOrderStatus();
  }, [orderId, searchParams]);

  const initializePayment = async () => {
    try {
      // Fetch order details
      const order = await getOrderById(orderId!);
      if (!order) {
        setStatus('error');
        setErrorMessage(language === 'en' ? 'Order not found' : 'Commande introuvable');
        return;
      }

      // Check if order is already paid
      if (order.status === OrderStatus.PAID) {
        setStatus('success');
        return;
      }

      // Check if order is cancelled
      if (order.status === OrderStatus.CANCELLED) {
        setStatus('failed');
        setErrorMessage(language === 'en' ? 'This order has been cancelled' : 'Cette commande a été annulée');
        return;
      }

      // Build URLs
      const baseUrl = window.location.origin;
      const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : '');
      const successLink = `${baseUrl}/payment-processing?orderId=${orderId}&status=success`;
      const failLink = `${baseUrl}/payment-processing?orderId=${orderId}&status=failed`;
      const webhookUrl = `${apiBase || baseUrl}/api/flouci-webhook`;

      // Generate Flouci payment via backend (keeps secret key secure)
      setStatus('redirecting');
      const paymentResponse = await fetch(`${apiBase}/api/flouci-generate-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: orderId!,
          amount: Number(order.total_price),
          successLink,
          failLink,
          webhookUrl
        })
      });

      const paymentData = await paymentResponse.json();

      if (!paymentResponse.ok) {
        // Check if order is already paid
        if (paymentData.alreadyPaid) {
          setStatus('success');
          toast({
            title: t[language].success,
            description: language === 'en' 
              ? 'This order has already been paid.' 
              : 'Cette commande a déjà été payée.',
            variant: 'default'
          });
          return;
        }

        // Show more detailed error message
        const errorMsg = paymentData.error || paymentData.flouciError?.message || paymentData.details?.message || 'Failed to generate payment';
        console.error('Payment generation error details:', paymentData);
        throw new Error(errorMsg);
      }

      if (!paymentData.success || !paymentData.link) {
        throw new Error(paymentData.error || 'Failed to generate payment');
      }

      // If this is a duplicate submission, log it but still redirect
      if (paymentData.isDuplicate) {
        console.log('⚠️ Duplicate payment generation prevented, using existing payment link');
      }

      // Redirect to Flouci payment page
      window.location.href = paymentData.link;

    } catch (error: any) {
      console.error('Payment initialization error:', error);
      setStatus('error');
      setErrorMessage(error.message || t[language].errorMessage);
    }
  };

  useEffect(() => {
    // This useEffect handles verification when returning from Flouci
    if (!orderId) return;
    
    const statusParam = searchParams.get('status');
    const paymentId = searchParams.get('payment_id') || searchParams.get('id');
    
    console.log('🔄 PaymentProcessing verification useEffect - status:', statusParam, 'paymentId:', paymentId, 'orderId:', orderId);
    
    // Only process if we have a status parameter (returning from Flouci)
    if (!statusParam) {
      return; // Not returning from Flouci, first useEffect will handle initialization
    }

    // If we have status=success, verify payment
    if (statusParam === 'success') {
      console.log('✅ Status is success, verifying payment...');
      if (paymentId) {
        console.log('🔍 Verifying payment with paymentId from URL:', paymentId);
        verifyPayment(paymentId);
      } else {
        // Success but no payment_id - verify via order's payment_gateway_reference
        console.log('⏳ No paymentId in URL, verifying via order...');
        setStatus('verifying');
        verifyPaymentByOrder();
      }
    } else if (statusParam === 'failed') {
      console.log('❌ Status is failed');
      setStatus('failed');
    }
  }, [searchParams, orderId]);

  // Verify payment by order (if payment_id not in URL)
  const verifyPaymentByOrder = async () => {
    try {
      setStatus('verifying');
      const order = await getOrderById(orderId!);
      if (order?.payment_gateway_reference) {
        console.log('📦 Found payment_id in order:', order.payment_gateway_reference);
        verifyPayment(order.payment_gateway_reference);
      } else {
        // No payment reference yet, might still be processing
        console.log('⏳ No payment_id yet, retrying...');
        setStatus('verifying');
        setTimeout(() => verifyPaymentByOrder(), 2000);
      }
    } catch (error) {
      console.error('❌ Error verifying payment by order:', error);
      setStatus('error');
      setErrorMessage(language === 'en' ? 'Failed to verify payment' : 'Échec de la vérification du paiement');
    }
  };

  const verifyPayment = async (paymentId: string) => {
    try {
      console.log('🔍 verifyPayment called with paymentId:', paymentId, 'orderId:', orderId);
      setStatus('verifying');

      const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : '');
      console.log('🌐 API Base URL:', apiBase || 'default (same origin)');

      // Verify payment via backend (keeps secret key secure)
      const verifyResponse = await fetch(`${apiBase}/api/flouci-verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ paymentId, orderId: orderId! })
      });

      console.log('📡 Verification response status:', verifyResponse.status);

      const verifyData = await verifyResponse.json();
      console.log('📦 Verification response data:', verifyData);

      if (!verifyResponse.ok || !verifyData.success) {
        console.error('❌ Verification failed:', verifyData);
        throw new Error(verifyData.error || 'Payment verification failed');
      }

      const paymentStatus = verifyData.status;
      console.log('💰 Payment status from Flouci:', paymentStatus);

      if (paymentStatus === 'SUCCESS') {
        console.log('✅ Payment verified as SUCCESS!');
        console.log('📦 Order updated by backend:', verifyData.orderUpdated ? 'Yes' : 'No');
        
        // Backend already updates the order, but we can also update via frontend as backup
        // Check if backend updated it first
        if (!verifyData.orderUpdated) {
          console.log('⚠️ Backend did not update order, updating from frontend...');
          try {
            await updateOrderStatus({
              orderId: orderId!,
              status: OrderStatus.PAID,
              metadata: {
                payment_gateway_reference: paymentId,
                payment_response_data: verifyData.result
              }
            });
            console.log('✅ Order updated from frontend');
          } catch (updateError) {
            console.error('❌ Error updating order from frontend:', updateError);
            // Don't fail - backend might have updated it
          }
        } else {
          console.log('✅ Order already updated by backend');
        }

        // Trigger ticket generation and email sending (backup to webhook)
        // Add a small delay to ensure order status is fully updated in database
        setTimeout(async () => {
          try {
            console.log('🎫 Triggering ticket generation for order:', orderId);
            const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : '');
            
            // Get reCAPTCHA token for ticket generation endpoint
            let recaptchaToken = 'localhost-bypass-token';
            const isLocalhost = window.location.hostname === 'localhost' || 
                               window.location.hostname === '127.0.0.1' ||
                               window.location.hostname.startsWith('192.168.') ||
                               window.location.hostname.startsWith('10.0.');
            
            if (!isLocalhost && window.grecaptcha && RECAPTCHA_SITE_KEY) {
              try {
                recaptchaToken = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'generate_tickets' });
              } catch (recaptchaError) {
                console.warn('⚠️ reCAPTCHA execution failed, using bypass token:', recaptchaError);
              }
            }
            
            const ticketResponse = await fetch(`${apiBase}/api/generate-tickets-for-order`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include', // Include cookies for admin auth
              body: JSON.stringify({ 
                orderId: orderId!,
                recaptchaToken: recaptchaToken
              }),
            });

            if (ticketResponse.ok) {
              const ticketData = await ticketResponse.json();
              console.log('✅ Tickets generated:', ticketData);
              if (ticketData.emailSent) {
                console.log('✅ Email sent successfully');
              } else {
                console.warn('⚠️ Email not sent:', ticketData.emailError);
              }
              if (ticketData.smsSent) {
                console.log('✅ SMS sent successfully');
              } else {
                console.warn('⚠️ SMS not sent:', ticketData.smsError);
              }
            } else {
              const errorData = await ticketResponse.json().catch(() => ({}));
              console.warn('⚠️ Ticket generation response not OK:', ticketResponse.status, errorData);
              // Don't fail the payment success - tickets can be generated manually
            }
          } catch (ticketError) {
            console.error('❌ Error triggering ticket generation:', ticketError);
            // Don't fail the payment success - tickets can be generated manually
          }
        }, 2000); // 2 second delay to ensure order status is updated

        setStatus('success');
        toast({
          title: t[language].success,
          description: t[language].successMessage,
          variant: 'default'
        });
      } else if (paymentStatus === 'FAILURE' || paymentStatus === 'EXPIRED') {
        setStatus('failed');
        toast({
          title: t[language].failed,
          description: t[language].failedMessage,
          variant: 'destructive'
        });
      } else {
        // PENDING - wait a bit and retry
        setTimeout(() => {
          verifyPayment(paymentId);
        }, 2000);
      }
    } catch (error: any) {
      console.error('Payment verification error:', error);
      setStatus('error');
      setErrorMessage(error.message || t[language].errorMessage);
    }
  };

  const handleRetry = () => {
    setStatus('loading');
    setErrorMessage('');
    initializePayment();
  };

  const handleBackToEvents = () => {
    navigate('/events');
  };

  // Success Screen
  if (status === 'success') {
    return <PaymentSuccess language={language} />;
  }

  // Failed Screen
  if (status === 'failed') {
    return (
      <div className="min-h-screen bg-gradient-dark pt-16 flex items-center justify-center px-4">
        <Card className="w-full max-w-md glass border-2 border-red-500/30">
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <XCircle className="w-20 h-20 text-red-500" />
            </div>
            <h2 className="text-3xl font-bold text-gradient-neon mb-2">
              {t[language].failed}
            </h2>
            <p className="text-muted-foreground mb-6">
              {t[language].failedMessage}
            </p>
            <div className="space-y-2">
              <Button onClick={handleRetry} className="w-full btn-gradient">
                {t[language].retry}
              </Button>
              <Button onClick={handleBackToEvents} variant="outline" className="w-full">
                {t[language].backToEvents}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error Screen
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-dark pt-16 flex items-center justify-center px-4">
        <Card className="w-full max-w-md glass border-2 border-amber-500/30">
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-20 h-20 text-amber-500" />
            </div>
            <h2 className="text-3xl font-bold text-gradient-neon mb-2">
              {t[language].error}
            </h2>
            <p className="text-muted-foreground mb-6">
              {errorMessage || t[language].errorMessage}
            </p>
            <div className="space-y-2">
              <Button onClick={handleRetry} className="w-full btn-gradient">
                {t[language].retry}
              </Button>
              <Button onClick={handleBackToEvents} variant="outline" className="w-full">
                {t[language].backToEvents}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redirecting Screen - Shows before redirecting to Flouci
  if (status === 'redirecting') {
    return (
      <div className="min-h-screen bg-gradient-dark pt-16 flex items-center justify-center px-4">
        <Card className="w-full max-w-md glass border-2 border-primary/30">
          <CardContent className="p-8 text-center">
            <div className="flex justify-center mb-4">
              <Loader2 className="w-16 h-16 text-primary animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gradient-neon mb-2">
              {t[language].redirecting}
            </h2>
            <p className="text-muted-foreground mb-4">
              {language === 'en' 
                ? 'Redirecting to secure payment page...' 
                : 'Redirection vers la page de paiement sécurisée...'}
            </p>
            <p className="text-sm text-muted-foreground">
              {language === 'en' 
                ? 'You will be redirected to Flouci\'s secure payment page to complete your transaction.' 
                : 'Vous serez redirigé vers la page de paiement sécurisée de Flouci pour finaliser votre transaction.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading/Processing Screen
  return (
    <div className="min-h-screen bg-gradient-dark pt-16 flex items-center justify-center px-4">
      <Card className="w-full max-w-md glass">
        <CardContent className="p-8 text-center">
          <div className="flex justify-center mb-4">
            <Loader2 className="w-16 h-16 text-primary animate-spin" />
          </div>
          <h2 className="text-2xl font-bold text-gradient-neon mb-2">
            {t[language].title}
          </h2>
          <p className="text-muted-foreground">
            {status === 'verifying'
              ? t[language].verifying
              : t[language].redirecting}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentProcessing;

