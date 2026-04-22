import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BulkEmailSelector } from '@/components/admin/BulkEmailSelector';
import type { MarketingCampaign } from '@/types/bulk-sms';

function isInstitutionalEmailTemplate(t: string | undefined): boolean {
  return (
    String(t ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_') === 'investor_vanguard'
  );
}

export interface EmailCampaignLauncherProps {
  language: 'en' | 'fr';
  campaigns: MarketingCampaign[];
  selectedDraftId: string | null;
  onSelectDraft: (id: string | null) => void;
  onLaunchComplete: () => void;
}

export function EmailCampaignLauncher({
  language,
  campaigns,
  selectedDraftId,
  onSelectDraft,
  onLaunchComplete
}: EmailCampaignLauncherProps) {
  const drafts = useMemo(
    () => campaigns.filter((c) => c.type === 'email' && c.status === 'draft'),
    [campaigns]
  );

  const selectedDraft = useMemo(
    () => (selectedDraftId ? campaigns.find((c) => c.id === selectedDraftId) : undefined),
    [campaigns, selectedDraftId]
  );

  const draftSelectKey = [...drafts.map((d) => d.id)].sort().join(',') || 'none';

  const hasEmailCampaigns = useMemo(() => campaigns.some((c) => c.type === 'email'), [campaigns]);

  const t =
    language === 'en'
      ? {
          title: 'Launch email campaign',
          pick: 'Choose a saved draft',
          hint: 'Pick a template you created above, then select recipients and daily cap.',
          emptyDrafts:
            'No drafts right now. Save a new campaign with “Create draft” above, or note: launched / completed campaigns only appear under Campaign results—not in this list.',
          savedAsTitle: 'What will be sent (from your saved draft)',
          savedAsHint:
            'Launch only adds recipients. Layout, sender, and attachments come from the draft — use New email campaign → Save if this does not match what you want.',
          layoutStandard: 'Layout: Standard (newsletter)',
          layoutInvestor: 'Layout: Institutional (investor)',
          senderDefault: 'Sender: Main Andiamo',
          senderInvestor: 'Sender: Investor mailbox (if configured on server)',
          attachYes: 'Attachment: Yes (file from draft)',
          attachNo: 'Attachment: None',
          attachIncomplete:
            'Attachment is enabled but no file URL is stored — open the draft, upload again, and Save.',
        }
      : {
          title: 'Lancer une campagne email',
          pick: 'Choisir un brouillon',
          hint: 'Sélectionnez un modèle créé ci-dessus, puis les destinataires et le plafond journalier.',
          emptyDrafts:
            'Aucun brouillon. Enregistrez une campagne avec « Créer brouillon » ci-dessus. Les campagnes lancées ou terminées sont dans Résultats des campagnes, pas dans cette liste.',
          savedAsTitle: 'Contenu réellement envoyé (depuis le brouillon)',
          savedAsHint:
            'Lancer ajoute seulement les destinataires. Mise en page, expéditeur et pièces jointes viennent du brouillon — modifiez via Nouvelle campagne email → Enregistrer si besoin.',
          layoutStandard: 'Mise en page : Standard (newsletter)',
          layoutInvestor: 'Mise en page : Institutionnel (investisseurs)',
          senderDefault: 'Expéditeur : Andiamo principal',
          senderInvestor: 'Expéditeur : Boîte investisseurs (si configurée sur le serveur)',
          attachYes: 'Pièce jointe : Oui (fichier du brouillon)',
          attachNo: 'Pièce jointe : Aucune',
          attachIncomplete:
            'Pièce jointe activée mais aucune URL enregistrée — ouvrez le brouillon, téléversez à nouveau et Enregistrez.',
        };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.hint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 max-w-md">
          <Label>{t.pick}</Label>
          <Select
            key={draftSelectKey}
            value={selectedDraftId || '__none__'}
            onValueChange={(v) => onSelectDraft(v === '__none__' ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{language === 'en' ? '— Select —' : '— Choisir —'}</SelectItem>
              {drafts.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {(d.name?.trim() || d.subject || d.id).slice(0, 60)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {drafts.length === 0 && hasEmailCampaigns ? (
            <p className="text-xs text-muted-foreground leading-relaxed">{t.emptyDrafts}</p>
          ) : null}
        </div>
        {selectedDraft && selectedDraft.type === 'email' ? (
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm space-y-1 max-w-xl">
            <p className="font-medium text-foreground">{t.savedAsTitle}</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
              <li>
                {isInstitutionalEmailTemplate(selectedDraft.email_template) ? t.layoutInvestor : t.layoutStandard}
              </li>
              <li>
                {selectedDraft.sender_profile === 'investor' ||
                isInstitutionalEmailTemplate(selectedDraft.email_template)
                  ? t.senderInvestor
                  : t.senderDefault}
              </li>
              <li>
                {selectedDraft.attach_poster && selectedDraft.poster_attachment_url?.trim()
                  ? t.attachYes
                  : selectedDraft.attach_poster
                    ? t.attachIncomplete
                    : t.attachNo}
              </li>
            </ul>
            <p className="text-xs text-muted-foreground pt-1">{t.savedAsHint}</p>
          </div>
        ) : null}
        {selectedDraftId ? (
          <BulkEmailSelector
            language={language}
            launchOnlyCampaignId={selectedDraftId}
            onLaunchComplete={onLaunchComplete}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
