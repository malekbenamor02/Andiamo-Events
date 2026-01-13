/**
 * Stock Management Component
 * STOCK SYSTEM: Admin UI for managing pass stock
 * 
 * Features:
 * - List all passes for an event (including inactive)
 * - Edit max_quantity (limited or unlimited)
 * - Activate/deactivate passes
 * - Create new passes
 * - View stock status (sold_quantity, remaining_quantity)
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { API_ROUTES, buildFullApiUrl, getApiBaseUrl } from '@/lib/api-routes';
import { Package, Plus, Edit, Power, Infinity } from 'lucide-react';

interface PassWithStock {
  id: string;
  name: string;
  price: number;
  description?: string;
  is_active: boolean;
  release_version: number;
  max_quantity: number | null;
  sold_quantity: number;
  remaining_quantity: number | null;
  is_sold_out: boolean;
  is_unlimited: boolean;
  allowed_payment_methods?: string[] | null;
}

interface StockManagementProps {
  eventId: string;
  eventName: string;
  language: 'en' | 'fr';
  onClose?: () => void;
}

export const StockManagement = ({ eventId, eventName, language, onClose }: StockManagementProps) => {
  const { toast } = useToast();
  const [passes, setPasses] = useState<PassWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStock, setEditingStock] = useState<string | null>(null);
  const [newStockValue, setNewStockValue] = useState<string>('');
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPassData, setNewPassData] = useState({
    name: '',
    price: '',
    description: '',
    max_quantity: '',
    is_unlimited: false,
    allowed_payment_methods: [] as string[] // Empty = all methods allowed (NULL in DB)
  });

  useEffect(() => {
    fetchPasses();
  }, [eventId]);

  const fetchPasses = async () => {
    try {
      setLoading(true);
      const apiBase = getApiBaseUrl();
      const url = buildFullApiUrl(API_ROUTES.ADMIN_PASSES, apiBase, eventId);
      
      if (!url) {
        throw new Error('Invalid API URL configuration');
      }

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch passes');
      }

      const data = await response.json();
      setPasses(data.passes || []);
    } catch (error: any) {
      console.error('Error fetching passes:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to fetch passes' : 'Échec du chargement des passes'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStock = async (passId: string) => {
    try {
      let maxQuantity: number | null = null;
      
      if (isUnlimited) {
        maxQuantity = null;
      } else {
        const parsed = parseInt(newStockValue);
        if (isNaN(parsed) || parsed < 0) {
          toast({
            title: language === 'en' ? 'Invalid Value' : 'Valeur Invalide',
            description: language === 'en' ? 'Please enter a valid number' : 'Veuillez entrer un nombre valide',
            variant: 'destructive'
          });
          return;
        }
        maxQuantity = parsed;
      }

      const apiBase = getApiBaseUrl();
      const url = buildFullApiUrl(API_ROUTES.ADMIN_PASS_STOCK, apiBase, passId);
      
      if (!url) {
        throw new Error('Invalid API URL configuration');
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          max_quantity: maxQuantity
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update stock');
      }

      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en' ? 'Stock updated successfully' : 'Stock mis à jour avec succès',
      });

      setEditingStock(null);
      setNewStockValue('');
      setIsUnlimited(false);
      await fetchPasses();
    } catch (error: any) {
      console.error('Error updating stock:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to update stock' : 'Échec de la mise à jour du stock'),
        variant: 'destructive'
      });
    }
  };

  const handleToggleActive = async (passId: string, currentStatus: boolean) => {
    try {
      const apiBase = getApiBaseUrl();
      const url = buildFullApiUrl(API_ROUTES.ADMIN_PASS_ACTIVATE, apiBase, passId);
      
      if (!url) {
        throw new Error('Invalid API URL configuration');
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          is_active: !currentStatus
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update pass status');
      }

      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en' 
          ? `Pass ${!currentStatus ? 'activated' : 'deactivated'}` 
          : `Pass ${!currentStatus ? 'activé' : 'désactivé'}`,
      });

      await fetchPasses();
    } catch (error: any) {
      console.error('Error toggling pass status:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to update pass status' : 'Échec de la mise à jour du statut'),
        variant: 'destructive'
      });
    }
  };

  const handleCreatePass = async () => {
    try {
      if (!newPassData.name.trim() || !newPassData.price.trim()) {
        toast({
          title: language === 'en' ? 'Validation Error' : 'Erreur de Validation',
          description: language === 'en' ? 'Name and price are required' : 'Le nom et le prix sont requis',
          variant: 'destructive'
        });
        return;
      }

      const price = parseFloat(newPassData.price);
      if (isNaN(price) || price < 0) {
        toast({
          title: language === 'en' ? 'Invalid Price' : 'Prix Invalide',
          description: language === 'en' ? 'Please enter a valid price' : 'Veuillez entrer un prix valide',
          variant: 'destructive'
        });
        return;
      }

      let maxQuantity: number | null = null;
      if (!newPassData.is_unlimited && newPassData.max_quantity.trim()) {
        const parsed = parseInt(newPassData.max_quantity);
        if (isNaN(parsed) || parsed < 0) {
          toast({
            title: language === 'en' ? 'Invalid Stock' : 'Stock Invalide',
            description: language === 'en' ? 'Please enter a valid stock quantity' : 'Veuillez entrer une quantité valide',
            variant: 'destructive'
          });
          return;
        }
        maxQuantity = parsed;
      }

      const apiBase = getApiBaseUrl();
      const url = buildFullApiUrl(API_ROUTES.ADMIN_CREATE_PASS, apiBase);
      
      if (!url) {
        throw new Error('Invalid API URL configuration');
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          event_id: eventId,
          name: newPassData.name.trim(),
          price: price,
          description: newPassData.description.trim() || null,
          max_quantity: maxQuantity,
          allowed_payment_methods: newPassData.allowed_payment_methods.length > 0 ? newPassData.allowed_payment_methods : null
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create pass');
      }

      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: language === 'en' ? 'Pass created successfully' : 'Pass créé avec succès',
      });

      setIsCreateDialogOpen(false);
      setNewPassData({
        name: '',
        price: '',
        description: '',
        max_quantity: '',
        is_unlimited: false,
        allowed_payment_methods: []
      });
      await fetchPasses();
    } catch (error: any) {
      console.error('Error creating pass:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to create pass' : 'Échec de la création du pass'),
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        {language === 'en' ? 'Loading passes...' : 'Chargement des passes...'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold">
            {language === 'en' ? 'Stock Management' : 'Gestion du Stock'}
          </h3>
          <p className="text-sm text-muted-foreground">{eventName}</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {language === 'en' ? 'New Pass' : 'Nouveau Pass'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === 'en' ? 'Create New Pass' : 'Créer un Nouveau Pass'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{language === 'en' ? 'Name' : 'Nom'} *</Label>
                <Input
                  value={newPassData.name}
                  onChange={(e) => setNewPassData({ ...newPassData, name: e.target.value })}
                  placeholder={language === 'en' ? 'Standard Pass' : 'Pass Standard'}
                />
              </div>
              <div>
                <Label>{language === 'en' ? 'Price (TND)' : 'Prix (TND)'} *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newPassData.price}
                  onChange={(e) => setNewPassData({ ...newPassData, price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>{language === 'en' ? 'Description' : 'Description'}</Label>
                <Input
                  value={newPassData.description}
                  onChange={(e) => setNewPassData({ ...newPassData, description: e.target.value })}
                  placeholder={language === 'en' ? 'Optional description' : 'Description optionnelle'}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={newPassData.is_unlimited}
                  onCheckedChange={(checked) => setNewPassData({ ...newPassData, is_unlimited: checked })}
                />
                <Label>{language === 'en' ? 'Unlimited Stock' : 'Stock Illimité'}</Label>
              </div>
              {!newPassData.is_unlimited && (
                <div>
                  <Label>{language === 'en' ? 'Max Quantity' : 'Quantité Maximum'} *</Label>
                  <Input
                    type="number"
                    value={newPassData.max_quantity}
                    onChange={(e) => setNewPassData({ ...newPassData, max_quantity: e.target.value })}
                    placeholder={language === 'en' ? '100' : '100'}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>{language === 'en' ? 'Allowed Payment Methods' : 'Méthodes de Paiement Autorisées'}</Label>
                <p className="text-xs text-muted-foreground">
                  {language === 'en' 
                    ? 'If none selected, all payment methods are allowed. Select specific methods to restrict this pass.'
                    : 'Si aucune n\'est sélectionnée, toutes les méthodes de paiement sont autorisées. Sélectionnez des méthodes spécifiques pour restreindre ce pass.'}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sm-pm-online"
                      checked={newPassData.allowed_payment_methods.includes('online')}
                      onCheckedChange={(checked) => {
                        const methods = checked
                          ? [...newPassData.allowed_payment_methods, 'online']
                          : newPassData.allowed_payment_methods.filter(m => m !== 'online');
                        setNewPassData({ ...newPassData, allowed_payment_methods: methods });
                      }}
                    />
                    <Label htmlFor="sm-pm-online" className="text-sm font-normal cursor-pointer">
                      {language === 'en' ? 'Online Payment' : 'Paiement en ligne'}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sm-pm-external-app"
                      checked={newPassData.allowed_payment_methods.includes('external_app')}
                      onCheckedChange={(checked) => {
                        const methods = checked
                          ? [...newPassData.allowed_payment_methods, 'external_app']
                          : newPassData.allowed_payment_methods.filter(m => m !== 'external_app');
                        setNewPassData({ ...newPassData, allowed_payment_methods: methods });
                      }}
                    />
                    <Label htmlFor="sm-pm-external-app" className="text-sm font-normal cursor-pointer">
                      {language === 'en' ? 'External App' : 'Application externe'}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sm-pm-ambassador-cash"
                      checked={newPassData.allowed_payment_methods.includes('ambassador_cash')}
                      onCheckedChange={(checked) => {
                        const methods = checked
                          ? [...newPassData.allowed_payment_methods, 'ambassador_cash']
                          : newPassData.allowed_payment_methods.filter(m => m !== 'ambassador_cash');
                        setNewPassData({ ...newPassData, allowed_payment_methods: methods });
                      }}
                    />
                    <Label htmlFor="sm-pm-ambassador-cash" className="text-sm font-normal cursor-pointer">
                      {language === 'en' ? 'Cash on Delivery (Ambassador)' : 'Paiement à la livraison (Ambassadeur)'}
                    </Label>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  {language === 'en' ? 'Cancel' : 'Annuler'}
                </Button>
                <Button onClick={handleCreatePass}>
                  {language === 'en' ? 'Create' : 'Créer'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {passes.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              {language === 'en' ? 'No passes found' : 'Aucun pass trouvé'}
            </CardContent>
          </Card>
        ) : (
          passes.map((pass) => (
            <Card key={pass.id} className={!pass.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{pass.name}</h4>
                      {!pass.is_active && (
                        <span className="px-2 py-1 text-xs bg-gray-500/20 text-gray-400 rounded">
                          {language === 'en' ? 'Inactive' : 'Inactif'}
                        </span>
                      )}
                      {pass.is_sold_out && !pass.is_unlimited && (
                        <span className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded">
                          {language === 'en' ? 'Sold Out' : 'Épuisé'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {pass.price} TND • {language === 'en' ? 'Release' : 'Version'} {pass.release_version}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span>
                        {language === 'en' ? 'Sold' : 'Vendu'}: <strong>{pass.sold_quantity}</strong>
                      </span>
                      <span>
                        {language === 'en' ? 'Max' : 'Max'}:{' '}
                        <strong>
                          {pass.is_unlimited ? (
                            <span className="flex items-center gap-1">
                              <Infinity className="w-4 h-4" />
                              {language === 'en' ? 'Unlimited' : 'Illimité'}
                            </span>
                          ) : (
                            pass.max_quantity
                          )}
                        </strong>
                      </span>
                      {!pass.is_unlimited && pass.remaining_quantity !== null && (
                        <span>
                          {language === 'en' ? 'Remaining' : 'Restant'}: <strong>{pass.remaining_quantity}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Payment Method Restrictions */}
                  <div className="mt-3 space-y-2 p-3 bg-muted/20 rounded-lg border">
                    <Label className="text-sm font-semibold">
                      {language === 'en' ? 'Allowed Payment Methods' : 'Méthodes de Paiement Autorisées'}
                    </Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      {language === 'en' 
                        ? 'If none selected, all payment methods are allowed. Select specific methods to restrict this pass.'
                        : 'Si aucune n\'est sélectionnée, toutes les méthodes de paiement sont autorisées. Sélectionnez des méthodes spécifiques pour restreindre ce pass.'}
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`sm-pm-online-${pass.id}`}
                          checked={(pass.allowed_payment_methods || []).includes('online')}
                          onCheckedChange={async (checked) => {
                            const currentMethods = pass.allowed_payment_methods || [];
                            const newMethods = checked
                              ? [...currentMethods, 'online']
                              : currentMethods.filter(m => m !== 'online');
                            
                            try {
                              const apiBase = getApiBaseUrl();
                              const response = await fetch(`${apiBase}/api/admin/passes/${pass.id}/payment-methods`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ 
                                  allowed_payment_methods: newMethods.length > 0 ? newMethods : null 
                                })
                              });
                              
                              if (!response.ok) {
                                const error = await response.json();
                                toast({
                                  title: language === 'en' ? 'Error' : 'Erreur',
                                  description: error.error || error.details || (language === 'en' ? 'Failed to update payment methods' : 'Échec de la mise à jour des méthodes de paiement'),
                                  variant: 'destructive'
                                });
                                return;
                              }
                              
                              const result = await response.json();
                              const updatedPasses = passes.map(p => 
                                p.id === pass.id 
                                  ? { ...p, allowed_payment_methods: result.pass.allowed_payment_methods || null }
                                  : p
                              );
                              setPasses(updatedPasses);
                              
                              toast({
                                title: language === 'en' ? 'Success' : 'Succès',
                                description: language === 'en' ? 'Payment methods updated' : 'Méthodes de paiement mises à jour',
                              });
                            } catch (error: any) {
                              toast({
                                title: language === 'en' ? 'Error' : 'Erreur',
                                description: error.message || (language === 'en' ? 'Failed to update payment methods' : 'Échec de la mise à jour des méthodes de paiement'),
                                variant: 'destructive'
                              });
                            }
                          }}
                        />
                        <Label htmlFor={`sm-pm-online-${pass.id}`} className="text-sm font-normal cursor-pointer">
                          {language === 'en' ? 'Online Payment' : 'Paiement en ligne'}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`sm-pm-external-app-${pass.id}`}
                          checked={(pass.allowed_payment_methods || []).includes('external_app')}
                          onCheckedChange={async (checked) => {
                            const currentMethods = pass.allowed_payment_methods || [];
                            const newMethods = checked
                              ? [...currentMethods, 'external_app']
                              : currentMethods.filter(m => m !== 'external_app');
                            
                            try {
                              const apiBase = getApiBaseUrl();
                              const response = await fetch(`${apiBase}/api/admin/passes/${pass.id}/payment-methods`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ 
                                  allowed_payment_methods: newMethods.length > 0 ? newMethods : null 
                                })
                              });
                              
                              if (!response.ok) {
                                const error = await response.json();
                                toast({
                                  title: language === 'en' ? 'Error' : 'Erreur',
                                  description: error.error || error.details || (language === 'en' ? 'Failed to update payment methods' : 'Échec de la mise à jour des méthodes de paiement'),
                                  variant: 'destructive'
                                });
                                return;
                              }
                              
                              const result = await response.json();
                              const updatedPasses = passes.map(p => 
                                p.id === pass.id 
                                  ? { ...p, allowed_payment_methods: result.pass.allowed_payment_methods || null }
                                  : p
                              );
                              setPasses(updatedPasses);
                              
                              toast({
                                title: language === 'en' ? 'Success' : 'Succès',
                                description: language === 'en' ? 'Payment methods updated' : 'Méthodes de paiement mises à jour',
                              });
                            } catch (error: any) {
                              toast({
                                title: language === 'en' ? 'Error' : 'Erreur',
                                description: error.message || (language === 'en' ? 'Failed to update payment methods' : 'Échec de la mise à jour des méthodes de paiement'),
                                variant: 'destructive'
                              });
                            }
                          }}
                        />
                        <Label htmlFor={`sm-pm-external-app-${pass.id}`} className="text-sm font-normal cursor-pointer">
                          {language === 'en' ? 'External App' : 'Application externe'}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`sm-pm-ambassador-cash-${pass.id}`}
                          checked={(pass.allowed_payment_methods || []).includes('ambassador_cash')}
                          onCheckedChange={async (checked) => {
                            const currentMethods = pass.allowed_payment_methods || [];
                            const newMethods = checked
                              ? [...currentMethods, 'ambassador_cash']
                              : currentMethods.filter(m => m !== 'ambassador_cash');
                            
                            try {
                              const apiBase = getApiBaseUrl();
                              const response = await fetch(`${apiBase}/api/admin/passes/${pass.id}/payment-methods`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ 
                                  allowed_payment_methods: newMethods.length > 0 ? newMethods : null 
                                })
                              });
                              
                              if (!response.ok) {
                                const error = await response.json();
                                toast({
                                  title: language === 'en' ? 'Error' : 'Erreur',
                                  description: error.error || error.details || (language === 'en' ? 'Failed to update payment methods' : 'Échec de la mise à jour des méthodes de paiement'),
                                  variant: 'destructive'
                                });
                                return;
                              }
                              
                              const result = await response.json();
                              const updatedPasses = passes.map(p => 
                                p.id === pass.id 
                                  ? { ...p, allowed_payment_methods: result.pass.allowed_payment_methods || null }
                                  : p
                              );
                              setPasses(updatedPasses);
                              
                              toast({
                                title: language === 'en' ? 'Success' : 'Succès',
                                description: language === 'en' ? 'Payment methods updated' : 'Méthodes de paiement mises à jour',
                              });
                            } catch (error: any) {
                              toast({
                                title: language === 'en' ? 'Error' : 'Erreur',
                                description: error.message || (language === 'en' ? 'Failed to update payment methods' : 'Échec de la mise à jour des méthodes de paiement'),
                                variant: 'destructive'
                              });
                            }
                          }}
                        />
                        <Label htmlFor={`sm-pm-ambassador-cash-${pass.id}`} className="text-sm font-normal cursor-pointer">
                          {language === 'en' ? 'Cash on Delivery (Ambassador)' : 'Paiement à la livraison (Ambassadeur)'}
                        </Label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {editingStock === pass.id ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={isUnlimited}
                            onCheckedChange={(checked) => {
                              setIsUnlimited(checked);
                              if (!checked) {
                                setNewStockValue(pass.max_quantity?.toString() || '');
                              }
                            }}
                          />
                          <Label className="text-xs">{language === 'en' ? 'Unlimited' : 'Illimité'}</Label>
                        </div>
                        {!isUnlimited && (
                          <Input
                            type="number"
                            value={newStockValue}
                            onChange={(e) => setNewStockValue(e.target.value)}
                            placeholder={language === 'en' ? 'Max quantity' : 'Quantité max'}
                            className="w-24"
                            min={pass.sold_quantity}
                          />
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStock(pass.id)}
                          disabled={!isUnlimited && (!newStockValue || parseInt(newStockValue) < pass.sold_quantity)}
                        >
                          {language === 'en' ? 'Save' : 'Enregistrer'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingStock(null);
                            setNewStockValue('');
                            setIsUnlimited(false);
                          }}
                        >
                          {language === 'en' ? 'Cancel' : 'Annuler'}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingStock(pass.id);
                            setNewStockValue(pass.max_quantity?.toString() || '');
                            setIsUnlimited(pass.is_unlimited);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          {language === 'en' ? 'Edit Stock' : 'Modifier Stock'}
                        </Button>
                        <Button
                          size="sm"
                          variant={pass.is_active ? 'destructive' : 'default'}
                          onClick={() => handleToggleActive(pass.id, pass.is_active)}
                        >
                          <Power className="w-4 h-4 mr-1" />
                          {pass.is_active 
                            ? (language === 'en' ? 'Deactivate' : 'Désactiver')
                            : (language === 'en' ? 'Activate' : 'Activer')
                          }
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
