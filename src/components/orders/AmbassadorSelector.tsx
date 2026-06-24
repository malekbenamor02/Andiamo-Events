/**
 * AmbassadorSelector Component
 * Allows user to select an active ambassador for cash payment
 */

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapPin, AlertCircle, User } from 'lucide-react';
import { useActiveAmbassadors } from '@/hooks/useActiveAmbassadors';
import {
  selectableOptionCardClass,
  selectableOptionRowClass,
} from '@/components/orders/selectableOptionStyles';

const SELECT_AMBASSADOR_AR_DESC = 'أختار أقرب Ambassadeur يكلمك و تخلصو';

interface AmbassadorSelectorProps {
  city: string;
  ville?: string;
  cityWide?: boolean;
  selectedAmbassadorId: string | null;
  onSelect: (ambassadorId: string) => void;
  language?: 'en' | 'fr';
}

export function AmbassadorSelector({
  city,
  ville,
  cityWide = false,
  selectedAmbassadorId,
  onSelect,
  language = 'en',
}: AmbassadorSelectorProps) {
  const { data: ambassadors, isLoading, error } = useActiveAmbassadors(city, ville, { cityWide });

  const t =
    language === 'en'
      ? {
          selectAmbassador: 'Choose your ambassador',
          noAmbassadors: 'No ambassadors available in this area',
          noAmbassadorsDesc: 'Try another city or payment method',
          loading: 'Loading ambassadors…',
          error: 'Could not load ambassadors',
          enterInfoFirst: 'Enter your location above to see available ambassadors',
        }
      : {
          selectAmbassador: 'Choisissez votre ambassadeur',
          noAmbassadors: 'Aucun ambassadeur disponible dans cette zone',
          noAmbassadorsDesc: 'Essayez une autre ville ou un autre mode de paiement',
          loading: 'Chargement des ambassadeurs…',
          error: 'Impossible de charger les ambassadeurs',
          enterInfoFirst: 'Indiquez votre localisation pour voir les ambassadeurs disponibles',
        };

  if (!city) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{t.enterInfoFirst}</AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return <div className="py-6 text-center text-sm text-muted-foreground">{t.loading}</div>;
  }

  if (error) {
    const errorMessage =
      error instanceof Error
        ? error.message.includes('Unable to connect') || error.message.includes('connection failed')
          ? language === 'en'
            ? 'Unable to connect to the server. Please try again.'
            : 'Impossible de se connecter au serveur. Veuillez réessayer.'
          : error.message
        : t.error;

    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    );
  }

  if (!ambassadors || ambassadors.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium">{t.noAmbassadors}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t.noAmbassadorsDesc}</p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-base font-semibold text-foreground">{t.selectAmbassador}</Label>
        <p lang="ar" dir="rtl" className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {SELECT_AMBASSADOR_AR_DESC}
        </p>
      </div>

      <RadioGroup
        value={selectedAmbassadorId || undefined}
        onValueChange={onSelect}
        className="gap-3"
      >
        {ambassadors.map((ambassador) => {
          const displayVille = cityWide ? ambassador.ville : ville || ambassador.ville;
          const isSelected = selectedAmbassadorId === ambassador.id;

          return (
            <label
              key={ambassador.id}
              htmlFor={`ambassador-${ambassador.id}`}
              className={selectableOptionCardClass(isSelected)}
            >
              <div className={selectableOptionRowClass()}>
                <RadioGroupItem
                  value={ambassador.id}
                  id={`ambassador-${ambassador.id}`}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="font-medium text-foreground">{ambassador.full_name}</span>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      {ambassador.city}
                      {displayVille ? `, ${displayVille}` : ''}
                    </span>
                  </p>
                </div>
              </div>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}
