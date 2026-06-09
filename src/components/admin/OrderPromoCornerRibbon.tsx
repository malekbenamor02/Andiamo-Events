import { cn } from '@/lib/utils';

type OrderPromoCornerRibbonProps = {
  code: string;
  color: string;
  variant: 'table' | 'card';
  className?: string;
  title?: string;
};

/** Corner ribbon showing promo code name with its stored badge color. */
export function OrderPromoCornerRibbon({
  code,
  color,
  variant,
  className,
  title,
}: OrderPromoCornerRibbonProps) {
  const label = String(code || '').trim().toUpperCase();
  if (!label) return null;
  const display = label.length > 8 ? `${label.slice(0, 7)}…` : label;

  if (variant === 'table') {
    return (
      <div
        className={cn(
          'absolute top-0 left-0 w-[38px] h-[38px] overflow-hidden pointer-events-none z-10',
          className
        )}
        title={title ?? label}
      >
        <span
          className="absolute block text-center text-white font-bold uppercase tracking-wider shadow-sm"
          style={{
            backgroundColor: color,
            width: 72,
            transform: 'rotate(-45deg)',
            top: 6,
            left: -22,
            fontSize: label.length > 6 ? 6 : 7,
            lineHeight: '10px',
            padding: '1px 0',
          }}
        >
          {display}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'pointer-events-none absolute right-0 top-0 z-10 h-[80px] w-[80px] overflow-hidden',
        className
      )}
      title={title ?? label}
    >
      <span
        className="absolute block py-[2px] text-center font-bold uppercase tracking-wider text-white shadow-md"
        style={{
          backgroundColor: color,
          width: 130,
          transform: 'rotate(45deg)',
          top: 16,
          right: -38,
          fontSize: label.length > 6 ? 8 : 10,
        }}
      >
        {display}
      </span>
    </div>
  );
}
