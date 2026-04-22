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

/** Outer gutter (body / wrapper) — matches sent email */
const OUTER_BG = '#f2f2f2';
/** Main card fill — matches sent email */
const INNER_BG = '#f4f4f4';
/** Support callout — pink tint */
const SUPPORT_BG = '#fcf1f1';
const CORAL = '#E57373';

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
  showImage?: boolean;
  showButton?: boolean;
  /** Mirrors server `email_template` */
  templateVariant?: 'standard' | 'investor_vanguard' | string;
  attachPoster?: boolean;
  posterAttachmentUrl?: string;
  posterAttachmentLabel?: string;
}

export function EmailCampaignPreview({
  subject,
  body,
  headerImageUrl,
  ctaUrl,
  ctaLabel,
  showImage = true,
  showButton = true,
  templateVariant = 'standard',
  attachPoster = false,
  posterAttachmentUrl = '',
  posterAttachmentLabel = ''
}: EmailCampaignPreviewProps) {
  const emailSubject = subject.trim() || 'Update from Andiamo Events';
  const content = body.replace(/\n/g, '<br>');
  const showCta = showButton && Boolean(ctaUrl?.trim());
  const btnText = (ctaLabel || 'Learn more').trim() || 'Learn more';
  const hasHeader = showImage && Boolean(headerImageUrl?.trim());
  const investorSubject = subject.trim() || 'Andiamo Events';
  const linkedinUrl = 'https://www.linkedin.com/company/andiamoevents/';
  const instagramUrl = 'https://www.instagram.com/andiamo.events/';
  const webUrl = 'https://www.andiamoevents.com/';

  if (templateVariant === 'investor_vanguard') {
    return (
      <div
        className="rounded-lg border overflow-hidden max-h-[min(70vh,640px)] overflow-y-auto min-w-0"
        style={{ backgroundColor: '#fafafa', borderColor: '#d8d8d8' }}
      >
        <div className="max-w-[640px] w-full min-w-0 mx-auto bg-white border border-zinc-100 shadow-sm">
          <div className="h-1.5 w-full bg-zinc-900" />
          <div className="px-8 pt-5 pb-3 text-center">
            <img
              src="/email-assets/logo-black.png"
              alt="Andiamo Events"
              className="mx-auto h-10 w-auto max-w-[200px] object-contain"
            />
          </div>
          <div className="px-8">
            <div className="h-px bg-zinc-100" />
          </div>
          {hasHeader ? (
            <div className="px-8 pt-4">
              <img
                src={headerImageUrl!.trim()}
                alt=""
                className="w-full max-h-[220px] object-contain rounded-sm"
              />
            </div>
          ) : null}
          <div className="px-8 py-8">
            <h2 className="text-xl sm:text-2xl font-semibold text-zinc-900 leading-tight mb-4">{esc(investorSubject)}</h2>
            <div
              className="text-zinc-600 text-base leading-relaxed mb-6"
              dangerouslySetInnerHTML={{ __html: content || '&nbsp;' }}
            />
            {showCta ? (
              <a
                href={ctaUrl!.trim()}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center px-7 py-3 bg-zinc-900 text-white text-[15px] font-semibold rounded no-underline"
              >
                {esc(btnText)}
              </a>
            ) : null}
            {attachPoster && (posterAttachmentLabel.trim() || posterAttachmentUrl.trim()) ? (
              <p className="text-xs text-zinc-500 mt-4 flex items-center gap-1.5">
                <span className="font-medium">Attachment:</span>
                <span className="truncate">{esc((posterAttachmentLabel || posterAttachmentUrl).trim())}</span>
              </p>
            ) : null}
            <div className="mt-8 rounded border border-zinc-200 border-l-4 border-l-zinc-900 bg-zinc-50 px-6 py-5">
              <p className="m-0 mb-2.5 text-[13px] font-semibold uppercase tracking-wide text-zinc-900">
                Need assistance?
              </p>
              <p className="m-0 text-sm leading-relaxed text-zinc-600">
                Contact us at{' '}
                <a href="mailto:Contact@andiamoevents.com" className="text-zinc-900 underline">
                  Contact@andiamoevents.com
                </a>{' '}
                or in our Instagram page{' '}
                <a href="https://www.instagram.com/andiamo.events/" target="_blank" rel="noreferrer" className="text-zinc-900 underline">
                  @andiamo.events
                </a>{' '}
                or contact with{' '}
                <a href="tel:28070128" className="text-zinc-900 underline">
                  28070128
                </a>
                .
              </p>
            </div>
          </div>
          <div className="bg-zinc-900 px-8 py-8 text-center">
            <div className="flex justify-center items-center gap-6">
              <a href={linkedinUrl} target="_blank" rel="noreferrer" className="inline-block">
                <img src="/email-assets/social-linkedin.svg" alt="LinkedIn" className="w-7 h-7" width={28} height={28} />
              </a>
              <a href={instagramUrl} target="_blank" rel="noreferrer" className="inline-block">
                <img src="/email-assets/social-instagram.svg" alt="Instagram" className="w-7 h-7" width={28} height={28} />
              </a>
              <a href={webUrl} target="_blank" rel="noreferrer" className="inline-block">
                <img src="/email-assets/social-web.svg" alt="Website" className="w-7 h-7" width={28} height={28} />
              </a>
            </div>
            <p className="mt-5 text-[11px] leading-relaxed text-zinc-500">
              © 2026 Born to lead - andiamo events
              <br />
              All Rights Reserved.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border overflow-hidden max-h-[min(70vh,640px)] overflow-y-auto min-w-0"
      style={{ backgroundColor: OUTER_BG, borderColor: '#d8d8d8' }}
    >
      <div className="max-w-[600px] w-full min-w-0 mx-auto" style={{ backgroundColor: OUTER_BG }}>
        <div
          className="mx-4 sm:mx-5 mb-6 rounded-xl px-6 sm:px-7 py-9 border min-w-0 text-[#333333]"
          style={{ backgroundColor: INNER_BG, borderColor: '#e5e5e5' }}
        >
          <div className="mb-7 pb-5 border-b border-[#e0e0e0] text-center">
            <p className="text-[22px] font-semibold text-[#1a1a1a] mb-2">Andiamo Events</p>
            <p className="text-[15px] text-[#666666]">{emailSubject}</p>
          </div>
          {showImage && hasHeader ? (
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
          ) : showImage ? (
            <div className="text-center mb-7">
              <div
                className="mx-auto flex flex-col items-center justify-center rounded-[10px] border-2 border-dashed text-[#555555] px-3 py-4"
                style={{
                  backgroundColor: SUPPORT_BG,
                  borderColor: '#e8b4b4',
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
          ) : null}
          <div
            className="text-base text-[#333333] mb-5 leading-relaxed"
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
          <div
            className="mt-7 rounded-md border-l-[3px] px-6 py-5"
            style={{ backgroundColor: SUPPORT_BG, borderLeftColor: CORAL }}
          >
            <p className="text-sm text-[#555555] leading-relaxed m-0">
              Need assistance? Contact us at{' '}
              <a href="mailto:Contact@andiamoevents.com" className="font-medium no-underline" style={{ color: CORAL }}>
                Contact@andiamoevents.com
              </a>{' '}
              or in our Instagram page{' '}
              <a
                href="https://www.instagram.com/andiamo.events/"
                target="_blank"
                rel="noreferrer"
                className="font-medium no-underline"
                style={{ color: CORAL }}
              >
                @andiamo.events
              </a>{' '}
              or contact with{' '}
              <a href="tel:28070128" className="font-medium no-underline" style={{ color: CORAL }}>
                28070128
              </a>
              .
            </p>
          </div>
          <div className="mt-9 pt-7 border-t border-[#e0e0e0] text-center">
            <p className="text-[22px] italic font-light mb-5" style={{ color: CORAL }}>
              We Create Memories
            </p>
            <p className="text-base text-[#666666] leading-relaxed m-0">
              Best regards,
              <br />
              The Andiamo Events Team
            </p>
          </div>
          <div className="mt-7 pt-6 text-center text-xs text-[#666666] leading-relaxed border-t border-[#e0e0e0]">
            <p className="mb-2.5 m-0">
              Developed by <span style={{ color: CORAL }}>Malek Ben Amor</span>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-[13px] text-[#888888]">
              <a
                href="https://www.instagram.com/malekbenamor.dev/"
                target="_blank"
                rel="noreferrer"
                className="text-[#888888] hover:opacity-80 no-underline"
              >
                Instagram
              </a>
              <span className="text-[#888888]" aria-hidden>
                &bull;
              </span>
              <a
                href="https://malekbenamor.dev/"
                target="_blank"
                rel="noreferrer"
                className="text-[#888888] hover:opacity-80 no-underline"
              >
                Website
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
