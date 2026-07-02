/**
 * Change ambassador ownership dialog (Admin COD order details).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import Loader from '@/components/ui/Loader';
import { adminApi } from '@/lib/adminApi';
import { adminOrdersApi } from '@/lib/adminOrdersApi';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, User } from 'lucide-react';

type AmbassadorOption = {
  id: string;
  full_name: string;
  city?: string;
  ville?: string;
  status?: string;
};

export interface ChangeAmbassadorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  currentAmbassadorId: string | null | undefined;
  currentAmbassadorName: string | null | undefined;
  customerCity?: string | null;
  customerVille?: string | null;
  language: 'en' | 'fr';
  onSuccess: (result: {
    ambassador_id: string;
    ambassador_name: string;
    notifications?: {
      ambassador?: { emailSent?: boolean; smsSent?: boolean };
      customer?: { emailSent?: boolean; smsSent?: boolean };
      emailSent?: boolean;
      smsSent?: boolean;
    };
  }) => void | Promise<void>;
}

export function ChangeAmbassadorDialog({
  open,
  onOpenChange,
  orderId,
  currentAmbassadorId,
  currentAmbassadorName,
  customerCity,
  customerVille,
  language,
  onSuccess,
}: ChangeAmbassadorDialogProps) {
  const { toast } = useToast();
  const [loadingAmbassadors, setLoadingAmbassadors] = useState(false);
  const [ambassadors, setAmbassadors] = useState<AmbassadorOption[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [notifyAmbassador, setNotifyAmbassador] = useState(true);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedId('');
      setReason('');
      setNotifyAmbassador(true);
      setNotifyCustomer(true);
      return;
    }

    let cancelled = false;
    setLoadingAmbassadors(true);
    adminApi
      .listAmbassadors()
      .then((rows) => {
        if (cancelled) return;
        const list = (rows as AmbassadorOption[]).filter(
          (a) => a.status === 'approved' || a.status === 'ACTIVE'
        );
        setAmbassadors(list);
      })
      .catch(() => {
        if (!cancelled) {
          toast({
            title: language === 'en' ? 'Error' : 'Erreur',
            description:
              language === 'en'
                ? 'Failed to load ambassadors'
                : 'Impossible de charger les ambassadeurs',
            variant: 'destructive',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAmbassadors(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, language, toast]);

  const filteredAmbassadors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ambassadors
      .filter((a) => a.id !== currentAmbassadorId)
      .filter((a) => {
        if (!q) return true;
        return (
          a.full_name?.toLowerCase().includes(q) ||
          a.city?.toLowerCase().includes(q) ||
          a.ville?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
  }, [ambassadors, currentAmbassadorId, search]);

  const selectedAmbassador = ambassadors.find((a) => a.id === selectedId);

  const locationWarning =
    selectedAmbassador &&
    customerCity &&
    selectedAmbassador.city &&
    String(selectedAmbassador.city).trim() !== String(customerCity).trim()
      ? language === 'en'
        ? 'Selected ambassador may not serve this city (server will validate).'
        : "L'ambassadeur sélectionné ne dessert peut-être pas cette ville (validation serveur)."
      : null;

  const handleSubmit = async () => {
    if (!selectedId) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description:
          language === 'en' ? 'Select a new ambassador' : 'Sélectionnez un nouvel ambassadeur',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await adminOrdersApi.reassignAmbassador(orderId, {
        newAmbassadorId: selectedId,
        reason: reason.trim() || undefined,
        notifyAmbassador,
        notifyCustomer,
      });

      const newName = result.ambassador?.full_name || selectedAmbassador?.full_name || '—';
      const amb = result.notifications?.ambassador;
      const cust = result.notifications?.customer;
      const anyNotify = notifyAmbassador || notifyCustomer;
      const allSkipped = !notifyAmbassador && !notifyCustomer;
      const ambassadorOk =
        !notifyAmbassador || (amb?.emailSent === true && amb?.smsSent === true);
      const customerOk =
        !notifyCustomer || (cust?.emailSent === true && cust?.smsSent === true);
      const partialNotify = anyNotify && !allSkipped && (!ambassadorOk || !customerOk);
      const fullSuccess = anyNotify && !allSkipped && ambassadorOk && customerOk;

      toast({
        title: language === 'en' ? 'Success' : 'Succès',
        description: allSkipped
          ? language === 'en'
            ? 'Order reassigned. Notifications were skipped.'
            : 'Commande réassignée. Notifications ignorées.'
          : partialNotify
            ? language === 'en'
              ? 'Order reassigned, but some notifications failed. Check Activity Logs.'
              : 'Commande réassignée, mais certaines notifications ont échoué. Voir Activity Logs.'
            : fullSuccess
              ? language === 'en'
                ? 'Order reassigned. New ambassador and customer were notified.'
                : 'Commande réassignée. Nouvel ambassadeur et client notifiés.'
              : language === 'en'
                ? `Order reassigned to ${newName}.`
                : `Commande réassignée à ${newName}.`,
      });

      await onSuccess({
        ambassador_id: result.order?.ambassador_id || selectedId,
        ambassador_name: newName,
        notifications: result.notifications,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Request failed';
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {language === 'en' ? 'Change ambassador' : "Changer d'ambassadeur"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{currentAmbassadorName || '—'}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {selectedAmbassador?.full_name ||
                  (language === 'en' ? 'Select below' : 'Sélectionner ci-dessous')}
              </span>
            </div>
            {(customerCity || customerVille) && (
              <p className="mt-2 text-xs text-muted-foreground">
                {language === 'en' ? 'Customer location' : 'Localisation client'}:{' '}
                {[customerCity, customerVille].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ambassador-search">
              {language === 'en' ? 'Search ambassadors' : 'Rechercher un ambassadeur'}
            </Label>
            <Input
              id="ambassador-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'en' ? 'Name, city…' : 'Nom, ville…'}
              disabled={loadingAmbassadors || submitting}
            />
          </div>

          <div className="max-h-48 overflow-y-auto rounded-md border border-border/70">
            {loadingAmbassadors ? (
              <div className="flex justify-center py-8">
                <Loader />
              </div>
            ) : filteredAmbassadors.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">
                {language === 'en' ? 'No eligible ambassadors found' : 'Aucun ambassadeur éligible'}
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {filteredAmbassadors.map((amb) => (
                  <li key={amb.id}>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 ${
                        selectedId === amb.id ? 'bg-primary/10' : ''
                      }`}
                      onClick={() => setSelectedId(amb.id)}
                      disabled={submitting}
                    >
                      <span className="font-medium">{amb.full_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[amb.city, amb.ville].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {locationWarning && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{locationWarning}</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="reassign-reason">
              {language === 'en' ? 'Reason (optional)' : 'Raison (optionnel)'}
            </Label>
            <Textarea
              id="reassign-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              disabled={submitting}
            />
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="notify-ambassador"
              checked={notifyAmbassador}
              onCheckedChange={(v) => setNotifyAmbassador(v === true)}
              disabled={submitting}
            />
            <Label htmlFor="notify-ambassador" className="text-sm font-normal leading-snug cursor-pointer">
              {language === 'en'
                ? 'Notify new ambassador by email and SMS'
                : 'Notifier le nouvel ambassadeur par email et SMS'}
            </Label>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="notify-customer"
              checked={notifyCustomer}
              onCheckedChange={(v) => setNotifyCustomer(v === true)}
              disabled={submitting}
            />
            <div className="space-y-1">
              <Label htmlFor="notify-customer" className="text-sm font-normal leading-snug cursor-pointer">
                {language === 'en'
                  ? 'Notify customer with updated ambassador contact'
                  : 'Notifier le client avec le nouveau contact ambassadeur'}
              </Label>
              <p className="text-xs text-muted-foreground">
                {language === 'en'
                  ? 'Resends the order confirmation email/SMS with the new ambassador contact details.'
                  : 'Renvoie la confirmation de commande par email/SMS avec les coordonnées du nouvel ambassadeur.'}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {language === 'en' ? 'Cancel' : 'Annuler'}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !selectedId}>
            {submitting ? <Loader className="h-4 w-4" /> : language === 'en' ? 'Confirm' : 'Confirmer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
