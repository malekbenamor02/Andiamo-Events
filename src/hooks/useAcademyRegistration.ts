import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { ACADEMY_UI, getFormulaPrice } from '@/data/academyContent';
import { requiresAcademyPaymentProof } from '@/lib/academy/academyUtils';
import {
  ACADEMY_PAYMENT_PROOF_MAX_MB,
  isAcademyPaymentProofFile,
  validateAcademyForm,
} from '@/lib/academy/validation';
import { normalizeAcademyPromoCodeInput } from '@/lib/academy/promoCode';
import { API_ROUTES, getApiBaseUrl } from '@/lib/api-routes';
import { useAcademyPublicStatus } from '@/hooks/useAcademyPublicStatus';
import type { AcademyFormulaId, AcademyLanguage, AcademyRegistrationFormData } from '@/types/academy';
import { EMPTY_ACADEMY_FORM } from '@/types/academy';

const HIGHLIGHT_MS = 2000;
const PROMO_VALIDATE_DEBOUNCE_MS = 450;
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

export type AcademyPromoPreview =
  | { status: 'idle' }
  | { status: 'loading' }
  | {
      status: 'valid';
      code: string;
      discountAmountDt: number;
      discountLabel: string;
    }
  | { status: 'invalid'; message: string };

function isLocalhostClient() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.');
}

async function executeRecaptcha(): Promise<string | null> {
  if (isLocalhostClient()) return 'localhost-bypass-token';
  if (!RECAPTCHA_SITE_KEY || !(window as Window & { grecaptcha?: { execute: (k: string, o: { action: string }) => Promise<string> } }).grecaptcha) {
    return null;
  }
  return (window as Window & { grecaptcha: { execute: (k: string, o: { action: string }) => Promise<string> } }).grecaptcha.execute(
    RECAPTCHA_SITE_KEY,
    { action: 'academy_register' }
  );
}

function computeAcademyCardFees(subtotal: number, feeRate: number) {
  const sub = Math.max(0, Number(subtotal) || 0);
  const rate = Math.min(0.5, Math.max(0, Number(feeRate) || 0));
  const feeAmount = Number((sub * rate).toFixed(3));
  return { feeAmount, totalWithFees: sub + feeAmount };
}

