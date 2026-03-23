import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { API_ROUTES, buildFullApiUrl } from '@/lib/api-routes';
import Loader from '@/components/ui/Loader';

type CampaignRecipientRow = {
  id: string;
  recipient_value: string;
  recipient_type: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
};

export interface EmailCampaignStatsProps {
  language: 'en' | 'fr';
  campaignId: string;
  onClose?: () => void;
}

export function EmailCampaignStats({ language, campaignId, onClose }: EmailCampaignStatsProps) {
  const [sent, setSent] = useState(0);
  const [failed, setFailed] = useState(0);
  const [pending, setPending] = useState(0);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [recipients, setRecipients] = useState<CampaignRecipientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  const fetchCounts = useCallback(async () => {
    try {
      const url = buildFullApiUrl(`${API_ROUTES.MARKETING_CAMPAIGN(campaignId)}?include_recipients=1`);
      if (!url) return;
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (!data.success || !data.data) return;
      const c = data.data;
      setStatus(c.status || '');
      setSent(c.counts?.sent ?? 0);
      setFailed(c.counts?.failed ?? 0);
      setPending(c.counts?.pending ?? 0);
      setTotal(c.counts?.total ?? 0);
      setRecipients(Array.isArray(c.recipients) ? c.recipients : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useEffect(() => {
    const channel = supabase
      .channel(`marketing-recipients-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'marketing_campaign_recipients',
          filter: `campaign_id=eq.${campaignId}`
        },
        () => {
          setLive(true);
          fetchCounts();
        }
      )
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') setLive(true);
      });

    const ch2 = supabase
      .channel(`marketing-campaign-${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'marketing_campaigns',
          filter: `id=eq.${campaignId}`
        },
        () => fetchCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(ch2);
    };
  }, [campaignId, fetchCounts]);

  const t =
    language === 'en'
      ? {
          title: 'Campaign stats',
          ok: 'Sent',
          fail: 'Failed',
          pend: 'Pending',
          tot: 'Total',
          st: 'Status',
          live: 'Live updates',
          poll: 'Polling',
          close: 'Close',
          recipients: 'Recipients',
          recColAddr: 'Address',
          recColSt: 'Status',
          recColErr: 'Error',
          recHint:
            '“Sent” means the mail server accepted the message. Check spam, Promotions, and your provider (e.g. Brevo) logs if it never arrived.'
        }
      : {
          title: 'Statistiques',
          ok: 'Envoyés',
          fail: 'Échecs',
          pend: 'En attente',
          tot: 'Total',
          st: 'Statut',
          live: 'Mises à jour temps réel',
          poll: 'Actualisation',
          close: 'Fermer',
          recipients: 'Destinataires',
          recColAddr: 'Adresse',
          recColSt: 'Statut',
          recColErr: 'Erreur',
          recHint:
            '« Envoyé » signifie que le serveur mail a accepté le message. Vérifiez spam, onglet Promotions et les journaux de votre fournisseur (ex. Brevo) si rien n’arrive.'
        };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader size="md" />
      </div>
    );
  }

  return (
    <Card className="border-muted">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">{t.title}</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{live ? t.live : t.poll}</span>
          {onClose ? (
            <button type="button" className="text-xs underline text-primary" onClick={onClose}>
              {t.close}
            </button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-2">
          {t.st}: <strong className="text-foreground">{status}</strong>
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="rounded-lg bg-green-500/10 p-3">
            <p className="text-xs text-muted-foreground">{t.ok}</p>
            <p className="text-2xl font-bold text-green-600">{sent}</p>
          </div>
          <div className="rounded-lg bg-destructive/10 p-3">
            <p className="text-xs text-muted-foreground">{t.fail}</p>
            <p className="text-2xl font-bold text-destructive">{failed}</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs text-muted-foreground">{t.pend}</p>
            <p className="text-2xl font-bold">{pending}</p>
          </div>
          <div className="rounded-lg bg-primary/5 p-3">
            <p className="text-xs text-muted-foreground">{t.tot}</p>
            <p className="text-2xl font-bold text-primary">{total}</p>
          </div>
        </div>
        {recipients.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">{t.recipients}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{t.recHint}</p>
            <div className="max-h-48 overflow-auto rounded-md border border-border text-left text-xs">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="p-2 font-medium text-left">{t.recColAddr}</th>
                    <th className="p-2 font-medium text-left">{t.recColSt}</th>
                    <th className="p-2 font-medium text-left">{t.recColErr}</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="p-2 break-all font-mono">{r.recipient_value}</td>
                      <td className="p-2 whitespace-nowrap">{r.status}</td>
                      <td className="p-2 break-words text-destructive">{r.error_message || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
