import { Calendar, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ExpandableText } from '@/components/ui/expandable-text';
import { formatDateDMY } from '@/lib/date-utils';

export interface PassPurchaseEventDetailsEvent {
  name: string;
  description?: string | null;
  date: string;
  venue: string;
  city: string;
  poster_url?: string | null;
}

interface PassPurchaseEventDetailsProps {
  event: PassPurchaseEventDetailsEvent;
  language: 'en' | 'fr';
}

const copy = {
  en: {
    title: 'Event Details',
    description: 'Description',
    showMore: 'Show more',
    showLess: 'Show less',
  },
  fr: {
    title: "Détails de l'Événement",
    description: 'Description',
    showMore: 'Voir plus',
    showLess: 'Voir moins',
  },
} as const;

function normalizeEventDescription(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function PassPurchaseEventDetails({ event, language }: PassPurchaseEventDetailsProps) {
  const t = copy[language];
  const description = normalizeEventDescription(event.description);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-primary">{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {event.poster_url ? (
          <img
            src={event.poster_url}
            alt={event.name}
            className="h-48 w-full rounded-lg object-cover"
          />
        ) : null}

        <h3 className="text-xl font-bold text-primary">{event.name}</h3>

        <div className="space-y-2 text-sm">
          <div className="flex items-center">
            <Calendar className="mr-2 h-4 w-4 shrink-0 text-primary" />
            <span>{formatDateDMY(event.date, language)}</span>
          </div>
          <div className="flex items-center">
            <MapPin className="mr-2 h-4 w-4 shrink-0 text-primary" />
            <span>
              {event.venue}, {event.city}
            </span>
          </div>
        </div>

        {description ? (
          <div className="border-t border-border/40 pt-4">
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t.description}
            </h4>
            <ExpandableText
              text={description}
              maxLines={5}
              className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground md:text-base"
              showMoreText={t.showMore}
              showLessText={t.showLess}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
