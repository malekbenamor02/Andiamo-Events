/**
 * PaymentOptionSelector Component
 * Displays available payment options for selection
 */

import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { PaymentOption } from '@/types/orders';
import { CreditCard, ExternalLink, Wallet } from 'lucide-react';
import { PaymentMethod } from '@/lib/constants/orderStatuses';
import { CustomerInfo } from '@/types/orders';
import { SOUSSE_VILLES, TUNIS_VILLES } from '@/lib/constants';

interface PaymentOptionSelectorProps {
  options: PaymentOption[];
  selectedMethod: PaymentMethod | null;
  onSelect: (method: PaymentMethod) => void;
  customerInfo?: CustomerInfo;
  onExternalAppClick?: () => void;
  language?: 'en' | 'fr';
}

export function PaymentOptionSelector({
  options,
  selectedMethod,
  onSelect,
  customerInfo,
  onExternalAppClick,
  language = 'en'
}: PaymentOptionSelectorProps) {
  // Check if all customer information is complete
  const isCustomerInfoComplete = (): boolean => {
    if (!customerInfo) return false;
    
    const hasName = customerInfo.full_name.trim().length >= 2;
    const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email.trim());
    const hasPhone = /^[2594][0-9]{7}$/.test(customerInfo.phone.trim());
    const hasCity = !!customerInfo.city.trim();
    
    // Check ville requirement for Sousse and Tunis
    let hasVille = true;
    if (customerInfo.city === 'Sousse' || customerInfo.city === 'Tunis') {
      hasVille = !!customerInfo.ville;
    }
    
    return hasName && hasEmail && hasPhone && hasCity && hasVille;
  };

  const customerInfoComplete = isCustomerInfoComplete();
  const t = language === 'en' ? {
    selectPayment: 'Select Payment Method',
    online: 'Online Payment',
    externalApp: 'External App Payment',
    ambassadorCash: 'Cash Payment (Ambassador)',
    payOnline: 'Pay securely online with credit/debit card',
    payExternal: 'Pay through external payment app',
    payCash: 'Choose an ambassador and pay cash to receive your order'
  } : {
    selectPayment: 'Sélectionner le Mode de Paiement',
    online: 'Paiement en Ligne',
    externalApp: 'Paiement via Application Externe',
    ambassadorCash: 'Paiement Espèces (Ambassadeur)',
    payOnline: 'Payer en ligne en toute sécurité avec carte de crédit/débit',
    payExternal: 'Payer via une application de paiement externe',
    payCash: 'Choisissez un ambassadeur et payez en espèces pour recevoir votre commande'
  };

  const getOptionIcon = (type: PaymentOption['option_type']) => {
    switch (type) {
      case 'online':
        return <CreditCard className="w-5 h-5" />;
      case 'external_app':
        return <ExternalLink className="w-5 h-5 text-primary" />;
      case 'ambassador_cash':
        return <Wallet className="w-5 h-5" />;
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
        return t.payCash;
      default:
        return '';
    }
  };

  if (options.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        {language === 'en' 
          ? 'No payment options available' 
          : 'Aucune option de paiement disponible'}
      </div>
    );
  }

  // Separate external_app from other options
  const externalAppOption = options.find(o => o.option_type === 'external_app');
  const radioOptions = options.filter(o => o.option_type !== 'external_app');

  // Sort radio options: online → ambassador
  const sortedOptions = [...radioOptions].sort((a, b) => {
    const order: Record<string, number> = {
      'online': 1,
      'ambassador_cash': 2
    };
    return (order[a.option_type] || 999) - (order[b.option_type] || 999);
  });

  const handleOptionSelect = (optionType: PaymentMethod) => {
    onSelect(optionType);
  };

  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold">{t.selectPayment}</Label>
      <RadioGroup
        value={selectedMethod || undefined}
        onValueChange={(value) => {
          if (customerInfoComplete) {
            handleOptionSelect(value as PaymentMethod);
          }
        }}
      >
        {sortedOptions.map((option) => (
          <Card
            key={option.id}
            className={`transition-all ${
              customerInfoComplete
                ? `cursor-pointer ${
                    selectedMethod === option.option_type
                      ? 'ring-2 ring-primary'
                      : 'hover:bg-accent'
                  }`
                : 'opacity-50 cursor-not-allowed bg-muted/30'
            }`}
            onClick={() => {
              if (customerInfoComplete) {
                handleOptionSelect(option.option_type);
              }
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <RadioGroupItem
                  value={option.option_type}
                  id={option.id}
                  className="mt-1"
                  disabled={!customerInfoComplete}
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    {getOptionIcon(option.option_type)}
                    <Label
                      htmlFor={option.id}
                      className={`font-semibold ${
                        customerInfoComplete ? 'cursor-pointer' : 'text-muted-foreground cursor-not-allowed'
                      }`}
                    >
                      {getOptionLabel(option)}
                    </Label>
                  </div>
                  <p className={`text-sm mt-1 ${
                    customerInfoComplete ? 'text-muted-foreground' : 'text-muted-foreground/70'
                  }`}>
                    {customerInfoComplete 
                      ? getOptionDescription(option)
                      : (language === 'en' 
                          ? 'Please enter your information above to select this payment method'
                          : 'Veuillez entrer vos informations ci-dessus pour sélectionner ce mode de paiement')
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </RadioGroup>

      {/* External App Payment - Card without radio button */}
      {externalAppOption && (
        <Card
          className={`transition-all ${
            customerInfoComplete
              ? 'cursor-pointer hover:bg-accent'
              : 'opacity-50 cursor-not-allowed bg-muted/30'
          }`}
          onClick={() => {
            if (customerInfoComplete && onExternalAppClick) {
              onExternalAppClick();
            }
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <div className="mt-1">
                <ExternalLink className={`w-5 h-5 ${customerInfoComplete ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <Label
                    className={`font-semibold ${
                      customerInfoComplete ? 'cursor-pointer' : 'text-muted-foreground'
                    }`}
                  >
                    {getOptionLabel(externalAppOption)}
                  </Label>
                </div>
                <p className={`text-sm mt-1 ${
                  customerInfoComplete ? 'text-muted-foreground' : 'text-muted-foreground/70'
                }`}>
                  {customerInfoComplete 
                    ? getOptionDescription(externalAppOption)
                    : (language === 'en' 
                        ? 'Please enter your information above to access the external payment link'
                        : 'Veuillez entrer vos informations ci-dessus pour accéder au lien de paiement externe')
                  }
                </p>
                {externalAppOption.app_image && (
                  <img
                    src={externalAppOption.app_image}
                    alt={externalAppOption.app_name || 'App'}
                    className={`h-8 mt-2 ${!customerInfoComplete ? 'opacity-50' : ''}`}
                  />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

