import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type PromoCodeColorBadgeProps = {
  color: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
};

/** Promo badge using the color stored on the promo code (not derived from code name). */
export function PromoCodeColorBadge({ color, children, className, title }: PromoCodeColorBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('border-transparent text-white hover:opacity-90', className)}
      style={{ backgroundColor: color }}
      title={title}
    >
      {children}
    </Badge>
  );
}
