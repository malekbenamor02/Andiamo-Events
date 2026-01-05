/**
 * AmbassadorSelector Component
 * Allows user to select an active ambassador for cash payment
 */

import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Ambassador } from '@/types/orders';
import { User, Phone, MapPin, AlertCircle } from 'lucide-react';
import { useActiveAmbassadors } from '@/hooks/useActiveAmbassadors';

interface AmbassadorSelectorProps {
  city: string;
  ville?: string;
  selectedAmbassadorId: string | null;
  onSelect: (ambassadorId: string) => void;
  language?: 'en' | 'fr';
}

export function AmbassadorSelector({
  city,
  ville,
  selectedAmbassadorId,
  onSelect,
  language = 'en'
}: AmbassadorSelectorProps) {
  const { data: ambassadors, isLoading, error } = useActiveAmbassadors(city, ville);

  const t = language === 'en' ? {
    selectAmbassador: 'Choose Your Ambassador',
    selectAmbassadorDesc: 'Select an ambassador based on your location to complete your order',
    noAmbassadors: 'No active ambassadors available in this area',
    noAmbassadorsDesc: 'Please select a different city or ville, or choose a different payment method',
    loading: 'Loading ambassadors...',
    error: 'Error loading ambassadors',
    phone: 'Phone',
    location: 'Location',
    enterInfoFirst: 'Please enter your information above to see available ambassadors in your area'
  } : {
    selectAmbassador: 'Choisissez Votre Ambassadeur',
    selectAmbassadorDesc: 'Sélectionnez un ambassadeur selon votre localisation pour finaliser votre commande',
    noAmbassadors: 'Aucun ambassadeur actif disponible dans cette zone',
    noAmbassadorsDesc: 'Veuillez sélectionner une autre ville ou quartier, ou choisir un autre mode de paiement',
    loading: 'Chargement des ambassadeurs...',
    error: 'Erreur lors du chargement des ambassadeurs',
    phone: 'Téléphone',
    location: 'Emplacement',
    enterInfoFirst: 'Veuillez entrer vos informations ci-dessus pour voir les ambassadeurs disponibles dans votre région'
  };

  if (!city) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t.enterInfoFirst}
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t.loading}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{t.error}</AlertDescription>
      </Alert>
    );
  }

  if (!ambassadors || ambassadors.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <div className="space-y-2">
            <p className="font-semibold">{t.noAmbassadors}</p>
            <p className="text-sm">{t.noAmbassadorsDesc}</p>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold">{t.selectAmbassador}</Label>
        <p className="text-sm text-muted-foreground mt-1">{t.selectAmbassadorDesc}</p>
      </div>
      
      <RadioGroup
        value={selectedAmbassadorId || undefined}
        onValueChange={onSelect}
      >
        <div className="space-y-3">
          {ambassadors.map((ambassador) => (
            <Card
              key={ambassador.id}
              className={`cursor-pointer transition-all ${
                selectedAmbassadorId === ambassador.id
                  ? 'ring-2 ring-primary'
                  : 'hover:bg-accent'
              }`}
              onClick={() => onSelect(ambassador.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <RadioGroupItem
                    value={ambassador.id}
                    id={`ambassador-${ambassador.id}`}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <Label
                        htmlFor={`ambassador-${ambassador.id}`}
                        className="font-semibold cursor-pointer"
                      >
                        {ambassador.full_name}
                      </Label>
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <Phone className="w-3 h-3" />
                        <span>{ambassador.phone}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-3 h-3" />
                        <span>
                          {ambassador.city}
                          {ambassador.ville && `, ${ambassador.ville}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </RadioGroup>
    </div>
  );
}

