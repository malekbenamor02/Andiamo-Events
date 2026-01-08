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
      // CRITICAL: Flouci requires HTTPS URLs for success_link and fail_link
      // Priority: 1. VITE_PUBLIC_URL (manual override), 2. Auto-detect production platforms, 3. window.location.origin (if HTTPS)
      let publicUrl = import.meta.env.VITE_PUBLIC_URL;
      
      if (!publicUrl) {
        const origin = window.location.origin;
        const hostname = window.location.hostname;
        
        // Check if we're on a production platform that always provides HTTPS
        const isProductionPlatform = 
          origin.includes('.vercel.app') || 
          origin.includes('vercel.app') ||
          origin.includes('.netlify.app') ||
          origin.includes('netlify.app') ||
          origin.includes('.railway.app') ||
          origin.includes('railway.app') ||
          origin.includes('.render.com') ||
          origin.includes('render.com') ||
          origin.includes('.fly.dev') ||
          origin.includes('fly.dev') ||
          hostname.includes('.onrender.com') ||
          hostname.includes('.herokuapp.com');
        
        if (isProductionPlatform) {
          // Production platforms automatically provide HTTPS URLs
          publicUrl = origin.startsWith('https://') ? origin : `https://${hostname}${window.location.port ? `:${window.location.port}` : ''}`;
          console.log('✅ Detected production platform, using HTTPS URL:', publicUrl);
        } else if (origin.startsWith('https://')) {
          // Already HTTPS (production or other HTTPS deployment)
          publicUrl = origin;
          console.log('✅ Using HTTPS origin:', publicUrl);
        } else if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || hostname === 'localhost' || hostname === '127.0.0.1') {
          // Localhost HTTP - Flouci won't accept this
          const errorMsg = language === 'en'
            ? '⚠️ HTTPS URL Required for Payment\n\nFlouci payment gateway requires HTTPS URLs for callbacks.\n\n🔧 Quick Fix for Localhost:\n\n1. Install a tunnel service:\n   • ngrok: https://ngrok.com\n   • Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/\n\n2. Start your tunnel:\n   ngrok http 3000\n\n3. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)\n\n4. Add to your .env file:\n   VITE_PUBLIC_URL=https://abc123.ngrok.io\n\n5. Restart your dev server\n\n✅ For Production:\nThe HTTPS URL is automatically detected - no configuration needed!'
            : '⚠️ URL HTTPS Requise pour le Paiement\n\nLa passerelle de paiement Flouci nécessite des URL HTTPS pour les rappels.\n\n🔧 Solution Rapide pour Localhost:\n\n1. Installez un service de tunnel:\n   • ngrok: https://ngrok.com\n   • Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/\n\n2. Démarrez votre tunnel:\n   ngrok http 3000\n\n3. Copiez l\'URL HTTPS (ex: https://abc123.ngrok.io)\n\n4. Ajoutez à votre fichier .env:\n   VITE_PUBLIC_URL=https://abc123.ngrok.io\n\n5. Redémarrez votre serveur de développement\n\n✅ Pour la Production:\nL\'URL HTTPS est automatiquement détectée - aucune configuration nécessaire!';
          
          console.error('❌ Flouci requires HTTPS URLs. Current origin:', origin);
          setStatus('error');
          setErrorMessage(errorMsg);
          return;
        } else if (origin.startsWith('http://')) {
          // Non-localhost HTTP - try to convert to HTTPS (may not work)
          publicUrl = origin.replace('http://', 'https://');
          console.warn('⚠️ Converting HTTP to HTTPS. This may not work. Set VITE_PUBLIC_URL for production.');
        } else {
          // Fallback: construct HTTPS URL from current location
          publicUrl = `https://${hostname}${window.location.port ? `:${window.location.port}` : ''}`;
          console.warn('⚠️ Constructed HTTPS URL from location. Set VITE_PUBLIC_URL for production.');
        }
      }
      
      // Ensure publicUrl is HTTPS (Flouci requirement)
      if (!publicUrl || !publicUrl.startsWith('https://')) {
        console.error('❌ Public URL must be HTTPS for Flouci. Current URL:', publicUrl);
        const errorMsg = language === 'en'
          ? 'Payment Configuration Error\n\nHTTPS URL required for payment callbacks.\n\nPlease set VITE_PUBLIC_URL=https://your-domain.com in your environment variables.\n\nFor localhost development, use a tunnel service (ngrok, cloudflare tunnel) and set VITE_PUBLIC_URL to the tunnel URL.'
          : 'Erreur de Configuration du Paiement\n\nURL HTTPS requise pour les rappels de paiement.\n\nVeuillez définir VITE_PUBLIC_URL=https://votre-domaine.com dans vos variables d\'environnement.\n\nPour le développement localhost, utilisez un service de tunnel (ngrok, cloudflare tunnel) et définissez VITE_PUBLIC_URL sur l\'URL du tunnel.';
        setStatus('error');
        setErrorMessage(errorMsg);
        return;
      }
      
      const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : '');
      const successLink = `${publicUrl}/payment-processing?orderId=${orderId}&status=success`;
      const failLink = `${publicUrl}/payment-processing?orderId=${orderId}&status=failed`;
      const webhookUrl = `${apiBase || publicUrl}/api/flouci-webhook`;
      
      console.log('Using payment callback URLs:', {
        publicUrl,
        successLink: successLink.substring(0, 60) + '...',
        failLink: failLink.substring(0, 60) + '...',
        isHttps: publicUrl.startsWith('https://')
      });

      // Generate Flouci payment via backend (keeps secret key secure)
      // CRITICAL: Only send orderId - backend will fetch order and calculate amount from DB
      setStatus('redirecting');
      
      // Add timeout to prevent hanging requests (45 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 seconds timeout
      
      let paymentResponse;
      try {
        paymentResponse = await fetch(`${apiBase}/api/flouci-generate-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            orderId: orderId!,
            // Amount removed - backend calculates from DB (prevents frontend manipulation)
            successLink,
            failLink,
            webhookUrl
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error(language === 'en' 
            ? 'Payment request timed out. Please check your internet connection and try again.' 
            : 'La demande de paiement a expiré. Veuillez vérifier votre connexion Internet et réessayer.');
        }
        throw fetchError; // Re-throw other errors
      }

      let paymentData;
      try {
        paymentData = await paymentResponse.json();
      } catch (jsonError) {
        // If response is not JSON, get text response
        const textResponse = await paymentResponse.text();
        console.error('❌ Payment response is not JSON:', textResponse);
        throw new Error(language === 'en' 
          ? `Server error (${paymentResponse.status}): ${paymentResponse.statusText || 'Unknown error'}`
          : `Erreur serveur (${paymentResponse.status}): ${paymentResponse.statusText || 'Erreur inconnue'}`);
      }

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
        let errorMsg = paymentData.error || paymentData.message || paymentData.flouciError?.message || paymentData.details?.message || paymentData.details || `Failed to generate payment (${paymentResponse.status})`;
        
        // Handle specific Flouci errors
        if (paymentResponse.status === 412 || (paymentData.code === 1 && paymentData.flouciError?.error === 'SMT operation failed.')) {
          // SMT operation failed - usually means configuration issue
          errorMsg = language === 'en'
            ? 'Payment configuration error. Please contact support or try again later.'
            : 'Erreur de configuration du paiement. Veuillez contacter le support ou réessayer plus tard.';
        } else if (paymentData.code === 1) {
          // Generic code 1 error
          errorMsg = language === 'en'
            ? 'Payment request validation failed. Please check your payment details and try again.'
            : 'La validation de la demande de paiement a échoué. Veuillez vérifier vos détails de paiement et réessayer.';
        } else if (paymentData.details?.possibleCauses) {
          // Use the detailed error from backend if available
          errorMsg = paymentData.error || errorMsg;
        }
        
        console.error('❌ Payment generation error details:', {
          status: paymentResponse.status,
          statusText: paymentResponse.statusText,
          code: paymentData.code,
          data: paymentData
        });
        throw new Error(errorMsg);
      }

      if (!paymentData.success || !paymentData.link) {
        throw new Error(paymentData.error || 'Failed to generate payment');
      }

      // If this is a duplicate submission, log it but still redirect
      if (paymentData.isDuplicate) {
      }

      // Redirect to Flouci payment page
      window.location.href = paymentData.link;

    } catch (error: any) {
      console.error('Payment initialization error:', error);
      setStatus('error');
      
      // Provide user-friendly error messages
      let errorMsg = error.message || t[language].errorMessage;
      
      // Handle network/fetch errors
      if (error.message?.includes('fetch failed') || error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
        errorMsg = language === 'en' 
          ? 'Unable to connect to the payment server. Please check your internet connection and try again. If the problem persists, contact support.'
          : 'Impossible de se connecter au serveur de paiement. Veuillez vérifier votre connexion Internet et réessayer. Si le problème persiste, contactez le support.';
      } else if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
        errorMsg = language === 'en' 
          ? 'The payment gateway did not respond in time. Please check your internet connection and try again.'
          : 'La passerelle de paiement n\'a pas répondu à temps. Veuillez vérifier votre connexion Internet et réessayer.';
      } else if (error.message?.includes('Payment gateway timeout')) {
        errorMsg = language === 'en' 
          ? 'The payment service is temporarily unavailable. Please try again in a few moments.'
          : 'Le service de paiement est temporairement indisponible. Veuillez réessayer dans quelques instants.';
      } else if (error.message?.includes('Flouci API keys not configured')) {
        errorMsg = language === 'en' 
          ? 'Payment service is not configured. Please contact support.'
          : 'Le service de paiement n\'est pas configuré. Veuillez contacter le support.';
      } else if (error.message?.includes('500') || error.message?.includes('Internal Server Error')) {
        errorMsg = language === 'en' 
          ? 'A server error occurred while processing your payment. Please try again or contact support if the issue persists.'
          : 'Une erreur serveur s\'est produite lors du traitement de votre paiement. Veuillez réessayer ou contacter le support si le problème persiste.';
      }
      
      setErrorMessage(errorMsg);
    }
  };

  useEffect(() => {
    // This useEffect handles verification when returning from Flouci
    if (!orderId) return;
    
    const statusParam = searchParams.get('status');
    const paymentId = searchParams.get('payment_id') || searchParams.get('id');
    
    
    // CRITICAL: Only process if we have a status parameter (returning from Flouci)
    // If no status param, we're NOT returning from Flouci - skip verification
    if (!statusParam) {
      return; // Not returning from Flouci, first useEffect will handle initialization
    }

    // Only verify if we're actually returning from Flouci (have status param)
    // Always verify payment status with Flouci API, regardless of redirect status
    // The redirect status can be unreliable, so we need to check the actual payment status
    if (statusParam === 'success' || statusParam === 'failed') {
      setStatus('verifying');
      
      if (paymentId) {
        verifyPayment(paymentId);
      } else {
        // No payment_id in URL - verify via order's payment_gateway_reference
        verifyPaymentByOrder();
      }
    }
  }, [searchParams, orderId]);

  // Verify payment by order (if payment_id not in URL)
  const verifyPaymentByOrder = async () => {
    try {
      setStatus('verifying');
      const order = await getOrderById(orderId!);
      if (order?.payment_gateway_reference) {
        verifyPayment(order.payment_gateway_reference);
      } else {
        // No payment reference yet, might still be processing
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
      setStatus('verifying');
      
      // Clear retry count on new verification attempt
      if (sessionStorage.getItem(`payment_retry_${orderId}`)) {
        sessionStorage.removeItem(`payment_retry_${orderId}`);
      }

      const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : '');

      // Add timeout to prevent hanging requests (45 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 seconds timeout

      // Verify payment via backend (keeps secret key secure)
      let verifyResponse;
      try {
        verifyResponse = await fetch(`${apiBase}/api/flouci-verify-payment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ paymentId, orderId: orderId! }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error(language === 'en' 
            ? 'Payment verification timed out. Please try again or contact support if the issue persists.' 
            : 'La vérification du paiement a expiré. Veuillez réessayer ou contacter le support si le problème persiste.');
        }
        throw fetchError; // Re-throw other errors
      }


      const verifyData = await verifyResponse.json();

      if (!verifyResponse.ok || !verifyData.success) {
        console.error('❌ Verification failed:', verifyData);
        throw new Error(verifyData.error || 'Payment verification failed');
      }

      const paymentStatus = verifyData.status;

      if (paymentStatus === 'SUCCESS') {
        // SECURITY: Frontend NEVER updates order status
        // Backend webhook/verification endpoint handles all status updates
        // If backend didn't update, that's a server issue that needs fixing

        // CRITICAL: Ticket generation is handled by backend webhook/verification
        // Frontend should NOT trigger ticket generation - backend does it after verification confirms SUCCESS
        // This ensures tickets are only generated once, after authoritative verification

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
      } else if (paymentStatus === 'PENDING') {
        // PENDING - retry with exponential backoff (max 5 retries)
        const retryCount = parseInt(sessionStorage.getItem(`payment_retry_${orderId}`) || '0');
        const MAX_RETRIES = 5;
        
        if (retryCount < MAX_RETRIES) {
          const delay = Math.min(2000 * Math.pow(2, retryCount), 30000); // Exponential backoff, max 30s
          sessionStorage.setItem(`payment_retry_${orderId}`, String(retryCount + 1));
          
          setTimeout(() => {
            verifyPayment(paymentId);
          }, delay);
        } else {
          // Max retries reached - let webhook finalize
          setStatus('verifying');
          setErrorMessage(language === 'en' 
            ? 'Payment is being processed. You will receive a confirmation email once it\'s completed.'
            : 'Le paiement est en cours de traitement. Vous recevrez un email de confirmation une fois terminé.');
          
          // Clear retry count after showing message
          setTimeout(() => {
            sessionStorage.removeItem(`payment_retry_${orderId}`);
          }, 10000);
        }
      } else {
        // Unknown status
        setStatus('error');
        setErrorMessage(language === 'en' 
          ? `Unknown payment status: ${paymentStatus}`
          : `Statut de paiement inconnu: ${paymentStatus}`);
      }
    } catch (error: any) {
      console.error('Payment verification error:', error);
      setStatus('error');
      
      // Provide user-friendly error messages
      let errorMsg = error.message || t[language].errorMessage;
      
      if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
        errorMsg = language === 'en' 
          ? 'Payment verification timed out. The payment may still be processing. Please wait a moment and refresh, or contact support if the issue persists.'
          : 'La vérification du paiement a expiré. Le paiement peut encore être en cours de traitement. Veuillez attendre un moment et actualiser, ou contacter le support si le problème persiste.';
      }
      
      setErrorMessage(errorMsg);
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

