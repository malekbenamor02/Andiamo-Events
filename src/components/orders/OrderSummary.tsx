/**
 * OrderSummary Component
 * Displays order summary with selected passes and total price
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SelectedPass } from '@/types/orders';
import { Receipt, Ticket } from 'lucide-react';
import { PaymentMethod } from '@/lib/constants/orderStatuses';
import { Link } from 'react-router-dom';

interface OrderSummaryProps {
  selectedPasses: SelectedPass[];
  totalPrice: number;
  paymentMethod?: PaymentMethod | null;
  termsAccepted?: boolean;
  onTermsChange?: (accepted: boolean) => void;
  language?: 'en' | 'fr';
}

export function OrderSummary({
  selectedPasses,
  totalPrice,
  paymentMethod,
  termsAccepted,
  onTermsChange,
  language = 'en'
}: OrderSummaryProps) {
  const t = language === 'en' ? {
    summary: 'Order Summary',
    pass: 'Pass',
    quantity: 'Quantity',
    price: 'Price',
    total: 'Total',
    noPasses: 'No passes selected',
    subtotal: 'Subtotal'
  } : {
    summary: 'Résumé de la Commande',
    pass: 'Pass',
    quantity: 'Quantité',
    price: 'Prix',
    total: 'Total',
    noPasses: 'Aucun pass sélectionné',
    subtotal: 'Sous-total'
  };

  const hasPasses = selectedPasses.length > 0 && selectedPasses.some(p => p.quantity > 0);

  if (!hasPasses) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Receipt className="w-5 h-5" />
            <span>{t.summary}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">{t.noPasses}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Receipt className="w-5 h-5" />
          <span>{t.summary}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Passes List */}
          <div className="space-y-3">
            {selectedPasses
              .filter(p => p.quantity > 0)
              .map((pass, index) => (
                <div key={index} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-start space-x-2 flex-1 min-w-0">
                    <Ticket className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium break-words">{pass.passName}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <Badge variant="secondary" className="text-xs whitespace-nowrap">
                          {t.quantity}: {pass.quantity}
                        </Badge>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          {pass.price.toFixed(2)} TND {language === 'en' ? 'each' : 'chacun'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0">
                    <p className="font-semibold text-lg">
                      {(pass.price * pass.quantity).toFixed(2)} TND
                    </p>
                  </div>
                </div>
              ))}
          </div>

          <Separator />

          {/* Total */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-lg font-semibold">{t.total}</span>
            <span className="text-2xl font-bold text-primary">
              {totalPrice.toFixed(2)} TND
            </span>
          </div>

          {/* Terms Acceptance */}
          {(paymentMethod === PaymentMethod.ONLINE || 
            paymentMethod === PaymentMethod.EXTERNAL_APP || 
            paymentMethod === PaymentMethod.AMBASSADOR_CASH) && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={termsAccepted || false}
                  onCheckedChange={(checked) => onTermsChange?.(checked === true)}
                  className={!termsAccepted && paymentMethod ? 'border-red-500' : ''}
                />
                <Label
                  htmlFor="terms"
                  className="text-sm cursor-pointer leading-tight"
                >
                  {language === 'en' ? (
                    <>
                      I accept the{' '}
                      <Link 
                        to="/terms" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline underline-offset-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Terms and General Conditions of Sale
                      </Link>
                    </>
                  ) : (
                    <>
                      J'accepte les{' '}
                      <Link 
                        to="/terms" 
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline underline-offset-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Terms et conditions générales de vente
                      </Link>
                    </>
                  )}
                  {paymentMethod === PaymentMethod.AMBASSADOR_CASH && (
                    <span className="text-primary"> *</span>
                  )}
                </Label>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

