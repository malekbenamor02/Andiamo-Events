/**
 * CustomerInfoForm Component
 * Collects customer information before payment selection
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomerInfo } from '@/types/orders';
import { CITIES, SOUSSE_VILLES, TUNIS_VILLES } from '@/lib/constants';
import { cn, normalizeCommonEmailTypos, sanitizePhoneInput } from '@/lib/utils';

export type CustomerInfoFormSections = 'all' | 'identity' | 'email' | 'location';

interface CustomerInfoFormProps {
  customerInfo: CustomerInfo;
  onChange: (info: CustomerInfo) => void;
  errors?: Record<string, string>;
  language?: 'en' | 'fr';
  /** Which fields to show (default: all). */
  sections?: CustomerInfoFormSections;
  /** Shown when sections is `email` and handler is provided. */
  emailConfirm?: string;
  onEmailConfirmChange?: (value: string) => void;
  confirmEmailLabel?: string;
}

function FieldError({ message }: { message: string }) {
  return <p className="mt-1 text-sm text-destructive">{message}</p>;
}

function fieldInputClass(hasError?: boolean) {
  return cn(
    hasError &&
      "border-destructive/50 focus-visible:border-destructive focus-visible:ring-0"
  );
}

export function CustomerInfoForm({
  customerInfo,
  onChange,
  errors = {},
  language = 'en',
  sections = 'all',
  emailConfirm = '',
  onEmailConfirmChange,
  confirmEmailLabel,
}: CustomerInfoFormProps) {
  const t =
    language === 'en'
      ? {
          fullName: 'Full Name',
          phone: 'Phone Number',
          email: 'Email',
          confirmEmail: 'Confirm email',
          city: 'City',
          ville: 'Ville (Neighborhood)',
          required: 'This field is required',
          invalidPhone: 'Invalid phone number format',
          invalidEmail: 'Invalid email format',
          villeRequired: 'Ville is required when city is Sousse',
          selectCity: 'Select City',
          selectVille: 'Select Ville',
        }
      : {
          fullName: 'Nom Complet',
          phone: 'Numéro de Téléphone',
          email: 'Email',
          confirmEmail: "Confirmer l'email",
          city: 'Ville',
          ville: 'Ville (Quartier)',
          required: 'Ce champ est requis',
          invalidPhone: 'Format de numéro de téléphone invalide',
          invalidEmail: "Format d'email invalide",
          villeRequired: 'La ville est requise lorsque la ville est Sousse',
          selectCity: 'Sélectionner la Ville',
          selectVille: 'Sélectionner le Quartier',
        };

  const handleChange = (field: keyof CustomerInfo, value: string) => {
    const next = field === 'phone' ? sanitizePhoneInput(value) : value;
    onChange({
      ...customerInfo,
      [field]: next,
      ...(field === 'city' ? { ville: undefined } : {}),
    } as CustomerInfo);
  };

  /** Gmail/iCloud typo fix on blur only — running on every keystroke blocks deleting characters in the domain. */
  const commitEmailTypoFix = () => {
    const fixed = normalizeCommonEmailTypos(customerInfo.email);
    if (fixed !== customerInfo.email) {
      onChange({ ...customerInfo, email: fixed } as CustomerInfo);
    }
  };

  const commitConfirmEmailTypoFix = () => {
    if (!onEmailConfirmChange) return;
    const fixed = normalizeCommonEmailTypos(emailConfirm);
    if (fixed !== emailConfirm) onEmailConfirmChange(fixed);
  };

  const getVillesForCity = (city: string) => {
    if (city === 'Sousse') return SOUSSE_VILLES;
    if (city === 'Tunis') return TUNIS_VILLES;
    return [];
  };

  const villes = customerInfo.city ? getVillesForCity(customerInfo.city) : [];

  const showIdentity = sections === 'all' || sections === 'identity';
  const showEmail = sections === 'all' || sections === 'email';
  const showLocation = sections === 'all' || sections === 'location';
  const showConfirmEmail = showEmail && typeof onEmailConfirmChange === 'function';

  return (
    <div className="space-y-4">
      {showIdentity && (
        <>
          <div>
            <Label htmlFor="full_name">
              {t.fullName} *
            </Label>
            <Input
              id="full_name"
              value={customerInfo.full_name}
              onChange={(e) => handleChange('full_name', e.target.value)}
              className={fieldInputClass(!!(errors.full_name || errors.fullName))}
            />
            {(errors.full_name || errors.fullName) && (
              <FieldError message={errors.full_name || errors.fullName || ''} />
            )}
          </div>

          <div>
            <Label htmlFor="phone">
              {t.phone} *
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none pointer-events-none">
                +216
              </span>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                value={customerInfo.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className={cn('pl-14', fieldInputClass(!!errors.phone))}
              />
            </div>
            {errors.phone && <FieldError message={errors.phone} />}
          </div>
        </>
      )}

      {showEmail && (
        <>
          <div>
            <Label htmlFor="email">
              {t.email} *
            </Label>
            <Input
              id="email"
              type="email"
              value={customerInfo.email}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={commitEmailTypoFix}
              className={fieldInputClass(!!errors.email)}
            />
            {errors.email && <FieldError message={errors.email} />}
          </div>

          {showConfirmEmail && (
            <div>
              <Label htmlFor="email_confirm">
                {confirmEmailLabel ?? t.confirmEmail} *
              </Label>
              <Input
                id="email_confirm"
                type="email"
                autoComplete="off"
                value={emailConfirm}
                onChange={(e) => onEmailConfirmChange(e.target.value)}
                onBlur={commitConfirmEmailTypoFix}
                className={fieldInputClass(!!errors.email_confirm)}
              />
              {errors.email_confirm && (
                <FieldError message={errors.email_confirm} />
              )}
            </div>
          )}
        </>
      )}

      {showLocation && (
        <>
          <div>
            <Label htmlFor="city">
              {t.city} *
            </Label>
            <Select value={customerInfo.city} onValueChange={(value) => handleChange('city', value)}>
              <SelectTrigger className={fieldInputClass(!!errors.city)}>
                <SelectValue placeholder={t.selectCity} />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.city && <FieldError message={errors.city} />}
          </div>

          {villes.length > 0 && (
            <div>
              <Label htmlFor="ville">
                {t.ville} *
              </Label>
              <Select value={customerInfo.ville || ''} onValueChange={(value) => handleChange('ville', value)}>
                <SelectTrigger className={fieldInputClass(!!errors.ville)}>
                  <SelectValue placeholder={t.selectVille} />
                </SelectTrigger>
                <SelectContent>
                  {villes.map((ville) => (
                    <SelectItem key={ville} value={ville}>
                      {ville}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.ville && <FieldError message={errors.ville} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
