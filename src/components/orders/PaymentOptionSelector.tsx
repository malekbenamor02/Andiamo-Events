/**
 * PaymentOptionSelector Component
 * Displays available payment options for selection
 */

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { PaymentOption } from '@/types/orders';
import { CreditCard, ExternalLink, Wallet } from 'lucide-react';
import { PaymentMethod } from '@/lib/constants/orderStatuses';
import { CustomerInfo } from '@/types/orders';
import { cn } from '@/lib/utils';
import {
  selectableOptionCardClass,
  selectableOptionRowClass,
} from '@/components/orders/selectableOptionStyles';

interface EventPass {
  id: string;
  name: string;
  allowed_payment_methods?: string[] | null;
}

interface PaymentOptionSelectorProps {
  options: PaymentOption[];
  selectedMethod: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
  customerInfo?: CustomerInfo;
  onExternalAppClick?: () => void;
  language?: 'en' | 'fr';
  selectedPasses?: Record<string, number>;
  eventPasses?: EventPass[];
}

export function PaymentOptionSelector({
  options,
  selectedMethod,
  onSelect,
  customerInfo,
  onExternalAppClick,
  language = 'en',
  selectedPasses = {},
  eventPasses = [],
}: PaymentOptionSelectorProps) {
  const isCustomerInfoComplete = (): boolean => {
    if (!customerInfo) return false;

    const hasName = customerInfo.full_name.trim().length >= 2;
    const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email.trim());
    const hasPhone = /^[2594][0-9]{7}$/.test(customerInfo.phone.trim());
    const hasCity = !!customerInfo.city.trim();

    let hasVille = true;
    if (customerInfo.city === 'Sousse' || customerInfo.city === 'Tunis') {
      hasVille = !!customerInfo.ville;
    }

    return hasName && hasEmail && hasPhone && hasCity && hasVille;
  };

  const customerInfoComplete = isCustomerInfoComplete();

  const isPaymentMethodCompatible = (method: PaymentMethod): { compatible: boolean; incompatiblePasses: string[] } => {
    const selectedPassIds = Object.keys(selectedPasses).filter((id) => selectedPasses[id] > 0);

    if (selectedPassIds.length === 0) {
      return { compatible: true, incompatiblePasses: [] };
    }

    const incompatiblePasses: string[] = [];

    for (const passId of selectedPassIds) {
      const pass = eventPasses.find((p) => p.id === passId);
      if (!pass) continue;

      if (!pass.allowed_payment_methods || pass.allowed_payment_methods.length === 0) {
        continue;
      }

      if (!pass.allowed_payment_methods.includes(method)) {
        incompatiblePasses.push(pass.name);
      }
    }

    return {
      compatible: incompatiblePasses.length === 0,
      incompatiblePasses,
    };
  };

  const t =
    language === 'en'
      ? {
          selectPayment: 'Select payment method',
          online: 'Online payment',
          externalApp: 'External app payment',
          ambassadorCash: 'Cash payment (ambassador)',
          payOnline: 'Pay securely with credit or debit card',
          payExternal: 'Pay through an external payment app',
          payAmbassador: 'An ambassador will contact you to collect payment',
        }
      : {
          selectPayment: 'Mode de paiement',
          online: 'Paiement en ligne',
          externalApp: 'Application externe',
          ambassadorCash: 'Paiement en espèces (ambassadeur)',
          payOnline: 'Payer en toute sécurité par carte',
          payExternal: 'Payer via une application externe',
          payAmbassador: 'Un ambassadeur vous contactera pour le paiement',
        };

  const getOptionIcon = (type: PaymentOption['option_type']) => {
    switch (type) {
      case 'online':
        return <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />;
      case 'external_app':
        return <ExternalLink className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />;
      case 'ambassador_cash':
        return <Wallet className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />;
      default:
        return null;
    }
  };

  const getOptionLabel = (option: PaymentOption) => {
    switch (option.option_type) {
      case 'online':
        return t.online;
      case 'external_app':
        return option.app_name || t.externalApp;
      case 'ambassador_cash':
        return t.ambassadorCash;
      default:
        return option.option_type;
    }
  };

  const getOptionDescription = (option: PaymentOption) => {
    switch (option.option_type) {
      case 'online':
        return t.payOnline;
      case 'external_app':
        return t.payExternal;
      case 'ambassador_cash':
        return t.payAmbassador;
      default:
        return '';
    }
  };

  if (options.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        {language === 'en' ? 'No payment options available' : 'Aucune option de paiement disponible'}
      </div>
    );
  }

  const externalAppOption = options.find((o) => o.option_type === 'external_app');
  const radioOptions = options.filter((o) => o.option_type !== 'external_app');

  const sortedOptions = [...radioOptions].sort((a, b) => {
    const order: Record<string, number> = {
      online: 1,
      ambassador_cash: 2,
    };
    return (order[a.option_type] || 999) - (order[b.option_type] || 999);
  });

  const handleOptionSelect = (optionType: PaymentMethod) => {
    const compatibility = isPaymentMethodCompatible(optionType);
    if (!compatibility.compatible) return;
    onSelect(optionType);
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold text-foreground">{t.selectPayment}</Label>

      {externalAppOption &&
        (() => {
          const compatibility = isPaymentMethodCompatible('external_app');
          const isDisabled = !customerInfoComplete || !compatibility.compatible;

          return (
            <div
              role="button"
              tabIndex={isDisabled ? -1 : 0}
              className={selectableOptionCardClass(false, isDisabled)}
              onClick={() => {
                if (!isDisabled && onExternalAppClick) onExternalAppClick();
              }}
              onKeyDown={(e) => {
                if (!isDisabled && onExternalAppClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onExternalAppClick();
                }
              }}
            >
              <div className={selectableOptionRowClass()}>
                <ExternalLink
                  className={cn(
                    'mt-0.5 h-5 w-5 shrink-0',
                    isDisabled ? 'text-muted-foreground/60' : 'text-muted-foreground'
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className={cn('font-medium', isDisabled && 'text-muted-foreground')}>
                    {getOptionLabel(externalAppOption)}
                  </p>
                  {!customerInfoComplete ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {language === 'en'
                        ? 'Complete your contact details first'
                        : 'Complétez vos coordonnées d’abord'}
                    </p>
                  ) : !compatibility.compatible ? (
                    <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                      {language === 'en'
                        ? `Not available for: ${compatibility.incompatiblePasses.join(', ')}`
                        : `Indisponible pour : ${compatibility.incompatiblePasses.join(', ')}`}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {getOptionDescription(externalAppOption)}
                    </p>
                  )}
                  {externalAppOption.app_image && (
                    <img
                      src={externalAppOption.app_image}
                      alt={externalAppOption.app_name || 'App'}
                      className={cn('mt-2 h-8', isDisabled && 'opacity-50')}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })()}

      <RadioGroup
        value={selectedMethod || undefined}
        onValueChange={(value) => {
          if (customerInfoComplete) {
            handleOptionSelect(value as PaymentMethod);
          }
        }}
        className="gap-3"
      >
        {sortedOptions.map((option) => {
          const compatibility = isPaymentMethodCompatible(option.option_type);
          const isDisabled = !customerInfoComplete || !compatibility.compatible;
          const isSelected = selectedMethod === option.option_type;

          return (
            <label
              key={option.id}
              htmlFor={option.id}
              className={selectableOptionCardClass(isSelected, isDisabled)}
            >
              <div className={selectableOptionRowClass()}>
                <RadioGroupItem
                  value={option.option_type}
                  id={option.id}
                  className="mt-0.5"
                  disabled={isDisabled}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {getOptionIcon(option.option_type)}
                    <span
                      className={cn(
                        'font-medium',
                        isDisabled ? 'text-muted-foreground' : 'text-foreground'
                      )}
                    >
                      {getOptionLabel(option)}
                    </span>
                  </div>
                  {!customerInfoComplete ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {language === 'en'
                        ? 'Complete your contact details first'
                        : 'Complétez vos coordonnées d’abord'}
                    </p>
                  ) : !compatibility.compatible ? (
                    <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                      {language === 'en'
                        ? `Not available for: ${compatibility.incompatiblePasses.join(', ')}`
                        : `Indisponible pour : ${compatibility.incompatiblePasses.join(', ')}`}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {getOptionDescription(option)}
                    </p>
                  )}
                </div>
              </div>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
