import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { API_ROUTES, buildFullApiUrl } from '@/lib/api-routes';
import { useToast } from '@/hooks/use-toast';
import { uploadImage, uploadMarketingEmailAttachment } from '@/lib/upload';
import Loader from '@/components/ui/Loader';
import { Separator } from '@/components/ui/separator';
import { ImagePlus, Paperclip, X, Save, Plus } from 'lucide-react';
import { EmailCampaignPreview } from './EmailCampaignPreview';

/** Match server `sanitizeEmailTemplate` so UI state matches DB rows. */
function normalizeEmailTemplateLabel(v: unknown): 'investor_vanguard' | 'standard' {
  const s = String(v ?? 'standard')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return s === 'investor_vanguard' ? 'investor_vanguard' : 'standard';
}

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
  const [enableImage, setEnableImage] = useState(false);
  const [enableButton, setEnableButton] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState<'standard' | 'investor_vanguard'>('standard');
  const [attachPoster, setAttachPoster] = useState(false);
  const [posterAttachmentUrl, setPosterAttachmentUrl] = useState('');
  const [posterAttachmentLabel, setPosterAttachmentLabel] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
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
          poster: 'Banner image',
          posterHint: 'Shown below the logo in the email — JPG, PNG, WebP (max 5 MB).',
          ctaLink: 'Button link',
          ctaLabel: 'Button label',
          sectionLayout: 'Email type',
          sectionContent: 'What to include in the email',
          sectionContentHint: '',
          rowHero: 'Banner image in the message',
          rowHeroDesc: '',
          rowCta: 'Action button',
          rowCtaDesc: '',
          rowAttach: 'File attachment',
          rowAttachDesc: '',
          attachPickFile: 'Choose file',
          attachRemove: 'Remove file',
          template: 'Email type',
          templateStandard: 'Standard',
          templateInvestor: 'Investors',
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
          poster: 'Image bannière',
          posterHint: 'Sous le logo dans l’e-mail — JPG, PNG, WebP (max 5 Mo).',
          ctaLink: 'Lien du bouton',
          ctaLabel: 'Texte du bouton',
          sectionLayout: 'Type d’email',
          sectionContent: 'Contenu de l’e-mail',
          sectionContentHint: '',
          rowHero: 'Image bannière dans le message',
          rowHeroDesc: '',
          rowCta: 'Bouton d’action',
          rowCtaDesc: '',
          rowAttach: 'Pièce jointe',
          rowAttachDesc: '',
          attachPickFile: 'Choisir un fichier',
          attachRemove: 'Retirer le fichier',
          template: 'Type d’email',
          templateStandard: 'Standard',
          templateInvestor: 'Investisseurs',
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
      setEnableImage(false);
      setEnableButton(false);
      setEmailTemplate('standard');
      setAttachPoster(false);
      setPosterAttachmentUrl('');
      setPosterAttachmentLabel('');
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
          setEnableImage(Boolean(c.header_image_url));
          setEnableButton(Boolean(c.cta_url));
          const tplLoaded = normalizeEmailTemplateLabel(c.email_template);
          setEmailTemplate(tplLoaded);
          setAttachPoster(Boolean(c.attach_poster));
          setPosterAttachmentUrl(typeof c.poster_attachment_url === 'string' ? c.poster_attachment_url : '');
          {
            const u = typeof c.poster_attachment_url === 'string' ? c.poster_attachment_url : '';
            const seg = u.split('/').filter(Boolean).pop() || '';
            setPosterAttachmentLabel(seg ? decodeURIComponent(seg.slice(0, 80)) : '');
          }
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
    setEnableImage(Boolean(c.header_image_url));
    setEnableButton(Boolean(c.cta_url));
    const tplLoaded = normalizeEmailTemplateLabel(c.email_template);
    setEmailTemplate(tplLoaded);
    setAttachPoster(Boolean(c.attach_poster));
    setPosterAttachmentUrl(typeof c.poster_attachment_url === 'string' ? c.poster_attachment_url : '');
    {
      const u = typeof c.poster_attachment_url === 'string' ? c.poster_attachment_url : '';
      const seg = u.split('/').filter(Boolean).pop() || '';
      setPosterAttachmentLabel(seg ? decodeURIComponent(seg.slice(0, 80)) : '');
    }
  }

  const handleCreateDraft = async () => {
    setSaving(true);
    try {
      const intendedTemplate = normalizeEmailTemplateLabel(emailTemplate);
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
          header_image_url: enableImage && headerImageUrl.trim() ? headerImageUrl.trim() : null,
          cta_url: enableButton && ctaUrl.trim() ? ctaUrl.trim() : null,
          cta_label: enableButton && ctaUrl.trim() ? (ctaLabel.trim() || null) : null,
          email_template: emailTemplate,
          sender_profile: intendedTemplate === 'investor_vanguard' ? 'investor' : 'default',
          attach_poster: attachPoster,
          poster_attachment_url: attachPoster && posterAttachmentUrl.trim() ? posterAttachmentUrl.trim() : null
        })
      });
      const data = await res.json();
      if (!data.success || !data.data?.campaign_id) throw new Error(data.error || 'Create failed');
      const row = data.data.campaign;
      if (
        intendedTemplate === 'investor_vanguard' &&
        row &&
        typeof row === 'object' &&
        normalizeEmailTemplateLabel((row as Record<string, unknown>).email_template) !== 'investor_vanguard'
      ) {
        toast({
          title: t.error,
          description:
            language === 'en'
              ? 'Institutional layout was not saved. Email campaign backend configuration is incomplete. Contact your administrator.'
              : 'La mise en page institutionnelle n’a pas été enregistrée. La configuration du service e-mail est incomplète. Contactez votre administrateur.',
          variant: 'destructive'
        });
        return;
      }
      setLocalId(data.data.campaign_id);
      if (row && typeof row === 'object') {
        applyCampaignFromServer(row as Record<string, unknown>);
      }
      onSaved(data.data.campaign_id);
      toast({ title: t.saved, description: language === 'en' ? 'Draft created.' : 'Brouillon créé.' });
      onClose();
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
      const intendedTemplate = normalizeEmailTemplateLabel(emailTemplate);
      const res = await fetch(buildFullApiUrl(API_ROUTES.MARKETING_CAMPAIGN(localId)), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() ? name.trim().slice(0, 500) : null,
          subject: subject.trim(),
          body,
          header_image_url: enableImage && headerImageUrl.trim() ? headerImageUrl.trim() : null,
          cta_url: enableButton && ctaUrl.trim() ? ctaUrl.trim() : null,
          cta_label: enableButton && ctaUrl.trim() ? (ctaLabel.trim() || null) : null,
          email_template: emailTemplate,
          sender_profile: intendedTemplate === 'investor_vanguard' ? 'investor' : 'default',
          attach_poster: attachPoster,
          poster_attachment_url: attachPoster && posterAttachmentUrl.trim() ? posterAttachmentUrl.trim() : null
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Save failed');
      const row = data.data?.campaign;
      if (
        intendedTemplate === 'investor_vanguard' &&
        row &&
        typeof row === 'object' &&
        normalizeEmailTemplateLabel((row as Record<string, unknown>).email_template) !== 'investor_vanguard'
      ) {
        toast({
          title: t.error,
          description:
            language === 'en'
              ? 'Institutional layout was not saved. Email campaign backend configuration is incomplete. Contact your administrator.'
              : 'La mise en page institutionnelle n’a pas été enregistrée. La configuration du service e-mail est incomplète. Contactez votre administrateur.',
          variant: 'destructive'
        });
        return;
      }
      if (row && typeof row === 'object') {
        applyCampaignFromServer(row as Record<string, unknown>);
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
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-muted/15 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t.sectionLayout}</h3>
                  <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.template}</Label>
                  <Select
                    value={emailTemplate}
                    onValueChange={(v) => {
                      const tpl = v === 'investor_vanguard' ? 'investor_vanguard' : 'standard';
                      setEmailTemplate(tpl);
                    }}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">{t.templateStandard}</SelectItem>
                      <SelectItem value="investor_vanguard">{t.templateInvestor}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border border-border p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t.sectionContent}</h3>
                </div>

                <div className="rounded-md border border-border bg-card p-3 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label htmlFor="campaign-enable-image" className="text-sm font-medium">
                        {t.rowHero}
                      </Label>
                    </div>
                    <Switch
                      id="campaign-enable-image"
                      className="shrink-0"
                      checked={enableImage}
                      onCheckedChange={(checked) => {
                        setEnableImage(checked);
                        if (!checked) setHeaderImageUrl('');
                      }}
                    />
                  </div>
                  {enableImage ? (
                    <div className="space-y-2 pl-0 sm:pl-1 border-t border-border/60 pt-3">
                      <Label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ImagePlus className="w-3.5 h-3.5" />
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
                  ) : null}
                </div>

                <div className="rounded-md border border-border bg-card p-3 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label htmlFor="campaign-enable-button" className="text-sm font-medium">
                        {t.rowCta}
                      </Label>
                    </div>
                    <Switch
                      id="campaign-enable-button"
                      className="shrink-0"
                      checked={enableButton}
                      onCheckedChange={(checked) => {
                        setEnableButton(checked);
                        if (!checked) {
                          setCtaUrl('');
                          setCtaLabel('');
                        }
                      }}
                    />
                  </div>
                  {enableButton ? (
                    <div className="space-y-2 border-t border-border/60 pt-3">
                      <div className="space-y-2">
                        <Label className="text-xs">{t.ctaLink}</Label>
                        <Input
                          type="url"
                          value={ctaUrl}
                          onChange={(e) => setCtaUrl(e.target.value)}
                          placeholder="https://…"
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">{t.ctaLabel}</Label>
                        <Input
                          value={ctaLabel}
                          onChange={(e) => setCtaLabel(e.target.value)}
                          placeholder={language === 'en' ? 'Book now' : 'Réserver'}
                          disabled={!ctaUrl.trim()}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-md border border-border bg-card p-3 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <Label htmlFor="campaign-attach-poster" className="text-sm font-medium">
                        {t.rowAttach}
                      </Label>
                    </div>
                    <Switch
                      id="campaign-attach-poster"
                      className="shrink-0"
                      checked={attachPoster}
                      onCheckedChange={(checked) => {
                        setAttachPoster(checked);
                        if (!checked) {
                          setPosterAttachmentUrl('');
                          setPosterAttachmentLabel('');
                        }
                      }}
                    />
                  </div>
                  {attachPoster ? (
                    <div className="space-y-2 border-t border-border/60 pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="file"
                          accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp,image/gif,.doc,.docx"
                          disabled={uploadingAttachment}
                          className="max-w-xs"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            const maxBytes = 10 * 1024 * 1024;
                            if (file.size > maxBytes) {
                              toast({
                                title: t.error,
                                description: language === 'en' ? 'Max 10 MB for attachments.' : 'Max 10 Mo pour les pièces jointes.',
                                variant: 'destructive'
                              });
                              return;
                            }
                            setUploadingAttachment(true);
                            const r = await uploadMarketingEmailAttachment(file);
                            setUploadingAttachment(false);
                            if (r.error || !r.url) {
                              toast({ title: t.error, description: r.error, variant: 'destructive' });
                              return;
                            }
                            setPosterAttachmentUrl(r.url);
                            setPosterAttachmentLabel(file.name);
                          }}
                        />
                        {posterAttachmentUrl ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPosterAttachmentUrl('');
                              setPosterAttachmentLabel('');
                            }}
                          >
                            <X className="w-4 h-4 mr-1" />
                            {t.attachRemove}
                          </Button>
                        ) : null}
                        {uploadingAttachment ? <Loader size="sm" /> : null}
                      </div>
                      {posterAttachmentLabel ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Paperclip className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{posterAttachmentLabel}</span>
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <Separator />

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
                headerImageUrl={enableImage ? headerImageUrl : ''}
                ctaUrl={enableButton ? ctaUrl : ''}
                ctaLabel={ctaLabel}
                showImage={enableImage}
                showButton={enableButton}
                templateVariant={emailTemplate}
                attachPoster={attachPoster}
                posterAttachmentUrl={posterAttachmentUrl}
                posterAttachmentLabel={posterAttachmentLabel}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
