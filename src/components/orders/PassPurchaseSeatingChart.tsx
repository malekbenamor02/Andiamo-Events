import { Card, CardContent } from '@/components/ui/card';

interface PassPurchaseSeatingChartProps {
  language: 'en' | 'fr';
  imageUrl: string;
}

const alt = {
  en: 'Venue seating plan',
  fr: 'Plan de salle',
} as const;

/** Full seating map — separate card beside event details (desktop) or below (mobile). */
export function PassPurchaseSeatingChart({ language, imageUrl }: PassPurchaseSeatingChartProps) {
  return (
    <Card className="glass overflow-hidden">
      <CardContent className="p-3 sm:p-4">
        <img
          src={imageUrl}
          alt={alt[language]}
          className="w-full rounded-lg bg-black object-contain"
        />
      </CardContent>
    </Card>
  );
}
