/**
 * Payment Options Manager Component
 * Allows admin to enable/disable and configure payment options
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { fetchAllPaymentOptions } from '@/lib/orders/paymentService';
import { PaymentOption } from '@/types/orders';
import { PaymentOptionType } from '@/lib/constants/orderStatuses';
import { CreditCard, ExternalLink, Wallet, Save, RefreshCw } from 'lucide-react';
import { API_ROUTES } from '@/lib/api-routes';
import { apiFetch, handleApiResponse } from '@/lib/api-client';

interface PaymentOptionsManagerProps {
  language?: 'en' | 'fr';
}

export function PaymentOptionsManager({ language = 'en' }: PaymentOptionsManagerProps) {
  const { toast } = useToast();
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<Record<string, any>>({});

  const t = language === 'en' ? {
    title: 'Payment Options Management',
    description: 'Enable or disable payment methods and configure external app settings',
    online: 'Online Payment',
    externalApp: 'External App Payment',
    ambassadorCash: 'Ambassador Cash Payment',
    enabled: 'Enabled',
    disabled: 'Disabled',
    appName: 'App Name',
    externalLink: 'External Link',
    appImage: 'App Image URL',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Settings saved successfully',
    error: 'Failed to save settings',
    refresh: 'Refresh',
    loading: 'Loading payment options...',
    enableOption: 'Enable this payment option',
    disableOption: 'Disable this payment option'
  } : {
    title: 'Gestion des Options de Paiement',
    description: 'Activer ou désactiver les méthodes de paiement et configurer les paramètres de l\'application externe',
    online: 'Paiement en Ligne',
    externalApp: 'Paiement via Application Externe',
    ambassadorCash: 'Paiement Espèces (Ambassadeur)',
    enabled: 'Activé',
    disabled: 'Désactivé',
    appName: 'Nom de l\'Application',
    externalLink: 'Lien Externe',
    appImage: 'URL de l\'Image de l\'Application',
    save: 'Enregistrer',
    saving: 'Enregistrement...',
    saved: 'Paramètres enregistrés avec succès',
    error: 'Échec de l\'enregistrement des paramètres',
    refresh: 'Actualiser',
    loading: 'Chargement des options de paiement...',
    enableOption: 'Activer cette option de paiement',
    disableOption: 'Désactiver cette option de paiement'
  };

  useEffect(() => {
    fetchPaymentOptions();
  }, []);

  const fetchPaymentOptions = async () => {
    try {
      setLoading(true);
      const options = await fetchAllPaymentOptions();
      setPaymentOptions(options);
      // Initialize editing state
      const editState: Record<string, any> = {};
      options.forEach(opt => {
        editState[opt.option_type] = {
          enabled: opt.enabled,
          app_name: opt.app_name || '',
          external_link: opt.external_link || '',
          app_image: opt.app_image || ''
        };
      });
      setEditing(editState);
    } catch (error: any) {
      console.error('Error fetching payment options:', error);
      toast({
        title: t.error,
        description: error.message || (language === 'en' ? 'Failed to load payment options' : 'Échec du chargement des options de paiement'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (optionType: PaymentOptionType, enabled: boolean) => {
    try {
      setSaving(prev => ({ ...prev, [optionType]: true }));
      
      const response = await apiFetch(API_ROUTES.UPDATE_PAYMENT_OPTION(optionType), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });

      if (!response.ok) {
        throw new Error('Failed to update payment option');
      }

      // Update local state
      setPaymentOptions(prev => 
        prev.map(opt => 
          opt.option_type === optionType ? { ...opt, enabled } : opt
        )
      );
      setEditing(prev => ({
        ...prev,
        [optionType]: { ...prev[optionType], enabled }
      }));

      toast({
        title: t.saved,
        description: language === 'en' 
          ? `${optionType} payment option ${enabled ? 'enabled' : 'disabled'}`
          : `Option de paiement ${optionType} ${enabled ? 'activée' : 'désactivée'}`,
        variant: 'default'
      });
    } catch (error: any) {
      console.error('Error updating payment option:', error);
      toast({
        title: t.error,
        description: error.message || (language === 'en' ? 'Failed to update payment option' : 'Échec de la mise à jour de l\'option de paiement'),
        variant: 'destructive'
      });
    } finally {
      setSaving(prev => ({ ...prev, [optionType]: false }));
    }
  };

  const handleSaveExternalApp = async () => {
    const optionType = PaymentOptionType.EXTERNAL_APP;
    const config = editing[optionType];
    
    if (!config.external_link || !config.app_name) {
      toast({
        title: t.error,
        description: language === 'en' ? 'App name and external link are required' : 'Le nom de l\'application et le lien externe sont requis',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSaving(prev => ({ ...prev, [optionType]: true }));
      
      const response = await apiFetch(API_ROUTES.UPDATE_PAYMENT_OPTION(optionType), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: config.enabled,
          app_name: config.app_name,
          external_link: config.external_link,
          app_image: config.app_image || null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update external app configuration');
      }

      const result = await handleApiResponse(response);
      
      setPaymentOptions(prev => 
        prev.map(opt => 
          opt.option_type === optionType ? result.data : opt
        )
      );
      setEditing(prev => ({
        ...prev,
        [optionType]: {
          ...prev[optionType],
          enabled: result.data.enabled,
          app_name: result.data.app_name,
          external_link: result.data.external_link,
          app_image: result.data.app_image
        }
      }));

      toast({
        title: t.saved,
        description: language === 'en' ? 'External app settings saved' : 'Paramètres de l\'application externe enregistrés',
        variant: 'default'
      });
    } catch (error: any) {
      console.error('Error saving external app config:', error);
      toast({
        title: t.error,
        description: error.message || (language === 'en' ? 'Failed to save settings' : 'Échec de l\'enregistrement des paramètres'),
        variant: 'destructive'
      });
    } finally {
      setSaving(prev => ({ ...prev, [optionType]: false }));
    }
  };

  const getOptionLabel = (optionType: PaymentOptionType) => {
    switch (optionType) {
      case PaymentOptionType.ONLINE:
        return t.online;
      case PaymentOptionType.EXTERNAL_APP:
        return t.externalApp;
      case PaymentOptionType.AMBASSADOR_CASH:
        return t.ambassadorCash;
      default:
        return optionType;
    }
  };

  const getOptionIcon = (optionType: PaymentOptionType) => {
    switch (optionType) {
      case PaymentOptionType.ONLINE:
        return <CreditCard className="w-5 h-5" />;
      case PaymentOptionType.EXTERNAL_APP:
        return <ExternalLink className="w-5 h-5" />;
      case PaymentOptionType.AMBASSADOR_CASH:
        return <Wallet className="w-5 h-5" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p>{t.loading}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t.title}</h2>
          <p className="text-muted-foreground mt-1">{t.description}</p>
        </div>
        <Button onClick={fetchPaymentOptions} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          {t.refresh}
        </Button>
      </div>

      <div className="grid gap-6">
        {paymentOptions.map((option) => (
          <Card key={option.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getOptionIcon(option.option_type)}
                  <CardTitle>{getOptionLabel(option.option_type)}</CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-sm ${option.enabled ? 'text-green-600' : 'text-gray-500'}`}>
                    {option.enabled ? t.enabled : t.disabled}
                  </span>
                  <Switch
                    checked={option.enabled}
                    onCheckedChange={(checked) => handleToggle(option.option_type, checked)}
                    disabled={saving[option.option_type]}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {option.option_type === PaymentOptionType.EXTERNAL_APP && (
                <div className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="app_name">{t.appName} *</Label>
                    <Input
                      id="app_name"
                      value={editing[option.option_type]?.app_name || ''}
                      onChange={(e) => setEditing(prev => ({
                        ...prev,
                        [option.option_type]: {
                          ...prev[option.option_type],
                          app_name: e.target.value
                        }
                      }))}
                      placeholder="AIO Events"
                    />
                  </div>
                  <div>
                    <Label htmlFor="external_link">{t.externalLink} *</Label>
                    <Input
                      id="external_link"
                      type="url"
                      value={editing[option.option_type]?.external_link || ''}
                      onChange={(e) => setEditing(prev => ({
                        ...prev,
                        [option.option_type]: {
                          ...prev[option.option_type],
                          external_link: e.target.value
                        }
                      }))}
                      placeholder="https://your-payment-app.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="app_image">{t.appImage}</Label>
                    <Input
                      id="app_image"
                      type="url"
                      value={editing[option.option_type]?.app_image || ''}
                      onChange={(e) => setEditing(prev => ({
                        ...prev,
                        [option.option_type]: {
                          ...prev[option.option_type],
                          app_image: e.target.value
                        }
                      }))}
                      placeholder="https://example.com/app-logo.png"
                    />
                  </div>
                  <Button
                    onClick={handleSaveExternalApp}
                    disabled={saving[option.option_type]}
                  >
                    {saving[option.option_type] ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        {t.saving}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {t.save}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

