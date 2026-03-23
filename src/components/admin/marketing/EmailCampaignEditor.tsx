import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { API_ROUTES, buildFullApiUrl } from '@/lib/api-routes';
import { useToast } from '@/hooks/use-toast';
import { uploadImage } from '@/lib/upload';
import Loader from '@/components/ui/Loader';
import { ImagePlus, X, Save, Plus } from 'lucide-react';
import { EmailCampaignPreview } from './EmailCampaignPreview';

export interface EmailCampaignEditorProps {
  language: 'en' | 'fr';
  campaignId: string | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}

export function EmailCampaignEditor({ language, campaignId, onClose, onSaved }: EmailCampaignEditorProps) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [headerImageUrl, setHeaderImageUrl] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localId, setLocalId] = useState<string | null>(campaignId);

  const t =
    language === 'en'
      ? {
          title: 'Email campaign',
          newTitle: 'New email campaign',
          editTitle: 'Edit email campaign',
          internalName: 'Internal name (optional)',
          internalNameHint: 'Shown in admin lists only — helps find this draft in Launch.',
          subject: 'Subject',
          body: 'Message body',
          poster: 'Poster image',
          posterHint: 'Optional — JPG, PNG, WebP (max 5 MB)',
          ctaLink: 'Button link',
          ctaLabel: 'Button label',
          save: 'Save',
          create: 'Create draft',
          preview: 'Preview',
          loading: 'Loading…',
          saved: 'Saved',
          error: 'Error'
        }
      : {
          title: 'Campagne email',
          newTitle: 'Nouvelle campagne email',
          editTitle: 'Modifier la campagne',
          internalName: 'Nom interne (optionnel)',
          internalNameHint: 'Visible seulement dans l’admin — repère le brouillon dans Lancer.',
          subject: 'Sujet',
          body: 'Corps du message',
          poster: 'Image affiche',
          posterHint: 'Optionnel — JPG, PNG, WebP (max 5 Mo)',
          ctaLink: 'Lien du bouton',
          ctaLabel: 'Texte du bouton',
          save: 'Enregistrer',
          create: 'Créer brouillon',
          preview: 'Aperçu',
          loading: 'Chargement…',
          saved: 'Enregistré',
          error: 'Erreur'
        };

  useEffect(() => {
    setLocalId(campaignId);
  }, [campaignId]);

  useEffect(() => {
    if (!localId) {
      setName('');
      setSubject('');
      setBody('');
      setHeaderImageUrl('');
      setCtaUrl('');
      setCtaLabel('');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(buildFullApiUrl(API_ROUTES.MARKETING_CAMPAIGN(localId)), { credentials: 'include' });
        const data = await res.json();
        if (!data.success || !data.data) throw new Error(data.error || 'Load failed');
        const c = data.data;
        if (!cancelled) {
          setName(c.name || '');
          setSubject(c.subject || '');
          setBody(c.body ?? '');
          setHeaderImageUrl(c.header_image_url || '');
          setCtaUrl(c.cta_url || '');
          setCtaLabel(c.cta_label || '');
        }
      } catch (e: unknown) {
        if (!cancelled) {
          toast({
            title: language === 'en' ? 'Error' : 'Erreur',
            description: (e as Error).message,
            variant: 'destructive'
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [localId, toast, language]);

  function applyCampaignFromServer(c: Record<string, unknown>) {
    setName(typeof c.name === 'string' ? c.name : '');
    setSubject(typeof c.subject === 'string' ? c.subject : '');
    setBody(typeof c.body === 'string' ? c.body : '');
    setHeaderImageUrl(typeof c.header_image_url === 'string' ? c.header_image_url : '');
    setCtaUrl(typeof c.cta_url === 'string' ? c.cta_url : '');
    setCtaLabel(typeof c.cta_label === 'string' ? c.cta_label : '');
  }

  const handleCreateDraft = async () => {
    setSaving(true);
    try {
      const res = await fetch(buildFullApiUrl(API_ROUTES.MARKETING_CAMPAIGNS), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          mode: 'draft',
          name: name.trim() ? name.trim().slice(0, 500) : null,
          subject: (subject.trim() || 'Untitled').slice(0, 500),
          body,
          header_image_url: headerImageUrl.trim() ? headerImageUrl.trim() : null,
          cta_url: ctaUrl.trim() ? ctaUrl.trim() : null,
          cta_label: ctaUrl.trim() ? (ctaLabel.trim() || null) : null
        })
      });
      const data = await res.json();
      if (!data.success || !data.data?.campaign_id) throw new Error(data.error || 'Create failed');
      setLocalId(data.data.campaign_id);
      if (data.data.campaign && typeof data.data.campaign === 'object') {
        applyCampaignFromServer(data.data.campaign as Record<string, unknown>);
      }
      onSaved(data.data.campaign_id);
      toast({ title: t.saved, description: language === 'en' ? 'Draft created.' : 'Brouillon créé.' });
    } catch (e: unknown) {
      toast({
        title: t.error,
        description: (e as Error).message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!localId) {
      await handleCreateDraft();
      return;
    }
    if (!subject.trim()) {
      toast({
        title: t.error,
        description: language === 'en' ? 'Subject is required.' : 'Le sujet est requis.',
        variant: 'destructive'
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(buildFullApiUrl(API_ROUTES.MARKETING_CAMPAIGN(localId)), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() ? name.trim().slice(0, 500) : null,
          subject: subject.trim(),
          body,
          header_image_url: headerImageUrl.trim() ? headerImageUrl.trim() : null,
          cta_url: ctaUrl.trim() ? ctaUrl.trim() : null,
          cta_label: ctaUrl.trim() ? (ctaLabel.trim() || null) : null
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      if (data.data?.campaign && typeof data.data.campaign === 'object') {
        applyCampaignFromServer(data.data.campaign as Record<string, unknown>);
      }
      toast({ title: t.saved });
      onSaved(localId);
    } catch (e: unknown) {
      toast({
        title: t.error,
        description: (e as Error).message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>{localId ? t.editTitle : t.newTitle}</CardTitle>
          <CardDescription>
            {language === 'en'
              ? 'Save your template, then use Launch to add recipients and schedule sends.'
              : 'Enregistrez le modèle, puis utilisez Lancer pour les destinataires et l’envoi.'}
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {language === 'en' ? 'Close' : 'Fermer'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t.internalName}</Label>
                <p className="text-xs text-muted-foreground">{t.internalNameHint}</p>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="…" />
              </div>
              <div className="space-y-2">
                <Label>{t.subject}</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="…" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <ImagePlus className="w-4 h-4" />
                  {t.poster}
                </Label>
                <p className="text-xs text-muted-foreground">{t.posterHint}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={uploading}
                    className="max-w-xs"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        toast({
                          title: t.error,
                          description: language === 'en' ? 'Max 5 MB.' : 'Max 5 Mo.',
                          variant: 'destructive'
                        });
                        return;
                      }
                      setUploading(true);
                      const r = await uploadImage(file, 'campaign-email');
                      setUploading(false);
                      if (r.error || !r.url) {
                        toast({ title: t.error, description: r.error, variant: 'destructive' });
                        return;
                      }
                      setHeaderImageUrl(r.url);
                    }}
                  />
                  {headerImageUrl ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setHeaderImageUrl('')}>
                      <X className="w-4 h-4 mr-1" />
                      {language === 'en' ? 'Remove' : 'Retirer'}
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t.ctaLink}</Label>
                <Input
                  type="url"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="https://…"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>{t.ctaLabel}</Label>
                <Input
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder={language === 'en' ? 'Book now' : 'Réserver'}
                  disabled={!ctaUrl.trim()}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.body}</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[160px]" />
              </div>
              <div className="flex flex-wrap gap-2">
                {!localId ? (
                  <Button onClick={handleCreateDraft} disabled={saving}>
                    {saving ? <Loader size="sm" className="mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    {t.create}
                  </Button>
                ) : (
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader size="sm" className="mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    {t.save}
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2 min-w-0">
              <Label className="text-base">{t.preview}</Label>
              <EmailCampaignPreview
                subject={subject}
                body={body}
                headerImageUrl={headerImageUrl}
                ctaUrl={ctaUrl}
                ctaLabel={ctaLabel}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
