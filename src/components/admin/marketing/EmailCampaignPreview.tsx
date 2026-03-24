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
}

export function EmailCampaignPreview({
  subject,
  body,
  headerImageUrl,
  ctaUrl,
  ctaLabel
}: EmailCampaignPreviewProps) {
  const emailSubject = subject.trim() || 'Newsletter Update';
  const content = body.replace(/\n/g, '<br>');
  const showCta = Boolean(ctaUrl?.trim());
  const btnText = (ctaLabel || 'Book now').trim() || 'Book now';
  const hasHeader = Boolean(headerImageUrl?.trim());

  return (
    <div className="rounded-lg border border-border overflow-hidden bg-white text-[#1A1A1A] max-h-[min(70vh,640px)] overflow-y-auto min-w-0">
      <div className="max-w-[600px] w-full min-w-0 mx-auto bg-white">
        <div className="mx-4 sm:mx-5 mb-6 rounded-lg px-6 sm:px-7 py-9 border border-[#e8e8e8] min-w-0">
          <div className="mb-7 pb-5 border-b border-[#eee] text-center">
            <p className="text-[22px] font-semibold text-[#1A1A1A] mb-2">Andiamo Events</p>
            <p className="text-[15px] text-[#555]">{emailSubject}</p>
          </div>
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
            <div className="my-7 flex justify-center">
              <a
                href={ctaUrl!.trim()}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded-[10px] bg-[#E21836] px-8 py-3.5 text-center text-base font-semibold text-white no-underline shadow-sm transition-opacity hover:opacity-[0.92]"
              >
                {esc(btnText)}
              </a>
            </div>
          ) : null}
          <div className="mt-7 rounded border-l-[3px] border-[rgba(226,24,54,0.3)] bg-[#E8E8E8] px-6 py-5">
            <p className="text-sm text-[#666666] leading-relaxed m-0">
              Need assistance? Contact us at{' '}
              <a href="mailto:Contact@andiamoevents.com" className="text-[#E21836] font-medium no-underline">
                Contact@andiamoevents.com
              </a>{' '}
              or in our Instagram page{' '}
              <a
                href="https://www.instagram.com/andiamo.events/"
                target="_blank"
                rel="noreferrer"
                className="text-[#E21836] font-medium no-underline"
              >
                @andiamo.events
              </a>{' '}
              or contact with{' '}
              <a href="tel:28070128" className="text-[#E21836] font-medium no-underline">
                28070128
              </a>
              .
            </p>
          </div>
          <div className="mt-9 pt-7 border-t border-[#eee] text-center">
            <p className="text-[22px] italic text-[#E21836] font-light mb-5">We Create Memories</p>
            <p className="text-base text-[#666666] leading-relaxed m-0">
              Best regards,
              <br />
              The Andiamo Events Team
            </p>
          </div>
        </div>
        <div className="mt-10 mb-8 px-5 pt-10 text-center text-xs text-[#999999] leading-relaxed border-t border-black/10">
          <p className="mb-5">
            You&apos;re receiving this email from Andiamo Events.
            <br />
            To stop these updates, reply to this message or email{' '}
            <a href="mailto:support@andiamoevents.com" className="text-[#E21836] font-medium no-underline">
              support@andiamoevents.com
            </a>
            .
          </p>
          <p className="mb-5">
            Developed by <span className="text-[#E21836]">Malek Ben Amor</span>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[13px] text-[#999999]">
            <a
              href="https://www.instagram.com/malekbenamor.dev/"
              target="_blank"
              rel="noreferrer"
              className="text-[#999999] hover:text-[#E21836] no-underline"
            >
              Instagram
            </a>
            <span className="text-[#999999]" aria-hidden>
              &bull;
            </span>
            <a
              href="https://malekbenamor.dev/"
              target="_blank"
              rel="noreferrer"
              className="text-[#999999] hover:text-[#E21836] no-underline"
            >
              Website
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
