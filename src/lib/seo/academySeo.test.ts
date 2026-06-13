import { describe, expect, it } from 'vitest';
import { ACADEMY_FAQ } from '@/data/academyContent';
import {
  ACADEMY_PAGE_DESCRIPTIONS,
  buildAcademyCourseSchema,
  buildAcademyFaqSchema,
  buildAcademyFaqPageSchema,
} from './academySeo';

describe('ACADEMY_PAGE_DESCRIPTIONS', () => {
  it('keeps main descriptions within recommended SEO length', () => {
    for (const lang of ['en', 'fr'] as const) {
      const len = ACADEMY_PAGE_DESCRIPTIONS.main[lang].length;
      expect(len).toBeGreaterThan(120);
      expect(len).toBeLessThanOrEqual(165);
    }
  });
});

describe('buildAcademyFaqSchema', () => {
  it('maps all FAQ items for each language', () => {
    expect(buildAcademyFaqSchema('en')).toHaveLength(ACADEMY_FAQ.length);
    expect(buildAcademyFaqSchema('fr')).toHaveLength(ACADEMY_FAQ.length);
    expect(buildAcademyFaqSchema('en')[0]?.question).toBeTruthy();
    expect(buildAcademyFaqSchema('en')[0]?.answer).toBeTruthy();
  });
});

describe('buildAcademyCourseSchema', () => {
  it('returns a valid Course schema shape', () => {
    const schema = buildAcademyCourseSchema('en');
    expect(schema['@type']).toBe('Course');
    expect(schema.name).toContain('Event Management');
    expect(schema.provider).toMatchObject({ '@type': 'Organization', name: 'Andiamo Events' });
    expect(schema.instructor).toMatchObject({ '@type': 'Person', name: 'Mouayed Chakir' });
    expect(schema.timeRequired).toBe('PT20H');
    expect(schema.offers).toMatchObject({
      '@type': 'AggregateOffer',
      lowPrice: 900,
      highPrice: 2500,
      priceCurrency: 'TND',
    });
  });
});

describe('buildAcademyFaqPageSchema', () => {
  it('builds FAQPage with mainEntity entries', () => {
    const schema = buildAcademyFaqPageSchema('fr');
    expect(schema['@type']).toBe('FAQPage');
    const entities = schema.mainEntity as unknown[];
    expect(entities).toHaveLength(ACADEMY_FAQ.length);
    expect(entities[0]).toMatchObject({
      '@type': 'Question',
      acceptedAnswer: { '@type': 'Answer' },
    });
  });
});
