/**
 * Checkout promo code input — display-only validation via server preview.
 */
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Tag } from 'lucide-react';
import { normalizeEventPromoCodeInput } from '@/lib/eventPromo/promoCode';
import type { EventPromoPreview } from '@/hooks/useEventPromoCheckout';

interface PromoCodeFieldProps {
  language?: 'en' | 'fr';
  value: string;
  onChange: (value: string) => void;
  preview: EventPromoPreview;
  disabled?: boolean;
}

export function PromoCodeField({
  language = 'en',
  value,
  onChange,
  preview,
  disabled,
}: PromoCodeFieldProps) {
  const t =
    language === 'en'
      ? {
          label: 'Promo code',
          placeholder: 'Enter code',
          checking: 'Checking…',
          valid: 'Discount applied',
          invalid: "This promo code isn't valid for your order",
        }
      : {
          label: 'Code promo',
          placeholder: 'Entrez le code',
          checking: 'Vérification…',
          valid: 'Remise appliquée',
          invalid: "Ce code promo n'est pas valide pour votre commande",
        };

  return (
    <div className="space-y-2 rounded-lg border border-border/50 bg-muted/10 p-4">
      <Label htmlFor="checkout-promo-code" className="flex items-center gap-2 text-sm font-medium">
        <Tag className="h-4 w-4 text-primary" />
        {t.label}
      </Label>
      <Input
        id="checkout-promo-code"
        className="uppercase font-mono tracking-wider"
        placeholder={t.placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(normalizeEventPromoCodeInput(e.target.value))}
        autoComplete="off"
        spellCheck={false}
      />
      {preview.status === 'loading' && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t.checking}
        </p>
      )}
      {preview.status === 'valid' && (
        <p className="text-sm text-green-600 dark:text-green-400">
          {t.valid}
          {preview.discountLabel ? ` — ${preview.discountLabel}` : ''}
          {preview.discountAmount > 0 ? ` (−${preview.discountAmount.toFixed(2)} TND)` : ''}
        </p>
      )}
      {preview.status === 'invalid' && (
        <p className="text-sm text-destructive">{t.invalid}</p>
      )}
    </div>
  );
}
