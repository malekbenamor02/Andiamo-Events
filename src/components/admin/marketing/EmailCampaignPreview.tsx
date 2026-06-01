/**
 * Live preview for email campaigns — Standard mirrors transactional-campaign-email-html; investor mirrors investor template.
 */
import React from 'react';

/** Hero image width in sent email (misc.js buildCampaignEmailHtml img width="520"). */
const HERO_WIDTH = 520;
/** ~1.91:1 (common social / banner ratio); height scales with width in real sends. */
const HERO_HEIGHT = 273;
/** Admin preview only — caps tall posters so the pane stays usable (sent email unchanged). */
const PREVIEW_HERO_MAX_HEIGHT = 'min(300px, 42vh)';

/** Transactional (standard) — matches order/ticket emails */
const TX_BG = '#101010';
const TX_CARD = '#1A1A1A';
const TX_ACCENT = '#E21836';

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
  const btnText = (ctaLabel || 'View details').trim() || 'View details';
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
            <p className="mt-3 text-[11px] text-zinc-500">
              Developed by{' '}
              <a href="https://malekbenamor.dev" target="_blank" rel="noreferrer" className="text-zinc-400 underline">
                Malek Ben Amor
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border overflow-hidden max-h-[min(70vh,640px)] overflow-y-auto min-w-0"
      style={{ backgroundColor: TX_BG, borderColor: '#333' }}
    >
      <div className="max-w-[600px] w-full min-w-0 mx-auto" style={{ backgroundColor: TX_BG }}>
        <div className="text-center py-6 px-4">
          <img
            src="/email-assets/logo-white.png"
            alt="Andiamo Events"
            className="mx-auto h-10 w-auto max-w-[200px] object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
        <div
          className="mx-4 sm:mx-5 mb-6 rounded-xl px-6 sm:px-8 py-10 border min-w-0"
          style={{ backgroundColor: TX_CARD, borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div className="mb-8 pb-6 border-b border-white/10 text-center">
            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">{esc(emailSubject)}</h2>
            <p className="text-sm text-[#B8B8B8]">Andiamo Events</p>
          </div>
          <p className="text-lg text-[#F0F0F0] mb-6 leading-relaxed m-0">
            Dear <strong style={{ color: TX_ACCENT }}>Subscriber</strong>,
          </p>
          <div
            className="text-base text-[#B8B8B8] mb-6 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: content || '&nbsp;' }}
          />
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-sm text-[#B8B8B8] leading-relaxed m-0">
              Questions? Reply to this email or contact{' '}
              <a href="mailto:contact@andiamoevents.com" className="text-[#E21836] underline">
                contact@andiamoevents.com
              </a>
              .
            </p>
            <p className="text-base text-[#B8B8B8] leading-relaxed mt-6 mb-0">
              Best regards,
              <br />
              The Andiamo Events Team
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
