/**
 * OrderSummary Component
 * Displays order summary with selected passes and total price
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SelectedPass } from '@/types/orders';
import { Receipt, Ticket, Info } from 'lucide-react';
import { PaymentMethod } from '@/lib/constants/orderStatuses';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface OrderSummaryProps {
  selectedPasses: SelectedPass[];
  totalPrice: number;
  paymentMethod?: PaymentMethod | null;
  termsAccepted?: boolean;
  onTermsChange?: (accepted: boolean) => void;
  language?: 'en' | 'fr';
  /** Optional 5% fee amount for online payments (frontend display only). */
  feeAmount?: number;
  /** Optional grand total including fees (frontend display only). */
  totalWithFees?: number;
}

export function OrderSummary({
  selectedPasses,
  totalPrice,
  paymentMethod,
  termsAccepted,
  onTermsChange,
  language = 'en',
  feeAmount,
  totalWithFees,
}: OrderSummaryProps) {
  const t = language === 'en'
    ? {
        summary: 'Order Summary',
        pass: 'Pass',
        quantity: 'Quantity',
        price: 'Price',
        total: 'Total',
        noPasses: 'No passes selected',
        subtotal: 'Subtotal',
        fees: 'Fees',
        feesTitle: 'Fee details',
        feesLine1: 'This amount is split between:',
        feesLine2: '• Banking and transaction fees',
        feesLine3: '• Platform operation and maintenance',
        feesLine4: '• Technical support and customer service',
        totalWithFees: 'Total (incl. fees)',
      }
    : {
        summary: 'Résumé de la Commande',
        pass: 'Pass',
        quantity: 'Quantité',
        price: 'Prix',
        total: 'Total',
        noPasses: 'Aucun pass sélectionné',
        subtotal: 'Sous-total',
        fees: 'Frais',
        feesTitle: 'Détail des frais',
        feesLine1: 'Ce montant est réparti entre :',
        feesLine2: '• Les frais bancaires et de transaction',
        feesLine3: '• Le fonctionnement et la maintenance de la plateforme',
        feesLine4: '• Le support technique et service client',
        totalWithFees: 'Total (frais inclus)',
      };

  const isOnline = paymentMethod === PaymentMethod.ONLINE;
  const effectiveFee = isOnline && typeof feeAmount === 'number' && !Number.isNaN(feeAmount) ? feeAmount : 0;
  const grandTotal = isOnline && typeof totalWithFees === 'number' && !Number.isNaN(totalWithFees)
    ? totalWithFees
    : totalPrice;

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

          {/* Subtotal, fees (if online), and total */}
          <div className="space-y-1 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t.subtotal}</span>
              <span className="font-semibold">
                {totalPrice.toFixed(2)} TND
              </span>
            </div>

            {isOnline && effectiveFee > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">{t.fees}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-muted-foreground/40 text-muted-foreground hover:text-primary hover:border-primary transition-colors text-[10px]"
                          aria-label={t.feesTitle}
                        >
                          <Info className="w-3 h-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs space-y-1">
                        <p className="font-semibold">{t.feesTitle}</p>
                        <p>{t.feesLine1}</p>
                        <p>{t.feesLine2}</p>
                        <p>{t.feesLine3}</p>
                        <p>{t.feesLine4}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <span className="font-semibold">
                  {effectiveFee.toFixed(2)} TND
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-lg font-semibold">
                {isOnline && effectiveFee > 0 ? t.totalWithFees : t.total}
              </span>
              <span className="text-2xl font-bold text-primary">
                {grandTotal.toFixed(2)} TND
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

