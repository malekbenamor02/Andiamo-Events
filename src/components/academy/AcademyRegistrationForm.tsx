import type { ReactNode } from 'react';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Check, Loader2, Tag, Upload, X } from 'lucide-react';
import AcademyPaymentMethodIcon from '@/components/academy/AcademyPaymentMethodIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import AcademySection from '@/components/academy/AcademySection';
import { ACADEMY_FORMULAS, ACADEMY_UI } from '@/data/academyContent';
import { useAcademyRegistration } from '@/hooks/useAcademyRegistration';
import {
  ACADEMY_INSCRIPTION_ID,
  ACADEMY_TERMS_PATH,
  formatPriceDt,
  pickLocalized,
  requiresAcademyPaymentProof,
} from '@/lib/academy/academyUtils';
import { ACADEMY_PAYMENT_PROOF_ACCEPT } from '@/lib/academy/validation';
import { cn } from '@/lib/utils';
import type { AcademyFormulaId, AcademyLanguage, AcademyPaymentMethod } from '@/types/academy';

interface AcademyRegistrationFormProps {
  language: AcademyLanguage;
  selectedFormula: AcademyFormulaId | null;
}

const PAYMENT_OPTIONS: AcademyPaymentMethod[] = ['card', 'rib', 'd17'];

function paymentLabel(
  id: AcademyPaymentMethod,
  form: (typeof ACADEMY_UI)['form'],
  language: AcademyLanguage
) {
  if (id === 'card') return pickLocalized(form.paymentCard, language);
  if (id === 'rib') return pickLocalized(form.paymentRib, language);
  return pickLocalized(form.paymentD17, language);
}

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
  hint?: string;
}

