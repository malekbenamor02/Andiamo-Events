import { cn } from '@/lib/utils';
import type { AcademyPaymentMethod } from '@/types/academy';

const PAYMENT_ICON_SRC: Record<AcademyPaymentMethod, string> = {
  card: '/assets/credit-card.svg',
  rib: '/assets/bank.svg',
  d17: '/assets/d17.svg',
};

const PAYMENT_ICON_ALT: Record<AcademyPaymentMethod, string> = {
  card: 'Credit or debit card',
  rib: 'Bank transfer',
  d17: 'D17',
};

interface AcademyPaymentMethodIconProps {
  method: AcademyPaymentMethod;
  selected?: boolean;
  className?: string;
}

const AcademyPaymentMethodIcon = ({ method, selected = false, className }: AcademyPaymentMethodIconProps) => {
  const isD17 = method === 'd17';

  return (
    <span
      className={cn(
        'inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl',
        isD17 ? 'p-1' : 'p-2.5',
        'ring-1 ring-inset transition-all duration-200',
        selected
          ? 'bg-primary/10 ring-primary/30 shadow-[0_4px_16px_hsl(var(--primary)/0.15)]'
          : 'bg-muted/40 ring-border/40',
        className
      )}
    >
      <img
        src={PAYMENT_ICON_SRC[method]}
        alt={PAYMENT_ICON_ALT[method]}
        className={cn(
          'h-full w-full object-contain',
          isD17
            ? cn('rounded-lg opacity-90', selected && 'opacity-100')
            : cn(
                'opacity-75 dark:brightness-0 dark:invert dark:opacity-90',
                selected && 'opacity-100'
              )
        )}
        draggable={false}
      />
    </span>
  );
};

export default AcademyPaymentMethodIcon;
