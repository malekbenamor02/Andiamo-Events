/**
 * CustomerInfoForm Component
 * Collects customer information before payment selection
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomerInfo } from '@/types/orders';
import { CITIES, SOUSSE_VILLES, TUNIS_VILLES } from '@/lib/constants';

interface CustomerInfoFormProps {
  customerInfo: CustomerInfo;
  onChange: (info: CustomerInfo) => void;
  errors?: Record<string, string>;
  language?: 'en' | 'fr';
}

export function CustomerInfoForm({ 
  customerInfo, 
  onChange, 
  errors = {},
  language = 'en'
}: CustomerInfoFormProps) {
  const t = language === 'en' ? {
    fullName: 'Full Name',
    phone: 'Phone Number',
    email: 'Email',
    city: 'City',
    ville: 'Ville (Neighborhood)',
    required: 'This field is required',
    invalidPhone: 'Invalid phone number format',
    invalidEmail: 'Invalid email format',
    villeRequired: 'Ville is required when city is Sousse',
    selectCity: 'Select City',
    selectVille: 'Select Ville'
  } : {
    fullName: 'Nom Complet',
    phone: 'Numéro de Téléphone',
    email: 'Email',
    city: 'Ville',
    ville: 'Ville (Quartier)',
    required: 'Ce champ est requis',
    invalidPhone: 'Format de numéro de téléphone invalide',
    invalidEmail: 'Format d\'email invalide',
    villeRequired: 'La ville est requise lorsque la ville est Sousse',
    selectCity: 'Sélectionner la Ville',
    selectVille: 'Sélectionner le Quartier'
  };

  const handleChange = (field: keyof CustomerInfo, value: string) => {
    onChange({
      ...customerInfo,
      [field]: value,
      // Reset ville when city changes
      ...(field === 'city' ? { ville: undefined } : {})
    } as CustomerInfo);
  };

  const getVillesForCity = (city: string) => {
    if (city === 'Sousse') return SOUSSE_VILLES;
    if (city === 'Tunis') return TUNIS_VILLES;
    return [];
  };

  const villes = customerInfo.city ? getVillesForCity(customerInfo.city) : [];

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="full_name">{t.fullName} *</Label>
        <Input
          id="full_name"
          value={customerInfo.full_name}
          onChange={(e) => handleChange('full_name', e.target.value)}
          className={errors.full_name || errors.fullName ? 'border-red-500' : ''}
        />
        {(errors.full_name || errors.fullName) && (
          <p className="text-sm text-red-500 mt-1">{errors.full_name || errors.fullName}</p>
        )}
      </div>

      <div>
        <Label htmlFor="phone">{t.phone} *</Label>
        <Input
          id="phone"
          type="tel"
          value={customerInfo.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          className={errors.phone ? 'border-red-500' : ''}
        />
        {errors.phone && (
          <p className="text-sm text-red-500 mt-1">{errors.phone}</p>
        )}
      </div>

      <div>
        <Label htmlFor="email">{t.email} *</Label>
        <Input
          id="email"
          type="email"
          value={customerInfo.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className={errors.email ? 'border-red-500' : ''}
        />
        {errors.email && (
          <p className="text-sm text-red-500 mt-1">{errors.email}</p>
        )}
      </div>

      <div>
        <Label htmlFor="city">{t.city} *</Label>
        <Select
          value={customerInfo.city}
          onValueChange={(value) => handleChange('city', value)}
        >
          <SelectTrigger className={errors.city ? 'border-red-500' : ''}>
            <SelectValue placeholder={t.selectCity} />
          </SelectTrigger>
          <SelectContent>
            {CITIES.map((city) => (
              <SelectItem key={city} value={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.city && (
          <p className="text-sm text-red-500 mt-1">{errors.city}</p>
        )}
      </div>

      {villes.length > 0 && (
        <div>
          <Label htmlFor="ville">{t.ville} *</Label>
          <Select
            value={customerInfo.ville || ''}
            onValueChange={(value) => handleChange('ville', value)}
          >
            <SelectTrigger className={errors.ville ? 'border-red-500' : ''}>
              <SelectValue placeholder={t.selectVille} />
            </SelectTrigger>
            <SelectContent>
              {villes.map((ville) => (
                <SelectItem key={ville} value={ville}>
                  {ville}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.ville && (
            <p className="text-sm text-red-500 mt-1">{errors.ville}</p>
          )}
        </div>
      )}
    </div>
  );
}

