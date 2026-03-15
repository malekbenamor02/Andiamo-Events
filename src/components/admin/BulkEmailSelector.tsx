/**
 * BulkEmailSelector - same source/filter model as BulkSmsSelector for email campaigns.
 * Select sources (orders, newsletter, ambassadors, applications, aio), filters, preview (deduplicated), then compose subject + body and Start campaign.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Loader from '@/components/ui/Loader';
import { Mail, Send, RefreshCw, Filter, AlertCircle, Info } from 'lucide-react';
import { CITIES, SOUSSE_VILLES, TUNIS_VILLES } from '@/lib/constants';
import { API_ROUTES, buildFullApiUrl } from '@/lib/api-routes';
import { useToast } from '@/hooks/use-toast';
import type {
  EmailSourceSelection,
  EmailSourceFilters,
  EmailAddressWithMetadata,
  EmailAddressesPreviewResponse,
  EmailCountsResponse
} from '@/types/bulk-sms';
import { getEmailSourceDisplayName, hasSelectedEmailSource } from '@/lib/phone-numbers';

function parseEmailList(raw: string): string[] {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    const x = part.trim().toLowerCase();
    if (re.test(x) && !seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

const defaultEmailSourceFilters: EmailSourceFilters = {
  orders: { city: null, ville: null, status: [], payment_method: null, source: null },
  newsletter_subscribers: { city: null, dateFrom: null, dateTo: null },
  approved_ambassadors: { city: null, ville: null },
  ambassador_applications: { status: [], city: null, ville: null },
  aio_events_submissions: { city: null, ville: null, status: [], event_id: null }
};

interface BulkEmailSelectorProps {
  language: 'en' | 'fr';
  onCampaignCreated?: (campaignId: string, totalRecipients: number, firstBatchSent: number, remaining: number) => void;
  onCampaignProgress?: () => void;
}

export function BulkEmailSelector({ language, onCampaignCreated, onCampaignProgress }: BulkEmailSelectorProps) {
  const { toast } = useToast();

  const [selectedSources, setSelectedSources] = useState<EmailSourceSelection>({
    orders: false,
    newsletter_subscribers: false,
    approved_ambassadors: false,
    ambassador_applications: false,
    aio_events_submissions: false
  });

  const [sourceFilters, setSourceFilters] = useState<EmailSourceFilters>(defaultEmailSourceFilters);

  const [previewEmails, setPreviewEmails] = useState<EmailAddressWithMetadata[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<EmailAddressesPreviewResponse | null>(null);
  const [sourceCounts, setSourceCounts] = useState<EmailCountsResponse>({});

  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [batchSize, setBatchSize] = useState(300);
  const [delayBetweenEmailsMin, setDelayBetweenEmailsMin] = useState('0.5');
  const [delayBetweenBatchesMin, setDelayBetweenBatchesMin] = useState('2');
  const [startingCampaign, setStartingCampaign] = useState(false);
  const cancelAutoSendRef = useRef(false);
  const [recipientMode, setRecipientMode] = useState<'sources' | 'custom'>('sources');
  const [customRecipientsRaw, setCustomRecipientsRaw] = useState('');

  useEffect(() => {
    fetchEmailCounts();
  }, []);

  useEffect(() => {
    if (hasSelectedEmailSource(selectedSources)) {
      const t = setTimeout(() => fetchEmailPreview(), 500);
      return () => clearTimeout(t);
    } else {
      setPreviewEmails([]);
      setPreviewData(null);
    }
  }, [selectedSources, sourceFilters]);

  const fetchEmailCounts = async () => {
    try {
      const url = buildFullApiUrl(API_ROUTES.ADMIN_EMAIL_ADDRESSES_COUNTS);
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) setSourceCounts(data.data || {});
    } catch (e: unknown) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: (e as Error).message || (language === 'en' ? 'Failed to fetch email counts' : 'Échec des compteurs'),
        variant: 'destructive'
      });
    }
  };

  const fetchEmailPreview = async () => {
    if (!hasSelectedEmailSource(selectedSources)) return;
    setLoadingPreview(true);
    try {
      const sourcesConfig: Record<string, { enabled: boolean; filters: unknown }> = {};
      (Object.keys(selectedSources) as (keyof EmailSourceSelection)[]).forEach(key => {
        sourcesConfig[key] = { enabled: selectedSources[key], filters: sourceFilters[key] };
      });
      const url = buildFullApiUrl(API_ROUTES.ADMIN_EMAIL_ADDRESSES_SOURCES);
      const params = new URLSearchParams({ sources: JSON.stringify(sourcesConfig), includeMetadata: 'true' });
      const res = await fetch(`${url}?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && data.data) {
        setPreviewEmails(data.data.emailAddresses || []);
        setPreviewData({
          emailAddresses: data.data.emailAddresses || [],
          counts: data.data.counts || { total: 0, unique: 0, duplicates: 0, bySource: {} },
          duplicates: data.data.duplicates || []
        });
      } else {
        setPreviewEmails([]);
        setPreviewData(null);
      }
    } catch (e: unknown) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: (e as Error).message || (language === 'en' ? 'Failed to fetch emails' : 'Échec de la récupération des emails'),
        variant: 'destructive'
      });
      setPreviewEmails([]);
      setPreviewData(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleStartCampaign = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: language === 'en' ? 'Enter subject and body' : 'Saisissez sujet et corps',
        variant: 'destructive'
      });
      return;
    }
    if (recipientMode === 'sources') {
      if (!hasSelectedEmailSource(selectedSources)) {
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: language === 'en' ? 'Select at least one source' : 'Sélectionnez au moins une source',
          variant: 'destructive'
        });
        return;
      }
      if (previewEmails.length === 0) {
        toast({
          title: language === 'en' ? 'No recipients' : 'Aucun destinataire',
          description: language === 'en' ? 'No email addresses found with selected filters' : 'Aucune adresse avec les filtres sélectionnés',
          variant: 'destructive'
        });
        return;
      }
    } else {
      const customList = parseEmailList(customRecipientsRaw);
      if (customList.length === 0) {
        toast({
          title: language === 'en' ? 'No recipients' : 'Aucun destinataire',
          description: language === 'en' ? 'Paste at least one valid email' : 'Collez au moins une adresse valide',
          variant: 'destructive'
        });
        return;
      }
    }

    cancelAutoSendRef.current = false;
    setStartingCampaign(true);
    const delayEmailsMin = Math.max(0, parseFloat(String(delayBetweenEmailsMin).replace(',', '.')) || 0);
    const delayBatchesMin = Math.max(0, parseFloat(String(delayBetweenBatchesMin).replace(',', '.')) || 0);
    try {
      const createPayload =
        recipientMode === 'custom'
          ? {
              type: 'email' as const,
              subject: emailSubject.trim(),
              body: emailBody.trim(),
              batch_size: Math.min(batchSize, 300),
              period: 'day',
              recipients: parseEmailList(customRecipientsRaw),
              delay_minutes: delayEmailsMin,
              batch_delay_minutes: delayBatchesMin
            }
          : (() => {
              const sourcesConfig: Record<string, { enabled: boolean; filters: unknown }> = {};
              (Object.keys(selectedSources) as (keyof EmailSourceSelection)[]).forEach(key => {
                sourcesConfig[key] = { enabled: selectedSources[key], filters: sourceFilters[key] };
              });
              return {
                type: 'email' as const,
                subject: emailSubject.trim(),
                body: emailBody.trim(),
                batch_size: Math.min(batchSize, 300),
                period: 'day',
                sources: sourcesConfig,
                filters: sourceFilters,
                delay_minutes: delayEmailsMin,
                batch_delay_minutes: delayBatchesMin
              };
            })();

      const createRes = await fetch(buildFullApiUrl(API_ROUTES.MARKETING_CAMPAIGNS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(createPayload)
      });

      const createData = await createRes.json();
      if (!createData.success || !createData.data?.campaign_id) {
        throw new Error(createData.error || 'Failed to create campaign');
      }

      const campaignId = createData.data.campaign_id;
      const totalRecipients = createData.data.total_recipients || 0;
      let totalSent = 0;
      let remaining = totalRecipients;

      for (;;) {
        if (cancelAutoSendRef.current) {
          toast({
            title: language === 'en' ? 'Stopped' : 'Arrêté',
            description: language === 'en' ? 'Auto-send cancelled after the last batch.' : 'Envoi auto annulé après le dernier lot.',
            variant: 'default'
          });
          break;
        }
        const batchRes = await fetch(buildFullApiUrl(API_ROUTES.MARKETING_CAMPAIGN_SEND_BATCH(campaignId)), {
          method: 'POST',
          credentials: 'include'
        });
        const batchData = await batchRes.json();
        onCampaignProgress?.();

        if (batchRes.status === 429) {
          toast({
            title: language === 'en' ? 'Daily limit reached' : 'Limite quotidienne atteinte',
            description: batchData.error || (language === 'en' ? '300 emails/day max. Resume from Campaign results tomorrow.' : '300 emails/jour max. Reprenez depuis Résultats demain.'),
            variant: 'default'
          });
          break;
        }
        if (!batchData.success) {
          throw new Error(batchData.error || 'Failed to send this group');
        }
        const sent = batchData.data?.sent ?? 0;
        totalSent += sent;
        remaining = batchData.data?.remaining ?? 0;
        if (remaining <= 0) {
          toast({
            title: language === 'en' ? 'Campaign complete' : 'Campagne terminée',
            description: language === 'en'
              ? `Sent: ${totalSent}. Failed counted in results.`
              : `Envoyés : ${totalSent}. Voir les échecs dans les résultats.`,
            variant: 'default'
          });
          break;
        }
        await new Promise((r) => setTimeout(r, delayBatchesMin * 60 * 1000));
      }

      onCampaignCreated?.(campaignId, totalRecipients, totalSent, remaining);
      setEmailSubject('');
      setEmailBody('');
      if (recipientMode === 'custom') setCustomRecipientsRaw('');
    } catch (e: unknown) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: (e as Error).message || (language === 'en' ? 'Failed to start campaign' : 'Échec du démarrage de la campagne'),
        variant: 'destructive'
      });
    } finally {
      setStartingCampaign(false);
    }
  };

  const handleSourceToggle = (source: keyof EmailSourceSelection) => {
    setSelectedSources(prev => ({ ...prev, [source]: !prev[source] }));
  };

  const handleFilterChange = (source: keyof EmailSourceFilters, filterKey: string, value: unknown) => {
    setSourceFilters(prev => ({
      ...prev,
      [source]: { ...prev[source], [filterKey]: value }
    }));
  };

  const getVillesForCity = (city: string | null): string[] => {
    if (!city) return [];
    if (city === 'Sousse') return SOUSSE_VILLES as unknown as string[];
    if (city === 'Tunis') return TUNIS_VILLES as unknown as string[];
    return [];
  };

  const t = language === 'en'
    ? {
        title: 'Bulk Email Selection',
        description: 'Recipients from your sources or a custom pasted list — same campaign flow for both.',
        tabSources: 'From sources',
        tabCustom: 'Custom list',
        customPlaceholder: 'One email per line or comma-separated',
        customCount: 'Valid emails',
        selectSources: 'Select Sources',
        filters: 'Filters',
        preview: 'Preview',
        subject: 'Subject',
        body: 'Body',
        batchSize: 'Max emails per send (then pause)',
delayEmails: 'Pause between each email (min)',
    delayBatches: 'Pause before next group (min)',
        cancelAuto: 'Stop auto-send',
        startCampaign: 'Start campaign (auto-send all)',
        starting: 'Sending…',
        noSources: 'No sources selected',
        noEmails: 'No email addresses found',
        total: 'Total',
        unique: 'Unique',
        duplicates: 'Duplicates',
        refresh: 'Refresh'
      }
    : {
        title: 'Sélection Email en Masse',
        description: 'Destinataires depuis les sources ou liste collée — même logique de campagne.',
        tabSources: 'Depuis les sources',
        tabCustom: 'Liste personnalisée',
        customPlaceholder: 'Une adresse par ligne ou séparées par des virgules',
        customCount: 'Emails valides',
        selectSources: 'Sélectionner les sources',
        filters: 'Filtres',
        preview: 'Aperçu',
        subject: 'Sujet',
        body: 'Corps',
        batchSize: 'Max emails par envoi (puis pause)',
        delayEmails: 'Pause entre chaque email (min)',
        delayBatches: 'Pause avant le prochain groupe (min)',
        cancelAuto: 'Arrêter l\'envoi auto',
        startCampaign: 'Démarrer (envoi auto complet)',
        starting: 'Envoi…',
        noSources: 'Aucune source sélectionnée',
        noEmails: 'Aucune adresse email trouvée',
        total: 'Total',
        unique: 'Uniques',
        duplicates: 'Doublons',
        refresh: 'Actualiser'
      };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            {t.title}
          </CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={recipientMode} onValueChange={(v) => setRecipientMode(v as 'sources' | 'custom')}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="sources">{t.tabSources}</TabsTrigger>
              <TabsTrigger value="custom">{t.tabCustom}</TabsTrigger>
            </TabsList>
            <TabsContent value="custom" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>{t.tabCustom}</Label>
                <Textarea
                  value={customRecipientsRaw}
                  onChange={(e) => setCustomRecipientsRaw(e.target.value)}
                  placeholder={t.customPlaceholder}
                  className="min-h-[120px] font-mono text-sm"
                />
                <p className="text-sm text-muted-foreground">
                  {t.customCount}: {parseEmailList(customRecipientsRaw).length}
                </p>
              </div>
            </TabsContent>
            <TabsContent value="sources" className="space-y-6 mt-4">
          <div className="space-y-4">
            <Label className="text-base font-semibold">{t.selectSources}</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(selectedSources) as (keyof EmailSourceSelection)[]).map(sourceKey => {
                const count = sourceKey === 'newsletter_subscribers'
                  ? (sourceCounts.newsletter_subscribers?.withEmail ?? 0)
                  : (sourceCounts[sourceKey] as { withEmail?: number } | undefined)?.withEmail ?? 0;
                return (
                  <div key={sourceKey} className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <Checkbox
                      id={sourceKey}
                      checked={selectedSources[sourceKey]}
                      onCheckedChange={() => handleSourceToggle(sourceKey)}
                    />
                    <div className="flex-1">
                      <Label htmlFor={sourceKey} className="font-medium cursor-pointer">
                        {getEmailSourceDisplayName(sourceKey, language)}
                      </Label>
                      <p className="text-sm text-muted-foreground">{count} {language === 'en' ? 'emails' : 'emails'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {hasSelectedEmailSource(selectedSources) && (
            <>
              <div className="space-y-4">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  {t.filters}
                </Label>
                {selectedSources.orders && (
                  <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                    <Label className="text-sm font-medium">{getEmailSourceDisplayName('orders', language)}</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">{language === 'en' ? 'City' : 'Ville'}</Label>
                        <Select
                          value={sourceFilters.orders.city || 'all'}
                          onValueChange={v => {
                            handleFilterChange('orders', 'city', v === 'all' ? null : v);
                            handleFilterChange('orders', 'ville', null);
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{language === 'en' ? 'All Cities' : 'Toutes les Villes'}</SelectItem>
                            {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {sourceFilters.orders.city && (
                        <div className="space-y-2">
                          <Label className="text-xs">{language === 'en' ? 'Ville (Neighborhood)' : 'Quartier'}</Label>
                          <Select
                            value={sourceFilters.orders.ville || 'all'}
                            onValueChange={v => handleFilterChange('orders', 'ville', v === 'all' ? null : v)}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{language === 'en' ? 'All' : 'Tous'}</SelectItem>
                              {getVillesForCity(sourceFilters.orders.city).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {selectedSources.ambassador_applications && (
                  <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                    <Label className="text-sm font-medium">{getEmailSourceDisplayName('ambassador_applications', language)}</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">{language === 'en' ? 'Status' : 'Statut'}</Label>
                        <Select
                          value={sourceFilters.ambassador_applications.status?.join(',') || 'all'}
                          onValueChange={v => handleFilterChange('ambassador_applications', 'status', v === 'all' ? [] : v.split(','))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{language === 'en' ? 'All Statuses' : 'Tous'}</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="removed">Removed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{language === 'en' ? 'City' : 'Ville'}</Label>
                        <Select
                          value={sourceFilters.ambassador_applications.city || 'all'}
                          onValueChange={v => {
                            handleFilterChange('ambassador_applications', 'city', v === 'all' ? null : v);
                            handleFilterChange('ambassador_applications', 'ville', null);
                          }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{language === 'en' ? 'All Cities' : 'Toutes les Villes'}</SelectItem>
                            {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {sourceFilters.ambassador_applications.city && (
                        <div className="space-y-2">
                          <Label className="text-xs">{language === 'en' ? 'Ville (Neighborhood)' : 'Quartier'}</Label>
                          <Select
                            value={sourceFilters.ambassador_applications.ville || 'all'}
                            onValueChange={v => handleFilterChange('ambassador_applications', 'ville', v === 'all' ? null : v)}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{language === 'en' ? 'All' : 'Tous'}</SelectItem>
                              {getVillesForCity(sourceFilters.ambassador_applications.city).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {selectedSources.approved_ambassadors && (
                  <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                    <Label className="text-sm font-medium">{getEmailSourceDisplayName('approved_ambassadors', language)}</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">{language === 'en' ? 'City' : 'Ville'}</Label>
                        <Select
                          value={sourceFilters.approved_ambassadors.city || 'all'}
                          onValueChange={v => { handleFilterChange('approved_ambassadors', 'city', v === 'all' ? null : v); handleFilterChange('approved_ambassadors', 'ville', null); }}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{language === 'en' ? 'All Cities' : 'Toutes les Villes'}</SelectItem>
                            {CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {sourceFilters.approved_ambassadors.city && (
                        <div className="space-y-2">
                          <Label className="text-xs">{language === 'en' ? 'Ville (Neighborhood)' : 'Quartier'}</Label>
                          <Select
                            value={sourceFilters.approved_ambassadors.ville || 'all'}
                            onValueChange={v => handleFilterChange('approved_ambassadors', 'ville', v === 'all' ? null : v)}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{language === 'en' ? 'All' : 'Tous'}</SelectItem>
                              {getVillesForCity(sourceFilters.approved_ambassadors.city).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {hasSelectedEmailSource(selectedSources) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t.preview}</Label>
                <Button variant="outline" size="sm" onClick={fetchEmailPreview} disabled={loadingPreview}>
                  {loadingPreview ? <Loader size="sm" className="mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  {t.refresh}
                </Button>
              </div>
              {loadingPreview ? (
                <div className="flex justify-center py-8"><Loader size="md" /></div>
              ) : previewData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <p className="text-sm text-muted-foreground">{t.total}</p>
                      <p className="text-2xl font-bold">{previewData.counts.total || 0}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <p className="text-sm text-muted-foreground">{t.unique}</p>
                      <p className="text-2xl font-bold text-primary">{previewData.counts.unique || 0}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border">
                      <p className="text-sm text-muted-foreground">{t.duplicates}</p>
                      <p className="text-2xl font-bold text-orange-500">{previewData.counts.duplicates || 0}</p>
                    </div>
                  </div>
                  {previewData.counts.duplicates > 0 && (
                    <Alert>
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>
                        {language === 'en'
                          ? `${previewData.counts.duplicates} duplicate emails will be removed automatically`
                          : `${previewData.counts.duplicates} emails en double seront supprimés automatiquement`}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>{t.noEmails}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
            </TabsContent>
          </Tabs>

          <Separator />

          <div className="space-y-4">
            <Label className="text-base font-semibold">{t.subject}</Label>
            <Input
              value={emailSubject}
              onChange={e => setEmailSubject(e.target.value)}
              placeholder={language === 'en' ? 'Email subject' : 'Sujet de l\'email'}
            />
            <Label className="text-base font-semibold">{t.body}</Label>
            <Textarea
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
              placeholder={language === 'en' ? 'Email body (plain text or HTML)' : 'Corps de l\'email'}
              className="min-h-[150px]"
            />
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">{t.batchSize}</Label>
                <Input
                  type="number"
                  min={1}
                  max={300}
                  value={batchSize}
                  onChange={e => setBatchSize(Math.min(300, Math.max(1, parseInt(e.target.value, 10) || 300)))}
                  className="w-24"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">{t.delayEmails}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.5"
                  value={delayBetweenEmailsMin}
                  onChange={e => setDelayBetweenEmailsMin(e.target.value.replace(/[^\d.,]/g, ''))}
                  className="w-24"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">{t.delayBatches}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="2"
                  value={delayBetweenBatchesMin}
                  onChange={e => setDelayBetweenBatchesMin(e.target.value.replace(/[^\d.,]/g, ''))}
                  className="w-28"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
            onClick={handleStartCampaign}
            disabled={
              startingCampaign ||
              !emailSubject.trim() ||
              !emailBody.trim() ||
              (recipientMode === 'sources' && (!hasSelectedEmailSource(selectedSources) || previewEmails.length === 0)) ||
              (recipientMode === 'custom' && parseEmailList(customRecipientsRaw).length === 0)
            }
              className="flex-1"
              size="lg"
            >
              {startingCampaign ? (
                <><Loader size="sm" className="mr-2" />{t.starting}</>
              ) : (
                <><Send className="w-5 h-5 mr-2" />{t.startCampaign} ({recipientMode === 'custom' ? parseEmailList(customRecipientsRaw).length : previewEmails.length} {language === 'en' ? 'recipients' : 'destinataires'})</>
              )}
            </Button>
            {startingCampaign && (
              <Button type="button" variant="outline" onClick={() => { cancelAutoSendRef.current = true; }}>
                {t.cancelAuto}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
