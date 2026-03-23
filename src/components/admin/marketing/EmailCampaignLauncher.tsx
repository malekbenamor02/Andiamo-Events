import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BulkEmailSelector } from '@/components/admin/BulkEmailSelector';
import type { MarketingCampaign } from '@/types/bulk-sms';

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

  const draftSelectKey = [...drafts.map((d) => d.id)].sort().join(',') || 'none';

  const hasEmailCampaigns = useMemo(() => campaigns.some((c) => c.type === 'email'), [campaigns]);

  const t =
    language === 'en'
      ? {
          title: 'Launch email campaign',
          pick: 'Choose a saved draft',
          hint: 'Pick a template you created above, then select recipients and daily cap.',
          emptyDrafts:
            'No drafts right now. Save a new campaign with “Create draft” above, or note: launched / completed campaigns only appear under Campaign results—not in this list.'
        }
      : {
          title: 'Lancer une campagne email',
          pick: 'Choisir un brouillon',
          hint: 'Sélectionnez un modèle créé ci-dessus, puis les destinataires et le plafond journalier.',
          emptyDrafts:
            'Aucun brouillon. Enregistrez une campagne avec « Créer brouillon » ci-dessus. Les campagnes lancées ou terminées sont dans Résultats des campagnes, pas dans cette liste.'
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
