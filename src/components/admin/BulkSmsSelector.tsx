/**
 * BulkSmsSelector Component
 * Allows admin to select phone numbers from multiple sources, apply filters, and send bulk SMS
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import Loader from '@/components/ui/Loader';
import { 
  Phone, Send, RefreshCw, Users, Filter, CheckCircle2, XCircle, 
  AlertCircle, Info, Download, Upload, FileText
} from 'lucide-react';
import { CITIES, SOUSSE_VILLES, TUNIS_VILLES } from '@/lib/constants';
import { API_ROUTES, buildFullApiUrl } from '@/lib/api-routes';
import { useToast } from '@/hooks/use-toast';
import type { 
  SourceSelection, 
  SourceFilters, 
  PhoneNumberWithMetadata,
  PhoneNumbersPreviewResponse,
  SourceCountsResponse
} from '@/types/bulk-sms';
import { 
  normalizePhoneNumber, 
  deduplicatePhoneNumbers, 
  getSourceDisplayName,
  hasSelectedSource
} from '@/lib/phone-numbers';
import { BulkSmsResults } from './BulkSmsResults';

function parsePhoneCampaignList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,;]+/)) {
    let c = part.trim().replace(/\D/g, '');
    if (c.startsWith('00216')) c = c.substring(5);
    else if (c.startsWith('216')) c = c.substring(3);
    c = c.replace(/^0+/, '');
    if (c.length === 8 && /^[2594]/.test(c) && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

interface BulkSmsSelectorProps {
  language: 'en' | 'fr';
  onSendComplete?: () => void;
  onCampaignProgress?: () => void;
}

export function BulkSmsSelector({ language, onSendComplete, onCampaignProgress }: BulkSmsSelectorProps) {
  const { toast } = useToast();
  
  // Source selection state
  const [selectedSources, setSelectedSources] = useState<SourceSelection>({
    ambassador_applications: false,
    orders: false,
    aio_events_submissions: false,
    approved_ambassadors: false,
    phone_subscribers: false
  });

  // Filters state
  const [sourceFilters, setSourceFilters] = useState<SourceFilters>({
    ambassador_applications: { status: [], city: null, ville: null },
    orders: { city: null, ville: null, status: [], payment_method: null, source: null },
    aio_events_submissions: { city: null, ville: null, status: [], event_id: null },
    approved_ambassadors: { city: null, ville: null },
    phone_subscribers: { city: null, dateFrom: null, dateTo: null }
  });

  // Preview state
  const [previewPhoneNumbers, setPreviewPhoneNumbers] = useState<PhoneNumberWithMetadata[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PhoneNumbersPreviewResponse | null>(null);
  const [sourceCounts, setSourceCounts] = useState<SourceCountsResponse>({});

  // Message state
  const [bulkSmsMessage, setBulkSmsMessage] = useState('');
  const [sendingBulkSms, setSendingBulkSms] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });

  // Results state
  const [bulkSmsResults, setBulkSmsResults] = useState<any>(null);

  // Campaign state (batched sending over time)
  const [batchSize, setBatchSize] = useState(100);
  const [delayBetweenSmsMin, setDelayBetweenSmsMin] = useState('0.5');
  const [delayBetweenBatchesMin, setDelayBetweenBatchesMin] = useState('2');
  const [startingCampaign, setStartingCampaign] = useState(false);
  const cancelAutoSendRef = useRef(false);
  const [recipientMode, setRecipientMode] = useState<'sources' | 'custom'>('sources');
  const [customPhonesRaw, setCustomPhonesRaw] = useState('');

  // Load source counts on mount
  useEffect(() => {
    fetchSourceCounts();
  }, []);

  // Auto-select phone_subscribers if it has data
  useEffect(() => {
    if (sourceCounts.phone_subscribers?.withPhone > 0 && !selectedSources.phone_subscribers) {
      console.log('Auto-selecting phone_subscribers with count:', sourceCounts.phone_subscribers.withPhone);
      setSelectedSources(prev => ({
        ...prev,
        phone_subscribers: true
      }));
    }
  }, [sourceCounts]);

  // Fetch preview when sources or filters change
  useEffect(() => {
    if (hasSelectedSource(selectedSources)) {
      const debounceTimer = setTimeout(() => {
        fetchPhoneNumbersPreview();
      }, 500);
      return () => clearTimeout(debounceTimer);
    } else {
      setPreviewPhoneNumbers([]);
      setPreviewData(null);
    }
  }, [selectedSources, sourceFilters]);

  const fetchSourceCounts = async () => {
    try {
      const url = buildFullApiUrl(API_ROUTES.ADMIN_PHONE_NUMBERS_COUNTS);
      const response = await fetch(url, {
        credentials: 'include' // Important for admin auth cookies
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 100)}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSourceCounts(data.data || {});
      } else {
        console.error('API returned error:', data.error);
      }
    } catch (error: any) {
      console.error('Error fetching source counts:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to fetch source counts' : 'Échec de la récupération des compteurs'),
        variant: 'destructive'
      });
    }
  };

  const fetchPhoneNumbersPreview = async () => {
    if (!hasSelectedSource(selectedSources)) return;

    setLoadingPreview(true);
    try {
      const sourcesConfig: any = {};
      Object.keys(selectedSources).forEach(key => {
        const sourceKey = key as keyof SourceSelection;
        sourcesConfig[sourceKey] = {
          enabled: selectedSources[sourceKey],
          filters: sourceFilters[sourceKey]
        };
      });

      const url = buildFullApiUrl(API_ROUTES.ADMIN_PHONE_NUMBERS_SOURCES);
      const params = new URLSearchParams({
        sources: JSON.stringify(sourcesConfig),
        includeMetadata: 'true'
      });

      const response = await fetch(`${url}?${params}`, {
        credentials: 'include' // Important for admin auth cookies
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 100)}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        // Ensure counts are properly set even if empty
        const previewData = {
          phoneNumbers: data.data.phoneNumbers || [],
          counts: {
            total: data.data.counts?.total ?? (data.data.phoneNumbers?.length || 0),
            unique: data.data.counts?.unique ?? (data.data.phoneNumbers?.length || 0),
            duplicates: data.data.counts?.duplicates ?? 0,
            bySource: data.data.counts?.bySource || {}
          },
          duplicates: data.data.duplicates || []
        };
        
        // Log for debugging if counts are 0 but we have phone numbers
        if (previewData.phoneNumbers.length > 0 && previewData.counts.total === 0) {
          console.warn('Preview data mismatch: phoneNumbers exist but counts are 0', {
            phoneNumbersCount: previewData.phoneNumbers.length,
            counts: previewData.counts,
            rawData: data.data
          });
          // Fix the counts if they're wrong
          previewData.counts.total = previewData.phoneNumbers.length;
          previewData.counts.unique = previewData.phoneNumbers.length;
        }
        
        setPreviewPhoneNumbers(previewData.phoneNumbers);
        setPreviewData(previewData);
      } else {
        // Set empty preview data on error
        setPreviewPhoneNumbers([]);
        setPreviewData({
          phoneNumbers: [],
          counts: { total: 0, unique: 0, duplicates: 0, bySource: {} },
          duplicates: []
        });
        
        console.error('Failed to fetch phone numbers preview:', data);
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: data.error || (language === 'en' ? 'Failed to fetch phone numbers' : 'Échec de la récupération des numéros'),
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('Error fetching phone numbers:', error);
      const errorMessage = error.message || (language === 'en' ? 'Failed to fetch phone numbers' : 'Échec de la récupération des numéros');
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSendBulkSms = async () => {
    if (!hasSelectedSource(selectedSources)) {
      toast({
        title: language === 'en' ? 'No Sources Selected' : 'Aucune Source Sélectionnée',
        description: language === 'en' ? 'Please select at least one source' : 'Veuillez sélectionner au moins une source',
        variant: 'destructive'
      });
      return;
    }

    if (!bulkSmsMessage.trim()) {
      toast({
        title: language === 'en' ? 'Message Required' : 'Message Requis',
        description: language === 'en' ? 'Please enter a message to send' : 'Veuillez entrer un message à envoyer',
        variant: 'destructive'
      });
      return;
    }

    if (previewPhoneNumbers.length === 0) {
      toast({
        title: language === 'en' ? 'No Phone Numbers' : 'Aucun Numéro',
        description: language === 'en' ? 'No phone numbers found with selected filters' : 'Aucun numéro trouvé avec les filtres sélectionnés',
        variant: 'destructive'
      });
      return;
    }

    setSendingBulkSms(true);
    setSendProgress({ current: 0, total: previewPhoneNumbers.length });

    try {
      const phoneNumbersToSend = previewPhoneNumbers.map(num => ({
        phone: num.phone,
        source: num.source,
        sourceId: num.sourceId
      }));

      const sourcesConfig: any = {};
      Object.keys(selectedSources).forEach(key => {
        const sourceKey = key as keyof SourceSelection;
        sourcesConfig[sourceKey] = {
          enabled: selectedSources[sourceKey],
          filters: sourceFilters[sourceKey]
        };
      });

      const url = buildFullApiUrl(API_ROUTES.ADMIN_BULK_SMS_SEND);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Important for admin auth cookies
        body: JSON.stringify({
          phoneNumbers: phoneNumbersToSend,
          message: bulkSmsMessage.trim(),
          sources: sourcesConfig,
          filters: sourceFilters,
          metadata: {
            campaignName: `Bulk SMS - ${new Date().toISOString()}`
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 100)}`);
      }

      const data = await response.json();

      if (data.success) {
        setBulkSmsResults(data.data);
        toast({
          title: language === 'en' ? 'SMS Sent' : 'SMS Envoyé',
          description: language === 'en' 
            ? `Sent: ${data.data.sent}, Failed: ${data.data.failed}`
            : `Envoyé: ${data.data.sent}, Échoué: ${data.data.failed}`,
          variant: 'default'
        });
        if (onSendComplete) onSendComplete();
      } else {
        toast({
          title: language === 'en' ? 'Error' : 'Erreur',
          description: data.error || (language === 'en' ? 'Failed to send SMS' : 'Échec de l\'envoi SMS'),
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('Error sending bulk SMS:', error);
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to send SMS' : 'Échec de l\'envoi SMS'),
        variant: 'destructive'
      });
    } finally {
      setSendingBulkSms(false);
      setSendProgress({ current: 0, total: 0 });
    }
  };

  const handleStartCampaign = async () => {
    if (!bulkSmsMessage.trim()) {
      toast({
        title: language === 'en' ? 'Message required' : 'Message requis',
        description: language === 'en' ? 'Enter the SMS body' : 'Saisissez le message SMS',
        variant: 'destructive'
      });
      return;
    }
    if (recipientMode === 'sources') {
      if (!hasSelectedSource(selectedSources) || previewPhoneNumbers.length === 0) {
        toast({
          title: language === 'en' ? 'No Sources / numbers' : 'Aucune source / numéros',
          description: language === 'en' ? 'Select sources and ensure preview has numbers' : 'Sélectionnez des sources et vérifiez l\'aperçu',
          variant: 'destructive'
        });
        return;
      }
    } else if (parsePhoneCampaignList(customPhonesRaw).length === 0) {
      toast({
        title: language === 'en' ? 'No valid numbers' : 'Aucun numéro valide',
        description: language === 'en' ? 'Paste 8-digit TN numbers (2/4/5/9…)' : 'Collez des numéros TN 8 chiffres',
        variant: 'destructive'
      });
      return;
    }
    cancelAutoSendRef.current = false;
    setStartingCampaign(true);
    const delaySmsMinutes = Math.max(0, parseFloat(String(delayBetweenSmsMin).replace(',', '.')) || 0.5);
    const delayBatchesMs = Math.max(0, Math.round((parseFloat(String(delayBetweenBatchesMin).replace(',', '.')) || 0) * 60 * 1000));
    try {
      const createPayload =
        recipientMode === 'custom'
          ? {
              type: 'sms' as const,
              body: bulkSmsMessage.trim(),
              batch_size: batchSize,
              period: 'day',
              recipients: parsePhoneCampaignList(customPhonesRaw),
              delay_minutes: delaySmsMinutes,
              batch_delay_ms: delayBatchesMs
            }
          : (() => {
              const sourcesConfig: Record<string, { enabled: boolean; filters: unknown }> = {};
              (Object.keys(selectedSources) as (keyof SourceSelection)[]).forEach(key => {
                sourcesConfig[key] = { enabled: selectedSources[key], filters: sourceFilters[key] };
              });
              return {
                type: 'sms' as const,
                body: bulkSmsMessage.trim(),
                batch_size: batchSize,
                period: 'day',
                sources: sourcesConfig,
                filters: sourceFilters,
                delay_minutes: delaySmsMinutes,
                batch_delay_ms: delayBatchesMs
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

      for (;;) {
        if (cancelAutoSendRef.current) {
          toast({
            title: language === 'en' ? 'Stopped' : 'Arrêté',
            description: language === 'en' ? 'Auto-send cancelled.' : 'Envoi auto annulé.',
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
        if (!batchData.success) {
          throw new Error(batchData.error || 'Failed to send this group');
        }
        const remaining = batchData.data?.remaining ?? 0;
        if (remaining <= 0) {
          toast({
            title: language === 'en' ? 'Campaign complete' : 'Campagne terminée',
            description: language === 'en' ? 'All SMS batches sent.' : 'Tous les lots SMS ont été envoyés.',
            variant: 'default'
          });
          break;
        }
        await new Promise((r) => setTimeout(r, delayBatchesMs));
      }
      if (onSendComplete) onSendComplete();
      if (recipientMode === 'custom') setCustomPhonesRaw('');
    } catch (error: any) {
      toast({
        title: language === 'en' ? 'Error' : 'Erreur',
        description: error.message || (language === 'en' ? 'Failed to start campaign' : 'Échec du démarrage'),
        variant: 'destructive'
      });
    } finally {
      setStartingCampaign(false);
    }
  };

  const handleSourceToggle = (source: keyof SourceSelection) => {
    setSelectedSources(prev => ({
      ...prev,
      [source]: !prev[source]
    }));
  };

  const handleFilterChange = (source: keyof SourceFilters, filterKey: string, value: any) => {
    setSourceFilters(prev => ({
      ...prev,
      [source]: {
        ...prev[source],
        [filterKey]: value
      }
    }));
  };

  // Get villes based on selected city
  const getVillesForCity = (city: string | null): string[] => {
    if (!city) return [];
    if (city === 'Sousse') return SOUSSE_VILLES as any;
    if (city === 'Tunis') return TUNIS_VILLES as any;
    return [];
  };

  const t = {
    en: {
      title: 'Bulk SMS Selection',
      description: 'Select phone number sources, apply filters, and send bulk SMS',
      selectSources: 'Select Sources',
      filters: 'Filters',
      preview: 'Preview',
      message: 'Message',
      send: 'Send SMS',
      sending: 'Sending...',
      noSources: 'No sources selected',
      noNumbers: 'No phone numbers found',
      total: 'Total',
      unique: 'Unique',
      duplicates: 'Duplicates',
      characters: 'Characters',
      messages: 'Approx. messages',
      refresh: 'Refresh',
      export: 'Export',
      import: 'Import',
      batchSize: 'Max SMS per send (then pause)',
      startCampaign: 'Start campaign',
      starting: 'Starting...',
      campaignProgress: 'Campaign in progress',
      sentTotal: 'Sent',
      remaining: 'Remaining',
      tabSources: 'From sources',
      tabCustom: 'Custom list',
      customPlaceholder: 'One number per line (8 digits, e.g. 21234567)',
      customCount: 'Valid numbers',
      delaySms: 'Pause between each SMS (min)',
      delayBatches: 'Pause before next group (min)',
      cancelAuto: 'Stop auto-send'
    },
    fr: {
      title: 'Sélection SMS en Masse',
      description: 'Sélectionnez les sources de numéros, appliquez des filtres et envoyez des SMS en masse',
      selectSources: 'Sélectionner les Sources',
      filters: 'Filtres',
      preview: 'Aperçu',
      message: 'Message',
      send: 'Envoyer SMS',
      sending: 'Envoi...',
      noSources: 'Aucune source sélectionnée',
      noNumbers: 'Aucun numéro trouvé',
      total: 'Total',
      unique: 'Uniques',
      duplicates: 'Doublons',
      characters: 'Caractères',
      messages: 'Messages approx.',
      refresh: 'Actualiser',
      export: 'Exporter',
      import: 'Importer',
      batchSize: 'Taille du lot (par période)',
      startCampaign: 'Démarrer la campagne',
      starting: 'Démarrage...',
      campaignProgress: 'Campagne en cours',
      sentTotal: 'Envoyé',
      remaining: 'Restant',
      tabSources: 'Depuis les sources',
      tabCustom: 'Liste personnalisée',
      customPlaceholder: 'Un numéro par ligne (8 chiffres)',
      customCount: 'Numéros valides',
      delaySms: 'Pause entre chaque SMS (min)',
      delayBatches: 'Pause avant le prochain groupe (min)',
      cancelAuto: 'Arrêter l\'envoi auto'
    }
  }[language];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-primary" />
            {t.title}
          </CardTitle>
          <CardDescription>
            {language === 'en'
              ? 'Same campaign: sources or paste a list. Messages are sent in groups with pauses.'
              : 'Même campagne : sources ou liste collée. Les messages partent par groupes avec des pauses.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={recipientMode} onValueChange={(v) => setRecipientMode(v as 'sources' | 'custom')}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="sources">{t.tabSources}</TabsTrigger>
              <TabsTrigger value="custom">{t.tabCustom}</TabsTrigger>
            </TabsList>
            <TabsContent value="custom" className="space-y-4 mt-4">
              <Label>{t.tabCustom}</Label>
              <Textarea
                value={customPhonesRaw}
                onChange={(e) => setCustomPhonesRaw(e.target.value)}
                placeholder={t.customPlaceholder}
                className="min-h-[120px] font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground">
                {t.customCount}: {parsePhoneCampaignList(customPhonesRaw).length}
              </p>
            </TabsContent>
            <TabsContent value="sources" className="space-y-6 mt-4">
          {/* Source Selection */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">{t.selectSources}</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.keys(selectedSources).map(sourceKey => {
                const source = sourceKey as keyof SourceSelection;
                const count = sourceCounts[source]?.withPhone || 0;
                const isSelected = selectedSources[source];
                
                return (
                  <div key={source} className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <Checkbox
                      id={source}
                      checked={isSelected}
                      onCheckedChange={() => handleSourceToggle(source)}
                    />
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={source} className="font-medium cursor-pointer">
                        {getSourceDisplayName(source, language)}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {count} {language === 'en' ? 'numbers' : 'numéros'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Filters Section */}
          {hasSelectedSource(selectedSources) && (
            <div className="space-y-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Filter className="w-4 h-4" />
                {t.filters}
              </Label>
              
              {/* Ambassador Applications Filters */}
              {selectedSources.ambassador_applications && (
                <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                  <Label className="text-sm font-medium">
                    {getSourceDisplayName('ambassador_applications', language)}
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">{language === 'en' ? 'Status' : 'Statut'}</Label>
                      <Select
                        value={sourceFilters.ambassador_applications.status?.join(',') || 'all'}
                        onValueChange={(value) => {
                          const statuses = value === 'all' ? [] : value.split(',');
                          handleFilterChange('ambassador_applications', 'status', statuses);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{language === 'en' ? 'All Statuses' : 'Tous les Statuts'}</SelectItem>
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
                        onValueChange={(value) => {
                          handleFilterChange('ambassador_applications', 'city', value === 'all' ? null : value);
                          handleFilterChange('ambassador_applications', 'ville', null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{language === 'en' ? 'All Cities' : 'Toutes les Villes'}</SelectItem>
                          {CITIES.map(city => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {sourceFilters.ambassador_applications.city && (
                      <div className="space-y-2">
                        <Label className="text-xs">{language === 'en' ? 'Ville (Neighborhood)' : 'Quartier'}</Label>
                        <Select
                          value={sourceFilters.ambassador_applications.ville || 'all'}
                          onValueChange={(value) => {
                            handleFilterChange('ambassador_applications', 'ville', value === 'all' ? null : value);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{language === 'en' ? 'All' : 'Tous'}</SelectItem>
                            {getVillesForCity(sourceFilters.ambassador_applications.city).map(ville => (
                              <SelectItem key={ville} value={ville}>{ville}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Orders Filters */}
              {selectedSources.orders && (
                <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-3">
                  <Label className="text-sm font-medium">
                    {getSourceDisplayName('orders', language)}
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">{language === 'en' ? 'City' : 'Ville'} *</Label>
                      <Select
                        value={sourceFilters.orders.city || 'all'}
                        onValueChange={(value) => {
                          handleFilterChange('orders', 'city', value === 'all' ? null : value);
                          handleFilterChange('orders', 'ville', null);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{language === 'en' ? 'All Cities' : 'Toutes les Villes'}</SelectItem>
                          {CITIES.map(city => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {sourceFilters.orders.city && (
                      <div className="space-y-2">
                        <Label className="text-xs">{language === 'en' ? 'Ville (Neighborhood)' : 'Quartier'}</Label>
                        <Select
                          value={sourceFilters.orders.ville || 'all'}
                          onValueChange={(value) => {
                            handleFilterChange('orders', 'ville', value === 'all' ? null : value);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">{language === 'en' ? 'All' : 'Tous'}</SelectItem>
                            {getVillesForCity(sourceFilters.orders.city).map(ville => (
                              <SelectItem key={ville} value={ville}>{ville}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Other sources filters can be added similarly */}
            </div>
          )}

          <Separator />

          {/* Preview Section */}
          {hasSelectedSource(selectedSources) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t.preview}</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchPhoneNumbersPreview}
                  disabled={loadingPreview}
                >
                  {loadingPreview ? <Loader size="sm" className="mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  {t.refresh}
                </Button>
              </div>

              {loadingPreview ? (
                <div className="flex items-center justify-center py-8">
                  <Loader size="md" />
                </div>
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
                          ? `${previewData.counts.duplicates} duplicate phone numbers will be removed automatically`
                          : `${previewData.counts.duplicates} numéros en double seront supprimés automatiquement`}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>{t.noNumbers}</AlertDescription>
                </Alert>
              )}
            </div>
          )}
            </TabsContent>
          </Tabs>

          <Separator />

          {/* Message Composition */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">{t.message}</Label>
            <Textarea
              value={bulkSmsMessage}
              onChange={(e) => setBulkSmsMessage(e.target.value)}
              placeholder={language === 'en' ? 'Enter your SMS message...' : 'Entrez votre message SMS...'}
              className="min-h-[150px]"
            />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{t.characters}: {bulkSmsMessage.length}</span>
              <span>{t.messages}: {Math.ceil(bulkSmsMessage.length / 160)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">{t.batchSize}</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={batchSize}
                  onChange={(e) => setBatchSize(Math.min(500, Math.max(1, parseInt(e.target.value, 10) || 100)))}
                  className="w-24"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">{t.delaySms}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.5"
                  value={delayBetweenSmsMin}
                  onChange={(e) => setDelayBetweenSmsMin(e.target.value.replace(/[^\d.,]/g, ''))}
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
                  onChange={(e) => setDelayBetweenBatchesMin(e.target.value.replace(/[^\d.,]/g, ''))}
                  className="w-28"
                />
              </div>
            </div>
          </div>

          {/* Send SMS (one-shot) and Start campaign */}
          <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
            <Button
              onClick={handleSendBulkSms}
              disabled={
                recipientMode === 'custom' ||
                sendingBulkSms ||
                startingCampaign ||
                !hasSelectedSource(selectedSources) ||
                !bulkSmsMessage.trim() ||
                previewPhoneNumbers.length === 0
              }
              className="flex-1"
              size="lg"
            >
              {sendingBulkSms ? (
                <><Loader size="sm" className="mr-2" />{t.sending}</>
              ) : (
                <><Send className="w-5 h-5 mr-2" />{t.send} ({previewPhoneNumbers.length} {language === 'en' ? 'numbers' : 'numéros'})</>
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={handleStartCampaign}
              disabled={
                startingCampaign ||
                sendingBulkSms ||
                !bulkSmsMessage.trim() ||
                (recipientMode === 'sources' && (!hasSelectedSource(selectedSources) || previewPhoneNumbers.length === 0)) ||
                (recipientMode === 'custom' && parsePhoneCampaignList(customPhonesRaw).length === 0)
              }
              className="flex-1"
              size="lg"
            >
              {startingCampaign ? (
                <><Loader size="sm" className="mr-2" />{t.starting}</>
              ) : (
                <><Send className="w-5 h-5 mr-2" />{t.startCampaign} ({recipientMode === 'custom' ? parsePhoneCampaignList(customPhonesRaw).length : previewPhoneNumbers.length} · auto)</>
              )}
            </Button>
            {startingCampaign && (
              <Button type="button" variant="outline" onClick={() => { cancelAutoSendRef.current = true; }}>
                {t.cancelAuto}
              </Button>
            )}
          </div>

          {sendingBulkSms && sendProgress.total > 0 && (
            <div className="space-y-2">
              <Progress value={(sendProgress.current / sendProgress.total) * 100} />
              <p className="text-sm text-center text-muted-foreground">
                {sendProgress.current} / {sendProgress.total}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {bulkSmsResults && (
        <BulkSmsResults
          results={bulkSmsResults}
          language={language}
        />
      )}
    </div>
  );
}
