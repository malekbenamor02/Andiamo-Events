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
import { Mail, Send, RefreshCw, Filter, AlertCircle, Info, ImagePlus, X } from 'lucide-react';
import { uploadImage } from '@/lib/upload';
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
import { supabase } from '@/integrations/supabase/client';

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

type CampaignEventOption = { id: string; name: string; date: string | null };

const defaultEmailSourceFilters: EmailSourceFilters = {
  orders: { city: null, ville: null, status: [], payment_method: null, source: null, event_id: null },
  newsletter_subscribers: { dateFrom: null, dateTo: null, importLabel: null },
  approved_ambassadors: { city: null, ville: null },
  ambassador_applications: { status: [], city: null, ville: null },
  aio_events_submissions: { city: null, ville: null, status: [], event_id: null },
  investors: {}
};

interface BulkEmailSelectorProps {
  language: 'en' | 'fr';
  onCampaignCreated?: (campaignId: string, totalRecipients: number, firstBatchSent: number, remaining: number) => void;
  onCampaignProgress?: () => void;
  /** When set, only audience + daily cap; POST /launch for this draft (cron sends). */
  launchOnlyCampaignId?: string | null;
  onLaunchComplete?: () => void;
}

export function BulkEmailSelector({
  language,
  onCampaignCreated,
  onCampaignProgress,
  launchOnlyCampaignId = null,
  onLaunchComplete
}: BulkEmailSelectorProps) {
  const { toast } = useToast();

  const [selectedSources, setSelectedSources] = useState<EmailSourceSelection>({
    orders: false,
    newsletter_subscribers: false,
    approved_ambassadors: false,
    ambassador_applications: false,
    aio_events_submissions: false,
    investors: false
  });

  const [sourceFilters, setSourceFilters] = useState<EmailSourceFilters>(defaultEmailSourceFilters);

  const [previewEmails, setPreviewEmails] = useState<EmailAddressWithMetadata[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<EmailAddressesPreviewResponse | null>(null);
  const [sourceCounts, setSourceCounts] = useState<EmailCountsResponse>({});

  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [batchSize, setBatchSize] = useState(25);
  const [emailsPerDay, setEmailsPerDay] = useState(3500);
  const [delayBetweenEmailsMin, setDelayBetweenEmailsMin] = useState('0');
  const [ctaUrl, setCtaUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [delayBetweenBatchesMin, setDelayBetweenBatchesMin] = useState('2');
  const [startingCampaign, setStartingCampaign] = useState(false);
  const [recipientMode, setRecipientMode] = useState<'sources' | 'custom'>('sources');
  const [customRecipientsRaw, setCustomRecipientsRaw] = useState('');
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [uploadingHeaderImage, setUploadingHeaderImage] = useState(false);
  const [campaignEvents, setCampaignEvents] = useState<CampaignEventOption[]>([]);
  const previewRequestIdRef = useRef(0);

  useEffect(() => {
    fetchEmailCounts();
    const loadEvents = async () => {
      try {
        const showTest =
          typeof window !== 'undefined' &&
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        const { data, error } = await supabase
          .from('events')
          .select('id, name, date, is_test')
          .order('date', { ascending: false })
          .limit(200);
        if (error) throw error;
        const rows = (data || []).filter((e) => showTest || e.is_test !== true);
        setCampaignEvents(
          rows.map((e) => ({
            id: e.id,
            name: e.name,
            date: e.date,
          }))
        );
      } catch (e) {
        console.error('Failed to load events for email filters:', e);
      }
    };
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedSources.newsletter_subscribers) {
      fetchEmailCounts();
    }
  }, [selectedSources.newsletter_subscribers]);

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
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
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
    const requestId = ++previewRequestIdRef.current;
    setLoadingPreview(true);
    setPreviewData(null);
    setPreviewEmails([]);
    try {
      const sourcesConfig: Record<string, { enabled: boolean; filters: unknown }> = {};
      (Object.keys(selectedSources) as (keyof EmailSourceSelection)[]).forEach(key => {
        sourcesConfig[key] = { enabled: selectedSources[key], filters: sourceFilters[key] };
      });
      const url = buildFullApiUrl(API_ROUTES.ADMIN_EMAIL_ADDRESSES_SOURCES);
      const params = new URLSearchParams({
        sources: JSON.stringify(sourcesConfig),
        includeMetadata: 'true',
        _t: String(Date.now()),
      });
      const res = await fetch(`${url}?${params}`, { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (requestId !== previewRequestIdRef.current) return;
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
      if (requestId !== previewRequestIdRef.current) return;
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: (e as Error).message || (language === 'en' ? 'Failed to fetch emails' : 'Échec de la récupération des emails'),
        variant: 'destructive'
      });
      setPreviewEmails([]);
      setPreviewData(null);
    } finally {
      if (requestId === previewRequestIdRef.current) {
        setLoadingPreview(false);
      }
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

    if (recipientMode === 'sources' && !loadingPreview && (previewData?.counts?.unique ?? 0) < 1) {
      toast({
        title: language === 'en' ? 'Refresh preview first' : 'Actualisez l\'aperçu',
        description:
          language === 'en'
            ? 'Load the recipient preview with your filters before scheduling sends.'
            : 'Chargez l\'aperçu des destinataires avec vos filtres avant de planifier l\'envoi.',
        variant: 'destructive'
      });
      return;
    }

    setStartingCampaign(true);
    const delayEmailsMin = Math.max(0, parseFloat(String(delayBetweenEmailsMin).replace(',', '.')) || 0);
    const delayBatchesMin = Math.max(0, parseFloat(String(delayBetweenBatchesMin).replace(',', '.')) || 0);
    const dailyCap = Math.min(10000, Math.max(1, emailsPerDay || 3500));
    const batchSz = Math.min(10000, Math.max(1, batchSize || 25));
    try {
      const imagePayload =
        headerImageUrl.trim() !== '' ? { header_image_url: headerImageUrl.trim() } : {};
      const ctaPayload =
        ctaUrl.trim() !== ''
          ? {
              cta_url: ctaUrl.trim(),
              cta_label: (ctaLabel.trim() || (language === 'en' ? 'Book now' : 'Réserver')).slice(0, 120)
            }
          : {};
      const emailExtras = {
        ...imagePayload,
        ...ctaPayload,
        daily_email_cap: dailyCap
      };

      const expectedUnique =
        recipientMode === 'custom'
          ? parseEmailList(customRecipientsRaw).length
          : previewData?.counts?.unique ?? previewEmails.length;

      const createPayload =
        recipientMode === 'custom'
          ? {
              type: 'email' as const,
              subject: emailSubject.trim(),
              body: emailBody.trim(),
              batch_size: batchSz,
              period: 'day',
              recipients: parseEmailList(customRecipientsRaw),
              delay_minutes: delayEmailsMin,
              batch_delay_minutes: delayBatchesMin,
              expected_unique_count: expectedUnique,
              ...emailExtras
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
                batch_size: batchSz,
                period: 'day',
                sources: sourcesConfig,
                filters: sourceFilters,
                delay_minutes: delayEmailsMin,
                batch_delay_minutes: delayBatchesMin,
                expected_unique_count: expectedUnique,
                ...emailExtras
              };
            })();

      const createRes = await fetch(buildFullApiUrl(API_ROUTES.MARKETING_CAMPAIGNS), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(createPayload)
      });

      const createData = await createRes.json();
      if (!createRes.ok && createData.data?.actual_unique_count != null) {
        throw new Error(
          createData.error ||
            `Recipient count mismatch (preview ${createData.data.expected_unique_count}, server ${createData.data.actual_unique_count}). Refresh preview.`
        );
      }
      if (!createData.success || !createData.data?.campaign_id) {
        throw new Error(createData.error || 'Failed to create campaign');
      }

      const campaignId = createData.data.campaign_id;
      const totalRecipients = createData.data.total_recipients || 0;

      toast({
        title: language === 'en' ? 'Campaign started successfully' : 'Campagne démarrée avec succès',
        variant: 'default'
      });

      onCampaignCreated?.(campaignId, totalRecipients, 0, totalRecipients);
      setEmailSubject('');
      setEmailBody('');
      setHeaderImageUrl('');
      setCtaUrl('');
      setCtaLabel('');
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

  const handleLaunchDraft = async () => {
    if (!launchOnlyCampaignId) return;
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
    setStartingCampaign(true);
    const delayEmailsMin = Math.max(0, parseFloat(String(delayBetweenEmailsMin).replace(',', '.')) || 0);
    const delayBatchesMin = Math.max(0, parseFloat(String(delayBetweenBatchesMin).replace(',', '.')) || 0);
    const dailyCap = Math.min(10000, Math.max(1, emailsPerDay || 3500));
    const batchSz = Math.min(10000, Math.max(1, batchSize || 25));
    const pacingFields = {
      batch_size: batchSz,
      delay_minutes: delayEmailsMin,
      batch_delay_minutes: delayBatchesMin,
    };
    const expectedUnique =
      recipientMode === 'custom'
        ? parseEmailList(customRecipientsRaw).length
        : previewData?.counts?.unique ?? previewEmails.length;
    try {
      const payload =
        recipientMode === 'custom'
          ? {
              recipients: parseEmailList(customRecipientsRaw),
              daily_email_cap: dailyCap,
              expected_unique_count: expectedUnique,
              ...pacingFields,
            }
          : (() => {
              const sourcesConfig: Record<string, { enabled: boolean; filters: unknown }> = {};
              (Object.keys(selectedSources) as (keyof EmailSourceSelection)[]).forEach((key) => {
                sourcesConfig[key] = { enabled: selectedSources[key], filters: sourceFilters[key] };
              });
              return {
                sources: sourcesConfig,
                filters: sourceFilters,
                daily_email_cap: dailyCap,
                expected_unique_count: expectedUnique,
                ...pacingFields,
              };
            })();
      const res = await fetch(buildFullApiUrl(API_ROUTES.MARKETING_CAMPAIGN_LAUNCH(launchOnlyCampaignId)), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok && data.data?.actual_unique_count != null) {
        throw new Error(
          data.error ||
            `Recipient count mismatch (preview ${data.data.expected_unique_count}, server ${data.data.actual_unique_count}). Refresh preview.`
        );
      }
      if (!data.success) {
        throw new Error(data.error || 'Launch failed');
      }
      toast({
        title: language === 'en' ? 'Campaign started successfully' : 'Campagne démarrée avec succès',
      });
      onLaunchComplete?.();
    } catch (e: unknown) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: (e as Error).message,
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

  const formatEventOptionLabel = (event: CampaignEventOption): string => {
    if (!event.date) return event.name;
    const d = new Date(event.date);
    const dateStr = Number.isNaN(d.getTime())
      ? event.date
      : d.toLocaleDateString(language === 'en' ? 'en-GB' : 'fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
    return `${event.name} (${dateStr})`;
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
        batchSize: 'Max emails per HTTP batch',
        emailsPerDay: 'Max emails per day (this campaign, UTC)',
        emailsPerDayHint:
          'Set ≥ your list size (e.g. 3500 for 3000 sends). Stops until next UTC day after this many sends. Requires cron every 2 min — see env.example.',
        delayEmails: 'Pause between each email (minutes)',
        delayEmailsHint: 'Use 0 for fast sends (~3000 in 4h with batch 25 and cron every 2 min).',
        delayBatches: 'Pause between cron batches (minutes)',
        batchSizeHint: 'Emails per cron tick (25 × cron every 2 min ≈ 3000 in 4 hours).',
        ctaUrl: 'Book now link (optional)',
        ctaLabel: 'Button label',
        ctaHint: 'https://… — button appears under your message text.',
        startCampaign: 'Schedule campaign (server sends all)',
        starting: 'Scheduling…',
        noSources: 'No sources selected',
        noEmails: 'No email addresses found',
        total: 'Total',
        unique: 'Unique',
        duplicates: 'Duplicates',
        refresh: 'Refresh',
        campaignImage: 'Image in email (optional)',
        campaignImageHint: 'Shown above your message. JPG, PNG, or WebP — max ~5 MB.',
        removeCampaignImage: 'Remove',
        uploadingImage: 'Uploading…',
        launchTitle: 'Launch saved campaign',
        launchDescription: 'Choose recipients and max emails per day (UTC). Sending runs via scheduled cron.',
        launchButton: 'Schedule sends'
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
        batchSize: 'Max emails par requête',
        emailsPerDay: 'Max emails par jour (cette campagne, UTC)',
        emailsPerDayHint:
          'Mettez ≥ la taille de la liste (ex. 3500 pour 3000). Reprend le jour UTC suivant. Cron toutes les 2 min — voir env.example.',
        delayEmails: 'Pause entre chaque email (minutes)',
        delayEmailsHint: '0 pour envoi rapide (~3000 en 4 h avec lot 25 et cron /2 min).',
        delayBatches: 'Pause entre lots cron (minutes)',
        batchSizeHint: 'Emails par tick cron (25 × cron /2 min ≈ 3000 en 4 h).',
        ctaUrl: 'Lien « Réserver » (optionnel)',
        ctaLabel: 'Texte du bouton',
        ctaHint: 'https://… — le bouton s\'affiche sous le corps du message.',
        startCampaign: 'Planifier (envoi serveur)',
        starting: 'Planification…',
        noSources: 'Aucune source sélectionnée',
        noEmails: 'Aucune adresse email trouvée',
        total: 'Total',
        unique: 'Uniques',
        duplicates: 'Doublons',
        refresh: 'Actualiser',
        campaignImage: 'Image dans l\'email (optionnel)',
        campaignImageHint: 'Affichée au-dessus du texte. JPG, PNG ou WebP — env. 5 Mo max.',
        removeCampaignImage: 'Retirer',
        uploadingImage: 'Téléversement…',
        launchTitle: 'Lancer la campagne enregistrée',
        launchDescription: 'Destinataires et max emails/jour (UTC). L’envoi se fait via le cron planifié.',
        launchButton: 'Planifier les envois'
      };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            {launchOnlyCampaignId ? t.launchTitle : t.title}
          </CardTitle>
          <CardDescription>{launchOnlyCampaignId ? t.launchDescription : t.description}</CardDescription>
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
                const count =
                  sourceKey === 'newsletter_subscribers'
                    ? (sourceCounts.newsletter_subscribers?.withEmail ?? 0)
                    : sourceKey === 'investors'
                      ? (sourceCounts.investors?.withEmail ?? 0)
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
                      <div className="space-y-2 md:col-span-3">
                        <Label className="text-xs">{language === 'en' ? 'Event name' : 'Nom de l\'événement'}</Label>
                        <Select
                          value={sourceFilters.orders.event_id || 'all'}
                          onValueChange={v =>
                            handleFilterChange('orders', 'event_id', v === 'all' ? null : v)
                          }
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">
                              {language === 'en' ? 'All events' : 'Tous les événements'}
                            </SelectItem>
                            {campaignEvents.map(event => (
                              <SelectItem key={event.id} value={event.id}>
                                {formatEventOptionLabel(event)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
                {selectedSources.newsletter_subscribers && (
                  <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                    <Label className="text-sm font-medium">{getEmailSourceDisplayName('newsletter_subscribers', language)}</Label>
                    <div className="space-y-2">
                      <Label className="text-xs">{language === 'en' ? 'Label name' : 'Nom du libellé'}</Label>
                      <Select
                        value={sourceFilters.newsletter_subscribers.importLabel || '__all__'}
                        onValueChange={v =>
                          handleFilterChange(
                            'newsletter_subscribers',
                            'importLabel',
                            v === '__all__' ? null : v
                          )
                        }
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">
                            {language === 'en' ? 'All subscribers' : 'Tous les abonnés'}
                          </SelectItem>
                          <SelectItem value="__website__">
                            {language === 'en' ? 'Website signups' : 'Inscriptions site web'}
                          </SelectItem>
                          {(sourceCounts.newsletter_subscribers?.importLabels ?? []).map(label => (
                            <SelectItem key={label} value={label}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

          {!launchOnlyCampaignId && (
            <>
          <Separator />

          <div className="space-y-4">
            <Label className="text-base font-semibold">{t.subject}</Label>
            <Input
              value={emailSubject}
              onChange={e => setEmailSubject(e.target.value)}
              placeholder={language === 'en' ? 'Email subject' : 'Sujet de l\'email'}
            />
            <div className="space-y-2">
              <Label className="text-base font-semibold flex items-center gap-2">
                <ImagePlus className="w-4 h-4" />
                {t.campaignImage}
              </Label>
              <p className="text-sm text-muted-foreground">{t.campaignImageHint}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={uploadingHeaderImage}
                  className="max-w-xs cursor-pointer"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      toast({
                        title: language === 'en' ? 'File too large' : 'Fichier trop volumineux',
                        description: language === 'en' ? 'Use an image under 5 MB.' : 'Utilisez une image de moins de 5 Mo.',
                        variant: 'destructive'
                      });
                      return;
                    }
                    setUploadingHeaderImage(true);
                    const result = await uploadImage(file, 'campaign-email');
                    setUploadingHeaderImage(false);
                    if (result.error || !result.url) {
                      toast({
                        title: language === 'en' ? 'Upload failed' : 'Échec du téléversement',
                        description: result.error || (language === 'en' ? 'Could not upload image.' : 'Impossible de téléverser l\'image.'),
                        variant: 'destructive'
                      });
                      return;
                    }
                    setHeaderImageUrl(result.url);
                  }}
                />
                {headerImageUrl ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setHeaderImageUrl('')}>
                    <X className="w-4 h-4 mr-1" />
                    {t.removeCampaignImage}
                  </Button>
                ) : null}
                {uploadingHeaderImage ? (
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader size="sm" />
                    {t.uploadingImage}
                  </span>
                ) : null}
              </div>
              {headerImageUrl ? (
                <div className="rounded-lg border border-border overflow-hidden bg-muted/30 max-w-md">
                  <img src={headerImageUrl} alt="" className="w-full max-h-48 object-contain" />
                </div>
              ) : null}
            </div>
            <Label className="text-base font-semibold">{t.body}</Label>
            <Textarea
              value={emailBody}
              onChange={e => setEmailBody(e.target.value)}
              placeholder={language === 'en' ? 'Email body (plain text or HTML)' : 'Corps de l\'email'}
              className="min-h-[150px]"
            />
            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
              <Label className="text-base font-semibold">{t.ctaUrl}</Label>
              <p className="text-sm text-muted-foreground">{t.ctaHint}</p>
              <Input
                type="url"
                value={ctaUrl}
                onChange={e => setCtaUrl(e.target.value)}
                placeholder="https://www.andiamoevents.com/..."
                className="font-mono text-sm"
              />
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">{t.ctaLabel}</Label>
                <Input
                  value={ctaLabel}
                  onChange={e => setCtaLabel(e.target.value)}
                  placeholder={language === 'en' ? 'Book now' : 'Réserver'}
                  disabled={!ctaUrl.trim()}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">{t.emailsPerDay}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    value={emailsPerDay}
                    onChange={e => setEmailsPerDay(Math.min(10000, Math.max(1, parseInt(e.target.value, 10) || 3500)))}
                    className="w-24"
                  />
                </div>
                <p className="text-xs text-muted-foreground max-w-xs">{t.emailsPerDayHint}</p>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">{t.batchSize}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    value={batchSize}
                    onChange={e => setBatchSize(Math.min(10000, Math.max(1, parseInt(e.target.value, 10) || 25)))}
                    className="w-24"
                  />
                </div>
                <p className="text-xs text-muted-foreground max-w-xs">{t.batchSizeHint}</p>
              </div>
              <div className="flex flex-col gap-1">
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
                <p className="text-xs text-muted-foreground max-w-[14rem]">{t.delayEmailsHint}</p>
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
          </div>
            </>
          )}

          {launchOnlyCampaignId && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex flex-col gap-1 max-w-sm">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground whitespace-nowrap">{t.emailsPerDay}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10000}
                        value={emailsPerDay}
                        onChange={(e) =>
                          setEmailsPerDay(Math.min(10000, Math.max(1, parseInt(e.target.value, 10) || 3500)))
                        }
                        className="w-24"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{t.emailsPerDayHint}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground whitespace-nowrap">{t.batchSize}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10000}
                        value={batchSize}
                        onChange={(e) =>
                          setBatchSize(Math.min(10000, Math.max(1, parseInt(e.target.value, 10) || 25)))
                        }
                        className="w-24"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground max-w-xs">{t.batchSizeHint}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground whitespace-nowrap">{t.delayEmails}</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0"
                        value={delayBetweenEmailsMin}
                        onChange={(e) => setDelayBetweenEmailsMin(e.target.value.replace(/[^\d.,]/g, ''))}
                        className="w-24"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground max-w-[14rem]">{t.delayEmailsHint}</p>
                  </div>
                </div>
                <Button
                  onClick={handleLaunchDraft}
                  disabled={
                    startingCampaign ||
                    (recipientMode === 'sources' &&
                      (!hasSelectedEmailSource(selectedSources) || previewEmails.length === 0)) ||
                    (recipientMode === 'custom' && parseEmailList(customRecipientsRaw).length === 0)
                  }
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  {startingCampaign ? (
                    <>
                      <Loader size="sm" className="mr-2" />
                      …
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      {t.launchButton}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