export function useAcademyRegistration(
  language: AcademyLanguage,
  selectedFormula: AcademyFormulaId | null
) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { registrationsOpen, soldOut, onlinePaymentFeeRate } = useAcademyPublicStatus(language);
  const mountMs = useRef(Date.now());
  const [formData, setFormData] = useState<AcademyRegistrationFormData>(EMPTY_ACADEMY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof AcademyRegistrationFormData, string>>>({});
  const [highlightFormula, setHighlightFormula] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [promoPreview, setPromoPreview] = useState<AcademyPromoPreview>({ status: 'idle' });

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY || (window as Window & { grecaptcha?: unknown }).grecaptcha) return;
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!selectedFormula) return;
    setFormData((prev) => ({ ...prev, formule: selectedFormula }));
    setHighlightFormula(true);
    const timer = window.setTimeout(() => setHighlightFormula(false), HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [selectedFormula]);

  const baseAmountDt = useMemo(() => {
    if (!formData.formule) return 0;
    return getFormulaPrice(formData.formule);
  }, [formData.formule]);

  const promoDiscountDt =
    promoPreview.status === 'valid' ? promoPreview.discountAmountDt : 0;

  const subtotalAfterPromo = useMemo(() => {
    if (baseAmountDt <= 0) return 0;
    return Math.max(0, baseAmountDt - promoDiscountDt);
  }, [baseAmountDt, promoDiscountDt]);

  const displayTotal = useMemo(() => {
    if (!formData.formule || subtotalAfterPromo <= 0) return 0;
    if (formData.paymentMethod === 'card') {
      return computeAcademyCardFees(subtotalAfterPromo, onlinePaymentFeeRate).totalWithFees;
    }
    return subtotalAfterPromo;
  }, [formData.formule, formData.paymentMethod, subtotalAfterPromo, onlinePaymentFeeRate]);

  const onlineFeeAmount = useMemo(() => {
    if (formData.paymentMethod !== 'card' || subtotalAfterPromo <= 0) return 0;
    return computeAcademyCardFees(subtotalAfterPromo, onlinePaymentFeeRate).feeAmount;
  }, [formData.paymentMethod, subtotalAfterPromo, onlinePaymentFeeRate]);

  useEffect(() => {
    const raw = formData.promoCode.trim();
    if (!raw || !formData.formule) {
      setPromoPreview({ status: 'idle' });
      return;
    }

    const code = normalizeAcademyPromoCodeInput(raw);
    if (!code) {
      setPromoPreview({ status: 'idle' });
      return;
    }

    const controller = new AbortController();
    setPromoPreview({ status: 'loading' });

    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}${API_ROUTES.ACADEMY_VALIDATE_PROMO}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promoCode: code, formule: formData.formule }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (controller.signal.aborted) return;

        if (data.valid) {
          setPromoPreview({
            status: 'valid',
            code: data.code as string,
            discountAmountDt: Number(data.discountAmountDt) || 0,
            discountLabel: String(data.discountLabel || ''),
          });
          return;
        }

        const invalidMsg =
          language === 'en'
            ? 'Invalid or expired promo code'
            : 'Code promo invalide ou expiré';
        setPromoPreview({ status: 'invalid', message: invalidMsg });
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setPromoPreview({
          status: 'invalid',
          message:
            language === 'en'
              ? 'Could not verify promo code'
              : 'Impossible de vérifier le code promo',
        });
      }
    }, PROMO_VALIDATE_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [formData.promoCode, formData.formule, language]);

  const updateField = useCallback(
    <K extends keyof AcademyRegistrationFormData>(field: K, value: AcademyRegistrationFormData[K]) => {
      setFormData((prev) => {
        let nextValue = value;
        if (field === 'promoCode' && typeof value === 'string') {
          nextValue = normalizeAcademyPromoCodeInput(value) as AcademyRegistrationFormData[K];
        }
        const next = { ...prev, [field]: nextValue };
        if (field === 'paymentMethod' && !requiresAcademyPaymentProof(value as AcademyRegistrationFormData['paymentMethod'])) {
          next.paymentProof = null;
        }
        return next;
      });
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    []
  );

  const setPaymentProof = useCallback(
    (file: File | null): boolean => {
      if (!file) {
        updateField('paymentProof', null);
        return true;
      }
      if (!isAcademyPaymentProofFile(file)) {
        setErrors((prev) => ({
          ...prev,
          paymentProof: ACADEMY_UI.validation[language].paymentProofType,
        }));
        return false;
      }
      const maxBytes = ACADEMY_PAYMENT_PROOF_MAX_MB * 1024 * 1024;
      if (file.size > maxBytes) {
        setErrors((prev) => ({
          ...prev,
          paymentProof: ACADEMY_UI.validation[language].paymentProofSize,
        }));
        return false;
      }
      updateField('paymentProof', file);
      return true;
    },
    [language, updateField]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!registrationsOpen) {
        toast({
          variant: 'destructive',
          title:
            soldOut
              ? language === 'en'
                ? 'Academy sold out'
                : 'Academy complet'
              : language === 'en'
                ? 'Registrations closed'
                : 'Inscriptions fermées',
        });
        return;
      }
      const nextErrors = validateAcademyForm(formData, language);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;

      const promo = normalizeAcademyPromoCodeInput(formData.promoCode);
      if (promo && promoPreview.status !== 'valid') {
        toast({
          variant: 'destructive',
          title:
            language === 'en'
              ? 'Enter a valid promo code'
              : 'Saisissez un code promo valide',
          description:
            promoPreview.status === 'loading'
              ? language === 'en'
                ? 'Wait for the code to be verified.'
                : 'Attendez la vérification du code.'
              : promoPreview.status === 'invalid'
                ? promoPreview.message
                : undefined,
        });
        return;
      }

      setIsSubmitting(true);
      try {
        const recaptchaToken = await executeRecaptcha();
        if (!recaptchaToken && !isLocalhostClient()) {
          toast({
            variant: 'destructive',
            title: language === 'en' ? 'Security check failed' : 'Vérification de sécurité échouée',
          });
          setIsSubmitting(false);
          return;
        }

        const fd = new FormData();
        fd.append('fullName', formData.fullName);
        fd.append('email', formData.email);
        fd.append('phone', formData.phone);
        fd.append('formule', formData.formule);
        fd.append('paymentMethod', formData.paymentMethod);
        fd.append('acceptTerms', 'true');
        fd.append('honeypot', honeypot);
        fd.append('client_elapsed_ms', String(Date.now() - mountMs.current));
        fd.append('language', language);
        if (promo) fd.append('promoCode', promo);
        if (recaptchaToken) fd.append('recaptchaToken', recaptchaToken);
        if (formData.paymentProof) fd.append('paymentProof', formData.paymentProof);

        const res = await fetch(`${getApiBaseUrl()}${API_ROUTES.ACADEMY_REGISTER}`, {
          method: 'POST',
          body: fd,
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const msg =
            data.message ||
            data.error ||
            (language === 'en' ? 'Registration failed' : 'Échec de l\'inscription');
          toast({ variant: 'destructive', title: msg, description: data.details?.join?.(' ') });
          setIsSubmitting(false);
          return;
        }

        const registrationId = data.registrationId as string;
        if (data.redirectToPayment && registrationId) {
          navigate(`/academy/payment-processing?registrationId=${registrationId}&init=1`);
        } else if (registrationId) {
          navigate(`/academy/register/confirmation?registrationId=${registrationId}`);
        }
      } catch (err: unknown) {
        toast({
          variant: 'destructive',
          title: language === 'en' ? 'Network error' : 'Erreur réseau',
          description: err instanceof Error ? err.message : undefined,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, language, honeypot, navigate, toast, promoPreview, registrationsOpen, soldOut]
  );

  return {
    formData,
    errors,
    highlightFormula,
    isSubmitting,
    baseAmountDt,
    promoDiscountDt,
    subtotalAfterPromo,
    displayTotal,
    onlineFeeAmount,
    promoPreview,
    honeypot,
    setHoneypot,
    updateField,
    setPaymentProof,
    handleSubmit,
  };
}
