/**
 * Live preview for email campaigns — layout mirrors api/misc.js buildCampaignEmailHtml (keep in sync manually).
 */
import React from 'react';

/** Hero image width in sent email (misc.js buildCampaignEmailHtml img width="520"). */
const HERO_WIDTH = 520;
/** ~1.91:1 (common social / banner ratio); height scales with width in real sends. */
const HERO_HEIGHT = 273;
/** Admin preview only — caps tall posters so the pane stays usable (sent email unchanged). */
const PREVIEW_HERO_MAX_HEIGHT = 'min(300px, 42vh)';

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface EmailCampaignPreviewProps {
  subject: string;
  body: string;
  headerImageUrl?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  sampleName?: string;
}

export function EmailCampaignPreview({
  subject,
  body,
  headerImageUrl,
  ctaUrl,
  ctaLabel,
  sampleName = 'Foulen Ben Foulen'
}: EmailCampaignPreviewProps) {
  const emailSubject = subject.trim() || 'Newsletter Update';
  const content = body.replace(/\n/g, '<br>');
  const supportUrl = 'https://www.andiamoevents.com/contact';
  const showCta = Boolean(ctaUrl?.trim());
  const btnText = (ctaLabel || 'Book now').trim() || 'Book now';
  const hasHeader = Boolean(headerImageUrl?.trim());

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-white text-[#1A1A1A] max-h-[min(70vh,640px)] overflow-y-auto min-w-0">
      <div className="max-w-[600px] w-full min-w-0 mx-auto bg-white">
        <div className="mx-4 sm:mx-5 mb-6 rounded-lg px-6 sm:px-7 py-9 border border-[#e8e8e8] min-w-0">
          <div className="mb-7 pb-5 border-b border-[#eee]">
            <p className="text-[22px] font-semibold text-[#1A1A1A] mb-2">Andiamo Events</p>
            <p className="text-[15px] text-[#555]">{emailSubject}</p>
          </div>
          <p className="text-base mb-5 leading-relaxed text-[#1A1A1A]">
            Dear <strong className="text-[#E21836] font-semibold">{esc(sampleName)}</strong>,
          </p>
          {hasHeader ? (
            <div className="flex justify-center mb-7 min-w-0">
              <img
                src={headerImageUrl!.trim()}
                alt=""
                className="h-auto max-w-full w-auto rounded-[10px] block border-0"
                style={{
                  maxWidth: `min(100%, ${HERO_WIDTH}px)`,
                  maxHeight: PREVIEW_HERO_MAX_HEIGHT
                }}
              />
            </div>
          ) : (
            <div className="text-center mb-7">
              <div
                className="mx-auto flex flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-[#c4c4c4] bg-[#ebebeb] text-[#737373] px-3 py-4"
                style={{
                  width: '100%',
                  maxWidth: HERO_WIDTH,
                  minHeight: HERO_HEIGHT,
                  aspectRatio: `${HERO_WIDTH} / ${HERO_HEIGHT}`
                }}
              >
                <span className="text-sm font-semibold tracking-tight">Header image placeholder</span>
                <span className="text-xs mt-1.5 text-center leading-snug">
                  {HERO_WIDTH} × {HERO_HEIGHT} px recommended
                  <br />
                  <span className="text-[11px] opacity-90">(matches max width in the sent email)</span>
                </span>
              </div>
            </div>
          )}
          <div
            className="text-base text-[#333] mb-5 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: content || '&nbsp;' }}
          />
          {showCta ? (
            <p className="my-6 text-base leading-relaxed">
              <a
                href={ctaUrl!.trim()}
                target="_blank"
                rel="noreferrer"
                className="text-[#E21836] font-semibold underline"
              >
                {esc(btnText)}
              </a>
            </p>
          ) : null}
          <p className="text-sm text-[#555] leading-relaxed mt-7">
            Need help? Email{' '}
            <a href="mailto:support@andiamoevents.com" className="text-[#E21836] underline">
              support@andiamoevents.com
            </a>{' '}
            or visit our{' '}
            <a href={supportUrl} className="text-[#E21836] underline">
              contact page
            </a>
            .
          </p>
          <p className="text-[15px] text-[#444] leading-relaxed mt-7">
            Best regards,
            <br />
            The Andiamo Events Team
          </p>
        </div>
        <div className="mt-6 mb-8 px-5 text-left text-xs text-[#777] leading-relaxed border-t border-[#eee] pt-5">
          Reply to this message or contact support@andiamoevents.com if you no longer want these updates.
        </div>
      </div>
    </div>
  );
}