function FormField({ id, label, error, children, hint }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground/90">
        {label}
      </Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

const AcademyRegistrationForm = ({ language, selectedFormula }: AcademyRegistrationFormProps) => {
  const { form } = ACADEMY_UI;
  const paymentProofInputRef = useRef<HTMLInputElement>(null);
  const {
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
  } = useAcademyRegistration(language, selectedFormula);

  const showPaymentProof = requiresAcademyPaymentProof(formData.paymentMethod);
  const showManualPaymentCallout =
    formData.paymentMethod === 'rib' || formData.paymentMethod === 'd17';
  const selectedFormulaData = ACADEMY_FORMULAS.find((f) => f.id === formData.formule);

  const inputClass = (hasError: boolean) =>
    cn(
      'h-12 rounded-xl border-border/60 bg-background/80 backdrop-blur-sm',
      'focus-visible:ring-primary/40',
      hasError && 'border-destructive focus-visible:ring-destructive/40'
    );

  return (
    <AcademySection
      id={ACADEMY_INSCRIPTION_ID}
      title={form.title}
      subtitle={form.subtitle}
      language={language}
      dark
      staticChildren
    >
      <form
        onSubmit={handleSubmit}
        className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_min(22rem,100%)] gap-8 lg:gap-10 items-start relative"
      >
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="absolute -left-[9999px] w-px h-px opacity-0"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
        />
        <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-md p-6 sm:p-8 shadow-[0_8px_40px_hsl(var(--primary)/0.06)] space-y-6">
          <FormField
            id="academy-fullName"
            label={pickLocalized(form.fullName, language)}
            error={errors.fullName}
          >
            <Input
              id="academy-fullName"
              autoComplete="name"
              placeholder={pickLocalized(form.fullNamePlaceholder, language)}
              value={formData.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              aria-invalid={Boolean(errors.fullName)}
              className={inputClass(Boolean(errors.fullName))}
            />
          </FormField>

          <FormField id="academy-email" label={pickLocalized(form.email, language)} error={errors.email}>
            <Input
              id="academy-email"
              type="email"
              autoComplete="email"
              placeholder={pickLocalized(form.emailPlaceholder, language)}
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              aria-invalid={Boolean(errors.email)}
              className={inputClass(Boolean(errors.email))}
            />
          </FormField>

          <FormField
            id="academy-phone"
            label={pickLocalized(form.phone, language)}
            error={errors.phone}
          >
            <div
              className={cn(
                'flex h-12 overflow-hidden rounded-xl border border-border/60 bg-background/80 backdrop-blur-sm',
                'focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-2 focus-within:ring-offset-background',
                errors.phone && 'border-destructive focus-within:ring-destructive/40'
              )}
            >
              <span className="inline-flex items-center px-4 text-sm font-medium text-muted-foreground border-r border-border/60 bg-muted/30 select-none shrink-0">
                +216
              </span>
              <Input
                id="academy-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="28070128"
                value={formData.phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
                  updateField('phone', digits);
                }}
                aria-invalid={Boolean(errors.phone)}
                className="h-full border-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </FormField>

          <FormField label={pickLocalized(form.formule, language)} id="academy-formule" error={errors.formule}>
            <Select
              value={formData.formule || undefined}
              onValueChange={(v) => updateField('formule', v as AcademyFormulaId)}
            >
              <SelectTrigger
                id="academy-formule"
                className={cn(
                  'h-12 rounded-xl border-border/60 bg-background/80',
                  highlightFormula && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                  errors.formule && 'border-destructive'
                )}
                aria-invalid={Boolean(errors.formule)}
              >
                <SelectValue placeholder={pickLocalized(form.formulePlaceholder, language)} />
              </SelectTrigger>
              <SelectContent>
                {ACADEMY_FORMULAS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {pickLocalized(f.name, language)} — {formatPriceDt(f.priceDt)} DT
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="space-y-3 pt-1">
            <Label className="text-sm font-medium text-foreground/90">
              {pickLocalized(form.paymentMethod, language)}
            </Label>
            <div className="grid gap-3 sm:grid-cols-1">
              {PAYMENT_OPTIONS.map((id) => {
                const selected = formData.paymentMethod === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => updateField('paymentMethod', id)}
                    className={cn(
                      'relative flex items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200',
                      'hover:border-primary/40 hover:bg-primary/5',
                      selected
                        ? 'border-primary bg-primary/10 shadow-[0_0_24px_hsl(var(--primary)/0.12)]'
                        : 'border-border/60 bg-background/50'
                    )}
                    aria-pressed={selected}
                  >
                    <AcademyPaymentMethodIcon method={id} selected={selected} />
                    <span className="flex-1 min-w-0 pt-0.5">
                      <span className="block text-sm font-medium text-foreground leading-snug">
                        {paymentLabel(id, form, language)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/80 bg-transparent'
                      )}
                      aria-hidden
                    >
                      {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
            {showManualPaymentCallout && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground/90 leading-relaxed">
                {pickLocalized(form.paymentManualContactCallout, language)}
              </div>
            )}
            {errors.paymentMethod && (
              <p className="text-sm text-destructive">{errors.paymentMethod}</p>
            )}
          </div>

          {showPaymentProof && (
            <FormField
              id="academy-payment-proof"
              label={pickLocalized(form.paymentProof, language)}
              error={errors.paymentProof}
              hint={pickLocalized(form.paymentProofHint, language)}
            >
              <input
                ref={paymentProofInputRef}
                id="academy-payment-proof"
                type="file"
                accept={ACADEMY_PAYMENT_PROOF_ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  const accepted = setPaymentProof(file);
                  if (!accepted && paymentProofInputRef.current) {
                    paymentProofInputRef.current.value = '';
                  }
                }}
              />
              {!formData.paymentProof ? (
                <button
                  type="button"
                  onClick={() => paymentProofInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file && !setPaymentProof(file) && paymentProofInputRef.current) {
                      paymentProofInputRef.current.value = '';
                    }
                  }}
                  className={cn(
                    'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 transition-colors',
                    'border-border/60 bg-background/50 hover:border-primary/40 hover:bg-primary/5',
                    errors.paymentProof && 'border-destructive/60 bg-destructive/5'
                  )}
                >
                  <Upload className="h-8 w-8 text-primary/70" aria-hidden />
                  <span className="text-sm text-muted-foreground text-center">
                    {pickLocalized(form.paymentProofDrop, language)}
                  </span>
                </button>
              ) : (
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 p-4',
                    errors.paymentProof && 'border-destructive/60'
                  )}
                >
                  <span className="flex-1 min-w-0 text-sm truncate text-foreground">
                    {formData.paymentProof.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    aria-label={pickLocalized(form.paymentProofRemove, language)}
                    onClick={() => {
                      setPaymentProof(null);
                      if (paymentProofInputRef.current) paymentProofInputRef.current.value = '';
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </FormField>
          )}

          <FormField
            id="academy-promo"
            label={pickLocalized(form.promoCode, language)}
          >
            <div className="relative">
              <Tag
                className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                aria-hidden
              />
              <Input
                id="academy-promo"
                value={formData.promoCode}
                onChange={(e) => updateField('promoCode', e.target.value)}
                className={cn(inputClass(false), 'pl-10 uppercase font-mono tracking-wider')}
                autoComplete="off"
                spellCheck={false}
                aria-describedby={
                  promoPreview.status !== 'idle' ? 'academy-promo-feedback' : undefined
                }
              />
            </div>
            {promoPreview.status === 'loading' && (
              <p id="academy-promo-feedback" className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {language === 'en' ? 'Checking code…' : 'Vérification du code…'}
              </p>
            )}
            {promoPreview.status === 'valid' && (
              <p
                id="academy-promo-feedback"
                className="text-xs text-green-600 dark:text-green-400 font-medium"
              >
                {language === 'en'
                  ? `Discount applied: −${formatPriceDt(promoPreview.discountAmountDt)} DT (${promoPreview.discountLabel})`
                  : `Remise appliquée : −${formatPriceDt(promoPreview.discountAmountDt)} DT (${promoPreview.discountLabel})`}
              </p>
            )}
            {promoPreview.status === 'invalid' && (
              <p id="academy-promo-feedback" className="text-xs text-destructive">
                {promoPreview.message}
              </p>
            )}
          </FormField>

          <div
            className={cn(
              'rounded-xl border p-4 transition-colors',
              errors.acceptTerms
                ? 'border-destructive/60 bg-destructive/5'
                : 'border-border/50 bg-muted/20'
            )}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                id="academy-terms"
                checked={formData.acceptTerms}
                onCheckedChange={(checked) => updateField('acceptTerms', checked === true)}
                aria-invalid={Boolean(errors.acceptTerms)}
                className="mt-0.5 shrink-0"
              />
              <p className="text-sm leading-relaxed text-foreground/90 min-w-0">
                <label htmlFor="academy-terms" className="cursor-pointer">
                  {language === 'en' ? 'I accept the ' : "J'accepte le "}
                </label>
                <Link
                  to={ACADEMY_TERMS_PATH}
                  className="text-primary hover:underline underline-offset-2 font-medium inline py-1 -my-1 relative z-10 touch-manipulation"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {language === 'en'
                    ? 'training terms and conditions'
                    : 'règlement de la formation'}
                </Link>
              </p>
            </div>
            {errors.acceptTerms && (
              <p className="text-sm text-destructive mt-2 pl-7">{errors.acceptTerms}</p>
            )}
          </div>

          <Button
            type="submit"
            className="btn-gradient w-full h-12 text-base rounded-xl"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {pickLocalized(form.submit, language)}
          </Button>
        </div>

        <aside className="lg:sticky lg:top-24">
          <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-card/80 to-primary/5 backdrop-blur-md p-6 sm:p-8 shadow-[0_12px_48px_hsl(var(--primary)/0.1)]">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">
              {pickLocalized(form.summaryTitle, language)}
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <p className="text-sm text-muted-foreground">{pickLocalized(form.formule, language)}</p>
                <p className="text-xl font-heading font-bold text-foreground mt-1">
                  {selectedFormulaData
                    ? pickLocalized(selectedFormulaData.name, language)
                    : pickLocalized(form.noFormula, language)}
                </p>
              </div>

              {formData.paymentMethod && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    {pickLocalized(form.paymentMethod, language)}
                  </p>
                  <p className="text-base font-medium text-foreground mt-1">
                    {paymentLabel(formData.paymentMethod, form, language)}
                  </p>
                </div>
              )}

              {promoDiscountDt > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    {language === 'en' ? 'Promo discount' : 'Remise promo'}
                  </p>
                  <p className="text-base font-medium text-green-600 dark:text-green-400 mt-1">
                    −{formatPriceDt(promoDiscountDt)} DT
                  </p>
                </div>
              )}

              {baseAmountDt > 0 && promoDiscountDt > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    {language === 'en' ? 'Subtotal after discount' : 'Sous-total après remise'}
                  </p>
                  <p className="text-base font-medium text-foreground mt-1">
                    {formatPriceDt(subtotalAfterPromo)} DT
                  </p>
                </div>
              )}

              {formData.paymentMethod === 'card' && onlineFeeAmount > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    {language === 'en' ? 'Online processing fee' : 'Frais de paiement en ligne'}
                  </p>
                  <p className="text-base text-foreground mt-1">+{formatPriceDt(onlineFeeAmount)} DT</p>
                </div>
              )}
              <div className="pt-5 border-t border-border/50">
                <p className="text-sm text-muted-foreground">
                  {pickLocalized(form.amountLabel, language)}
                </p>
                <p className="text-4xl sm:text-5xl font-bold tabular-nums text-primary mt-2 tracking-tight">
                  {displayTotal > 0 ? `${formatPriceDt(displayTotal)} DT` : '—'}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </form>
    </AcademySection>
  );
};

export default AcademyRegistrationForm;
