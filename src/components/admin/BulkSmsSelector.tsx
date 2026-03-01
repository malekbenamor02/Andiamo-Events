/**
 * BulkSmsSelector Component
 * Allows admin to select phone numbers from multiple sources, apply filters, and send bulk SMS
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
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
import { PhoneNumberPreview } from './PhoneNumberPreview';
import { BulkSmsResults } from './BulkSmsResults';

interface BulkSmsSelectorProps {
  language: 'en' | 'fr';
  onSendComplete?: () => void;
}

export function BulkSmsSelector({ language, onSendComplete }: BulkSmsSelectorProps) {
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
      import: 'Import'
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
      import: 'Importer'
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
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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

                  <PhoneNumberPreview
                    phoneNumbers={previewPhoneNumbers}
                    language={language}
                  />
                </div>
              ) : (
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>{t.noNumbers}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

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
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSendBulkSms}
            disabled={sendingBulkSms || !hasSelectedSource(selectedSources) || !bulkSmsMessage.trim() || previewPhoneNumbers.length === 0}
            className="w-full"
            size="lg"
          >
            {sendingBulkSms ? (
              <>
                <Loader size="sm" className="mr-2" />
                {t.sending}
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                {t.send} ({previewPhoneNumbers.length} {language === 'en' ? 'numbers' : 'numéros'})
              </>
            )}
          </Button>

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
